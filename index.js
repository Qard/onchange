var spawn = require('cross-spawn').spawn
var chokidar = require('chokidar')

module.exports = function (matches, command, args, opts) {
  var pwd = process.cwd()
  var verbose = opts.verbose
  var proc

  // Notify the user what they are watching
  var watching = 'watching ' + matches.join(', ')

  // Ignore node_modules folders, as they eat CPU like crazy
  matches.push('!**/node_modules/**')

  // Convert arguments to templates
  var tmpls = args.map(tmpl)
  var watcher = chokidar.watch(matches)

  // Logging
  function log () {
    if (verbose) console.log.apply(console, arguments)
  }

  function start (file) {
    if (proc) {
      log('onchange: restarting process')

      proc.on('close', function () {
        start(file)
      })

      proc.kill()
      proc = null
      return
    }

    log('onchange ' + watching)

    // Generate argument strings from templates
    var filtered = tmpls.map(function (tmpl) {
      return tmpl({ changed: file })
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

  watcher.on('ready', function () {
    var running = false

    // For any change, creation or deletion, try to run.
    // Restart if the last run is still active.
    watcher.on('all', function (event, file) {
      // Log the event and the file affected
      log(event + ' to ' + file.replace(pwd, ''))

      start(file)
    })
  })

  if (opts.initial) {
    start('')
  }
}

//
// Helpers
//

// Double mustache template generator
function tmpl (str) {
  return function (data) {
    return str.replace(/{{([^{}]*)}}/g, function (a, expression) {
      var fn = new Function('data','with(data){return '+expression+'}')
      return fn(data)
    })
  }
}
