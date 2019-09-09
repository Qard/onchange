#!/usr/bin/env node

var onchange = require('./')
var arrify = require('arrify')
var ignore = require('ignore')
var { relative } = require('path')
var { readFileSync, lstatSync, existsSync } = require('fs')

// Parse argv with minimist...it's easier this way.
var argv = require('minimist')(process.argv.slice(2), {
  '--': true,
  boolean: ['v', 'i', 'k', 'a'],
  string: ['e', 'c', 'killSignal'],
  alias: {
    add: 'a',
    jobs: 'j',
    kill: 'k',
    verbose: 'v',
    initial: 'i',
    exclude: 'e',
    cwd: 'c',
    delay: 'd',
    poll: 'p',
    outpipe: 'o',
    filter: 'f'
  },
  default: {
    exclude: '**/node_modules/**'
  }
})

// Print usage info
if (!argv._.length || argv.help) {
  console.log('Usage: onchange [...file] -- <command> [...args]')
  process.exit()
}

// Setup some storage variables
var matches = argv._.slice()
var args = argv['--'].slice()
var command = args.shift()

// Init config ignored files
var ignorePathDefault = './.onchangeignore'
var ignorePath = typeof argv['ignore-path'] === 'string'
  ? argv['ignore-path']
  : ignorePathDefault
var exclude = typeof argv.exclude === 'boolean' ? [] : arrify(argv.exclude)

var options = {
  exclude: getIgnoreFunction(exclude, ignorePath),
  verbose: argv.verbose,
  add: argv.add,
  initial: argv.initial,
  jobs: argv.jobs,
  kill: argv.kill,
  cwd: argv.cwd,
  delay: argv.delay,
  poll: argv.poll,
  killSignal: argv.killSignal,
  outpipe: argv.outpipe,
  filter: argv.filter && (Array.isArray(argv.filter) ? argv.filter : argv.filter.split(/\W+/)),
  awaitWriteFinish: argv['await-write-finish'],
  ignorePath
}

function getIgnoreFunction(exclude = [], ignorePath = ignorePathDefault) {
  var ignorer = ignore().add(exclude)

  var functionIgnore = (path) => {
    var relativePath = relative(process.cwd(), path)
    return relativePath && ignorer.ignores(relativePath)
  }

  if(existsSync(ignorePath)) {
    if (!lstatSync(ignorePath).isFile()) {
      console.warn("Only file path is allowed in flag '--ignore-path'! Ignoring flag.")
      return functionIgnore
    }
    ignorer.add(readFileSync(ignorePath).toString('utf-8'))
  }

  return functionIgnore
}

if (!command && !options.outpipe) {
  console.error('Remember to pass the command after "--":')
  console.error('  onchange \'**/*.js\' -- echo \'{{changed}}\'')
  process.exit(1)
}

// Start watcher
onchange(matches, command, args, options)
