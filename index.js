var spawn = require('cross-spawn').spawn
var chokidar = require('chokidar')

module.exports = function (matches, command, args, opts) {
  var verbose = opts && opts.verbose
  var initial = opts && opts.initial
  var cwd = opts && opts.cwd || process.cwd()
  var exclude = opts && opts.exclude || []
  var proc
  var onclose

  // Convert arguments to templates
  var tmpls = args ? args.map(tmpl) : []
  var watcher = chokidar.watch(matches, { cwd: cwd, ignored: exclude })

  // Logging
  function log (message) {
    if (verbose) {
      console.log('onchange:', message)
    }
  }

  function start (event, changed) {
    if (proc) {
      log('restarting process')

      // Skip the previous listener.
      if (onclose) {
        proc.removeListener('close', onclose)
      }

      onclose = function () {
        start(event, changed)
        onclose = null
      }

      proc.on('close', onclose)

      proc.kill()
      return
    }

    log('executing "' + command + '"')

    // Generate argument strings from templates
    var filtered = tmpls.map(function (tmpl) {
      return tmpl({ event: event, changed: changed })
    })

    proc = spawn(command, filtered, {
      stdio: ['ignore', process.stdout, process.stderr]
    })

    // Log the result and unlock
    proc.on('close', function (code) {
      proc = null

      if (code != null) {
        log('completed with code ' + code)
      }
    })
  }

  log('watching ' + matches.join(', '))

  watcher.on('ready', function () {
    // For any change, creation or deletion, try to run.
    // Restart if the last run is still active.
    watcher.on('all', function (event, file) {
      // Log the event and the file affected
      log(event + ' to ' + file)

      start(event, file)
    })
  })

  if (initial) {
    start('', '')
  }
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
