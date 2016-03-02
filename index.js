var spawn = require('cross-spawn').spawn
var chokidar = require('chokidar')

module.exports = function (matches, command, args, opts) {
  var pwd = process.cwd()
  var verbose = opts.verbose
  var proc

  // Convert arguments to templates
  var tmpls = args.map(tmpl)
  var watcher = chokidar.watch(matches)

  // Logging
  function log () {
    if (verbose) console.log.apply(console, arguments)
  }

  function start (event, changed) {
    if (proc) {
      log('onchange: restarting process')

      proc.on('close', function () {
        start(event, changed)
      })

      proc.kill()
      proc = null
      return
    }

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
        log('onchange: completed with code ' + code)
      }
    })
  }

  log('onchange watching ' + matches.join(', '))

  watcher.on('ready', function () {
    // For any change, creation or deletion, try to run.
    // Restart if the last run is still active.
    watcher.on('all', function (event, file) {
      // Log the event and the file affected
      log(event + ' to ' + file.replace(pwd, ''))

      start(event, file)
    })
  })

  if (opts.initial) {
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
