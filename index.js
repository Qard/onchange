const treeKill = require('tree-kill')
const { resolve } = require('path')
const { exec } = require('child_process')
const { spawn } = require('cross-spawn')
const chokidar = require('chokidar')
const arrify = require('arrify')
const { Deque } = require('@blakeembrey/deque')

const ECHO_CMD = `${process.execPath} ${resolve(__dirname, 'echo.js')}`

/**
 * Export `onchange` function.
 */
module.exports = onchange

/**
 * Execute a "job" on each change event.
 */
class Job {
  constructor (command, args, outpipe, options) {
    this.command = command
    this.args = args
    this.outpipe = outpipe
    this.options = options
  }

  start (cwd, log, stdout, stderr, onexit) {
    if (this.outpipe) {
      const cmd = this.outpipe(opts)

      log(`executing outpipe "${cmd}"`)

      this.childOutpipe = exec(cmd, { cwd })

      // Must pipe stdout and stderr.
      this.childOutpipe.stdout.pipe(stdout)
      this.childOutpipe.stderr.pipe(stderr)

      this.childOutpipe.on('exit', (code, signal) => {
        log(`outpipe ${exitmsg(code, signal)}`)
        this.childOutpipe = undefined
        if (!this.childCommand) return onexit()
      })
    }

    if (this.command) {
      // Generate argument strings from templates.
      const cmd = this.args.map(tmpl => tmpl(this.options))
      const stdio = ['ignore', this.childOutpipe ? this.childOutpipe.stdin : stdout, stderr]

      log(`executing command "${[this.command].concat(cmd).join(' ')}"`)

      // Spawn child command. If `outpipe`, pipe `stdout` through `outpipe`.
      this.childCommand = spawn(this.command, cmd, { cwd, stdio })

      this.childCommand.on('exit', function (code, signal) {
        log(`command ${exitmsg(code, signal)}`)
        this.childCommand = undefined
        if (!this.childOutpipe) return onexit()
      })
    } else {
      // No data to write to `outpipe`.
      childOutpipe.stdin.end()
    }
  }

  kill (log, killSignal) {
    if (this.childOutpipe) {
      log(`killing outpipe ${this.childOutpipe.pid}`)
      treeKill(this.childOutpipe.pid, killSignal)
    }

    if (this.childCommand) {
      log(`killing command ${this.childOutpipe.pid}`)
      treeKill(this.childCommand.pid, killSignal)
    }
  }
}

function onchange (match, command, rawargs, opts = {}) {
  const matches = arrify(match)
  const ready = opts.ready || (() => undefined)
  const initial = !!opts.initial
  const kill = !!opts.kill
  const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd()
  const stdout = opts.stdout || process.stdout
  const stderr = opts.stderr || process.stderr
  const delay = Math.max(opts.delay | 0, 0)
  const jobs = Math.max(opts.jobs | 0, 1)
  const killSignal = opts.killSignal || 'SIGTERM'
  const args = rawargs ? rawargs.map(tmpl) : []
  const outpipe = typeof opts.outpipe === 'string' ? outpipetmpl(opts.outpipe) : undefined
  const filter = opts.filter || []
  const awaitWriteFinish = !!opts.awaitWriteFinish
  const running = new Set()
  const queue = new Deque()

  // Logging.
  const log = opts.verbose ? function log (message) {
    stdout.write('onchange: ' + message + '\n')
  } : function () {}

  // Invalid, nothing to run on change.
  if (!command && !outpipe) {
    throw new TypeError('Expected "command" and/or "outpipe" to be specified')
  }

  // Create the "watcher" instance for file system changes.
  const watcher = chokidar.watch(matches, {
    cwd: cwd,
    ignored: opts.exclude || [],
    usePolling: opts.poll === true || typeof opts.poll === 'number',
    interval: typeof opts.poll === 'number' ? opts.poll : undefined,
    awaitWriteFinish: awaitWriteFinish
  })

  /**
   * Try and dequeue the next job to run.
   */
  function dequeue () {
    // Nothing to process.
    if (queue.size === 0) return

    // Too many jobs running already.
    if (running.size >= jobs) return

    const item = queue.popLeft()
    running.add(item)

    // Start the process and remove when finished.
    item.start(cwd, log, stdout, stderr, () => {
      running.delete(item)
      if (delay > 0) return setTimeout(dequeue, delay)
      return dequeue()
    })
  }

  /**
   * Enqueue the next change event to run.
   */
  function enqueue (event, changed) {
    // Kill all existing tasks on `enqueue`.
    if (kill) {
      queue.clear() // Remove pending ("killed") tasks.
      running.forEach(child => child.kill(killSignal)) // Kill running tasks.
    }

    // Log the event and the file affected.
    log(`"${changed}" -> ${event}`)

    // Add item to job queue.
    queue.push(new Job(command, args, outpipe, { event, changed }))

    // Try to immediately run the enqueued job.
    return dequeue()
  }

  watcher.on('ready', () => {
    log(`watching ${matches.join(', ')}`)

    // Execute initial event without any changes.
    if (initial) enqueue('', '')

    // For any change, creation or deletion, try to run.
    watcher.on('all', (event, changed) => {
      if (filter.length && filter.indexOf(event) === -1) return

      return enqueue(event, changed)
    })

    // Notify external listener for "ready".
    ready()
  })

  watcher.on('error', (error) => log(`watcher error: ${error}`))
}

// Double mustache template generator.
function tmpl (str) {
  return function (data) {
    return str.replace(/{{([^{}]+)}}/g, function (_, key) {
      return data[key]
    })
  }
}

// Template generator for `outpipe` option.
function outpipetmpl (str) {
  var value = str.trim()

  if (value.charAt(0) === '|' || value.charAt(0) === '>') {
    return tmpl(`${ECHO_CMD} ${value}`)
  }

  return tmpl(value)
}

// Simple exit message generator.
function exitmsg (code, signal) {
  return code == null ? `exited with ${signal}` : `completed with code ${code}`
}
