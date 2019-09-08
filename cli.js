#!/usr/bin/env node

const onchange = require('./')
const arrify = require('arrify')
const { readFileSync, lstatSync, existsSync } = require('fs')

// Parse argv with minimist...it's easier this way.
const argv = require('minimist')(process.argv.slice(2), {
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
const matches = argv._.slice()
const args = argv['--'].slice()
const command = args.shift()

// Init config ignored files
const ignorePathDefault = './.onchangeignore'
const ignorePath = typeof argv['ignore-path'] === 'string'
  ? argv['ignore-path']
  : ignorePathDefault
const exclude = typeof argv.exclude === 'boolean' ? [] : arrify(argv.exclude)

const options = {
  exclude: getExcludeMergedWithIgnoreFile(exclude, ignorePath),
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

function getExcludeMergedWithIgnoreFile(exclude = [], ignorePath = ignorePathDefault) {
  if(existsSync(ignorePath)) {

    if (!lstatSync(ignorePath).isFile()) {
      console.warn("Only file path is allowed in flag '--ignore-path'! Ignoring flag.")
      return exclude
    }
    
    const ignoreFileString = readFileSync(ignorePath).toString('utf-8')
    const ignoreFileArray = ignoreFileString.replace(/^#[^\r\n]+\r?\n/gm, '').split(/\r?\n/)
    
    const ignoredSet = new Set([...ignoreFileArray, ...exclude])
    
    ignoredSet.delete('')

    return [...ignoredSet]
  }

  return exclude
}

if (!command && !options.outpipe) {
  console.error('Remember to pass the command after "--":')
  console.error('  onchange \'**/*.js\' -- echo \'{{changed}}\'')
  process.exit(1)
}

// Start watcher
onchange(matches, command, args, options)
