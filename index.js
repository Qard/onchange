var spawn = require('cross-spawn').spawn
var readline = require('readline');
var chokidar = require('chokidar')

module.exports = function (matches, command, args, verbose) {
  var pwd = process.cwd()

  // Logging
  function log(){
    if (verbose) console.log.apply(console, arguments)
  }

  // Notify the user what they are watching
  var watching = 'Watching ' + matches.join(', ')
  log('onchange: ' + watching)

  // Ignore node_modules folders, as they eat CPU like crazy
  matches.push('!**/node_modules/**')

  // Convert arguments to templates
  var tmpls = args.map(tmpl)

  var watcher = chokidar.watch(matches)
  var running = false

  function onChange(event, file) {
    if (running){
      log("onchange: Skipped Last action still running.")
      return
    }
    running = true

    // Log the event and the file affected
    if(event != null) {
      log('onchange: ' + event + ' to ' + file.replace(pwd, ''))
    }

    // Generate argument strings from templates
    var filtered = tmpls.map(function (tmpl) {
      return tmpl({ changed: file })
    })

    // Run the command and forward output
    var proc = spawn(command, filtered, {
      stdio: ['ignore', process.stdout, process.stderr]
    })

    // Log the result and unlock
    proc.on('close', function (code) {
      log('onchange: Completed with code ' + code)
      running = false
      log('onchange: ' + watching)
    });
  }

  // For any change, creation or deletion, try to run.
  // However, skip if the last run is still active.
  watcher.on('all', onChange);

  // Let users manually restart with a new line
  var rl = readline.createInterface({
    input: process.stdin,
  });

  rl.on('line', function(line) {
    log('onchange: Manual restart triggered')
    onChange(null, '');
  });
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
