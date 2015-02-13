#!/usr/bin/env node
var spawn = require('cross-spawn').spawn
var gaze = require('gaze')
var debug = require('debug')('onchange')
var log = debug;

// Shift node and script name out of argv
process.argv.shift()
process.argv.shift()

// Setup some storage variables
var pwd = process.cwd()
var matches = []
var arg

// Print usage info
if (!process.argv.length || process.argv == '--help') {
  console.log('Usage:  onchange [file]... -- <command> [arg]...');
  process.exit();
}

// Shift everything before -- into match list
while ((arg = process.argv.shift()) !== '--') {
  matches.push(arg)
}

// Shift first thing after to command and use the rest as args
var command = process.argv.shift()
var args = process.argv

// Notify the user what they are watching
log('watching ' + matches.join(', '))

// Ignore node_modules folders, as they eat CPU like crazy
matches.push('!**/node_modules/**')

// Start the watch
gaze(matches, function () {
  var running = false;

  // For any change, creation or deletion, try to run.
  // However, skip if the last run is still active.
  this.on('all', function (type, file) {
    if (running) return;
    running = true;

    // Log the event type and the file affected
    log(type + ' ' + file.replace(pwd, ''))

    // Run the command and forward output
    var proc = spawn(command, args, {
      stdio: ['ignore', process.stdout, process.stderr]
    })

    // Log the result and unlock
    proc.on('close', function (code) {
      log('completed with code ' + code)
      running = false;
    })
  })
})
