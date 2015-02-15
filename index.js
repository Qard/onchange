#!/usr/bin/env node
var spawn = require('cross-spawn').spawn
var chokidar = require('chokidar')

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
console.log('watching', matches.join(', '))

// Ignore node_modules folders, as they eat CPU like crazy
matches.push('!**/node_modules/**')

var watcher = chokidar.watch( matches );
var running = false;

watcher.on('ready', function(){
  console.log( 'File scan completed' );
  // For any change, creation or deletion, try to run.
  // However, skip if the last run is still active.
  watcher.on('all', function (event, file) {
    if (running) return;
    running = true;

    // Log the event and the file affected
    console.log(event, file.replace(pwd, ''))

    // Run the command and forward output
    var proc = spawn(command, args, {
      stdio: ['ignore', process.stdout, process.stderr]
    })

    // Log the result and unlock
    proc.on('close', function (code) {
      console.log('completed with code', code)
      running = false;
    })
  })
});
