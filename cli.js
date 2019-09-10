#!/usr/bin/env node

var onchange = require('./')
var arrify = require('arrify')
var ignore = require('ignore')
var fs = require('fs')
var path = require('path')

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

var excludePath = typeof argv['exclude-path'] === 'string'
  ? argv['exclude-path']
  : undefined
var exclude = typeof argv.exclude === 'boolean' ? [] : arrify(argv.exclude)

var options = {
  exclude: excludePath ? [...exclude, getExcludeFunction(excludePath, argv.cwd)] : exclude,
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
  awaitWriteFinish: argv['await-write-finish']
}

function getExcludeFunction(excludePath, cwd = process.cwd()) {
  if (isFileSync(excludePath)) {
    var ignorer = ignore()
    ignorer.add(fs.readFileSync(excludePath, 'utf8'))

    return function (changePath) {
      var relPath = path.relative(cwd, changePath)
      return relPath ? ignorer.ignores(relPath) : false
    }
  }

  console.error('Unable to load file from `--exclude-path`:')
  console.error('  ' + path.resolve(excludePath))
  process.exit(1)
}

function isFileSync(path) {
  try {
    return fs.statSync(path).isFile()
  } catch (e) {
    return false
  }
}

if (!command && !options.outpipe) {
  console.error('Remember to pass the command after "--":')
  console.error('  onchange \'**/*.js\' -- echo \'{{changed}}\'')
  process.exit(1)
}

// Start watcher
onchange(matches, command, args, options)
