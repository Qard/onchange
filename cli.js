#!/usr/bin/env node
var onchange = require('./')
var log = require('debug')('onchange')

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

// Notify the user what they are watching
log('watching ' + matches.join(', '))

// Ignore node_modules folders, as they eat CPU like crazy
matches.push('!**/node_modules/**')

// Start watcher
onchange(matches, command, args)
