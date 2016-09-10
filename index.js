var kill = require('tree-kill')
var resolve = require('path').resolve
var spawn = require('cross-spawn').spawn
var chokidar = require('chokidar')
var arrify = require('arrify')

module.exports = function (match, command, args, opts) {
  opts = opts || {}

  var matches = arrify(match)
  var verbose = !!opts.verbose
  var initial = !!opts.initial
  var wait = !!opts.wait
  var cwd = opts.cwd ? resolve(opts.cwd) : process.cwd()
  var exclude = opts.exclude || []
  var stdout = opts.stdout || process.stdout
  var stderr = opts.stderr || process.stderr
  var delay = Number(opts.delay) || 0
  var killSignal = opts.killSignal || 'SIGTERM'

  var child
  var pendingOpts
  var pendingTimeout
  var pendingExit = false

  // Convert arguments to templates
  var tmpls = args ? args.map(tmpl) : []
  var watcher = chokidar.watch(matches, { cwd: cwd, ignored: exclude })

  // Logging
  var log = verbose ? function log (message) {
    stdout.write('onchange: ' + message + '\n')
  } : function () {}

  /**
   * Run when the script exits.
   */
  function onexit () {
    child = null
    pendingExit = false

    if (pendingOpts) {
      if (pendingTimeout) {
        clearTimeout(pendingTimeout)
      }

      if (delay > 0) {
        pendingTimeout = setTimeout(function () {
          cleanstart(pendingOpts)
        }, delay)
      } else {
        cleanstart(pendingOpts)
      }
    }
  }

  /**
   * Run on fresh start (after exists, clears pending args).
   */
  function cleanstart (args) {
    pendingOpts = null
    pendingTimeout = null

    return start(args)
  }

  /**
   * Start the script.
   */
  function start (opts) {
    // Set pending options for next execution.
    if (child) {
      pendingOpts = opts

      if (!pendingExit) {
        if (wait) {
          log('waiting for process and restarting')
        } else {
          log('killing process ' + child.pid + ' and restarting')
          kill(child.pid, killSignal)
        }

        pendingExit = true
      }
    }

    if (pendingTimeout || pendingOpts) {
      return
    }

    // Generate argument strings from templates.
    var filtered = tmpls.map(function (tmpl) {
      return tmpl(opts)
    })

    log('executing "' + [command].concat(filtered).join(' ') + '"')

    child = spawn(command, filtered, {
      cwd: cwd,
      stdio: ['ignore', stdout, stderr]
    })

    child.on('exit', function (code, signal) {
      if (code == null) {
        log('process exited with ' + signal)
      } else {
        log('process completed with code ' + code)
      }

      return onexit()
    })
  }

  watcher.on('ready', function () {
    log('watching ' + matches.join(', '))

    // Execute initial event, without changed options.
    if (initial) {
      start({ event: '', changed: '' })
    }

    // For any change, creation or deletion, try to run.
    // Restart if the last run is still active.
    watcher.on('all', function (event, changed) {
      // Log the event and the file affected
      log(event + ' to ' + changed)

      start({ event: event, changed: changed })
    })
  })

  watcher.on('error', function (error) {
    log('watcher error: ' + error)
  })
}

//
// Helpers
//

// Double mustache template generator
function tmpl (str) {
  return function (data) {
    return str.replace(/{{([^{}]+)}}/g, function (_, key) {
      return data[key]
    })
  }
}
