#!/usr/bin/env node
var spawn = require('cross-spawn').spawn
var log = require('debug')('onchange')
var chokidar = require('chokidar')

// Parse argv with minimist...it's easier this way.
var argv = require('minimist')(process.argv.slice(2), {
  '--': true
})

// Print usage info
if ( ! argv._.length || argv.help) {
  console.log('Usage:  onchange [file]... -- <command> [arg]...')
  process.exit()
}

// Setup some storage variables
var arg
var pwd = process.cwd()
var matches = argv._

// Build exclusion list
var excludes = []
if (Array.isArray(argv.exclude)) {
  excludes = argv.exclude
} else if (argv.exclude) {
  excludes = [argv.exclude]
}

excludes.forEach(function (exclude) {
  matches.push('!' + exclude)
})

// Shift first thing after to command and use the rest as args
var args = argv['--']
var command = args.shift()

// Convert arguments to templates
var tmpls = args.map(tmpl)

// Notify the user what they are watching
log('watching ' + matches.join(', '))

// Ignore node_modules folders, as they eat CPU like crazy
matches.push('!**/node_modules/**')

// Start watcher
var watcher = chokidar.watch(matches)
watcher.on('ready', function () {
  var running = false

  // For any change, creation or deletion, try to run.
  // However, skip if the last run is still active.
  watcher.on('all', function (event, file) {
    if (running) return
    running = true

    // Log the event and the file affected
    log(event + ' ' + file.replace(pwd, ''))

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
      log('completed with code ' + code)
      running = false
    })
  })
})

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
