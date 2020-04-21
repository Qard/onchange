const treeKill = require('tree-kill')
const { resolve } = require('path')
const { exec } = require('child_process')
const { spawn } = require('cross-spawn')
const chokidar = require('chokidar')
const arrify = require('arrify')
const { Deque } = require('@blakeembrey/deque')
const { supportsColor } = require('supports-color')

const ECHO_JS_PATH = resolve(__dirname, 'echo.js')
const ECHO_CMD = `${quote(process.execPath)} ${quote(ECHO_JS_PATH)}`

/**
 * Export `onchange` function.
 */
module.exports = onchange

/**
 * Execute a "job" on each change event.
 */
class Job {
  constructor (log, command, args, outpipe, options) {
    this.log = log
    this.command = command
    this.args = args
    this.outpipe = outpipe
    this.options = options
  }

  start (cwd, stdout, stderr, jobEnv, onexit) {
    const color = supportsColor(stdout)
    const env = Object.assign({ FORCE_COLOR: color.level }, jobEnv)

    if (this.outpipe) {
      const cmd = this.outpipe(this.options)
      const stdio = [null, stdout, stderr]

      this.log(`executing outpipe "${cmd}"`)
      this.childOutpipe = exec(cmd, { cwd, env, stdio })

      this.childOutpipe.on('exit', (code, signal) => {
        this.log(`outpipe ${exitmsg(code, signal)}`)
        this.childOutpipe = undefined
        if (!this.childCommand) return onexit()
      })
    }

    if (this.command) {
      // Generate argument strings from templates.
      const cmd = this.args.map(tmpl => tmpl(this.options))
      const stdio = [null, this.childOutpipe ? this.childOutpipe.stdin : stdout, stderr]

      this.log(`executing command "${[this.command].concat(cmd).join(' ')}"`)
      this.childCommand = spawn(this.command, cmd, { cwd, env, stdio })

      this.childCommand.on('exit', (code, signal) => {
        this.log(`command ${exitmsg(code, signal)}`)
        this.childCommand = undefined
        if (!this.childOutpipe) return onexit()
        return this.childOutpipe.stdin.end()
      })
    } else {
      // No data to write to `outpipe`.
      this.childOutpipe.stdin.end()
    }
  }

  kill (killSignal) {
    if (this.childOutpipe) {
      this.log(`killing outpipe ${this.childOutpipe.pid}`)
      treeKill(this.childOutpipe.pid, killSignal)
    }

    if (this.childCommand) {
      this.log(`killing command ${this.childCommand.pid}`)
      treeKill(this.childCommand.pid, killSignal)
    }
  }
}

function onchange (match, command, rawArgs, opts = {}) {
  const matches = arrify(match)
  const ready = opts.ready || (() => undefined)
  const initial = !!opts.initial
  const kill = !!opts.kill
  const cwd = opts.cwd ? resolve(opts.cwd) : process.cwd()
  const stdout = opts.stdout || process.stdout
  const stderr = opts.stderr || process.stderr
  const env = opts.env || process.env
  const delay = Math.max(opts.delay | 0, 0)
  const jobs = Math.max(opts.jobs | 0, 1)
  const killSignal = opts.killSignal || 'SIGTERM'
  const args = rawArgs ? rawArgs.map(template) : []
  const outpipe = typeof opts.outpipe === 'string' ? outpipeTemplate(opts.outpipe) : undefined
  const filter = opts.filter || []
  const awaitWriteFinish = typeof opts.awaitWriteFinish === 'number'
    ? { stabilityThreshold: opts.awaitWriteFinish }
    : !!opts.awaitWriteFinish
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
    ignoreInitial: opts.add !== true,
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

    // Remove first job from queue (FIFO).
    const job = queue.popLeft()

    // Add job to running set.
    running.add(job)

    // Start the process and remove when finished.
    job.start(cwd, stdout, stderr, env, () => {
      running.delete(job)
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
    queue.push(new Job(log, command, args, outpipe, { event, changed }))

    // Try to immediately run the enqueued job.
    return dequeue()
  }

  // Execute initial event without any changes.
  if (initial) enqueue('', '')

  // For any change, creation or deletion, try to run.
  watcher.on('all', (event, changed) => {
    if (filter.length && filter.indexOf(event) === -1) return

    return enqueue(event, changed)
  })

  // On ready, prepare triggers.
  watcher.on('ready', () => {
    log(`watching ${matches.join(', ')}`)

    // Notify external listener of "ready" event.
    return ready()
  })

  watcher.on('error', (error) => log(`watcher error: ${error}`))
}

// Double mustache template generator.
function template (str) {
  return function (data) {
    return str.replace(/{{([^{}]+)}}/g, function (_, key) {
      return data[key]
    })
  }
}

// Template generator for `outpipe` option.
function outpipeTemplate (str) {
  var value = str.trim()

  if (value.charAt(0) === '|' || value.charAt(0) === '>') {
    return template(`${ECHO_CMD} ${value}`)
  }

  return template(value)
}

// Simple exit message generator.
function exitmsg (code, signal) {
  return code == null ? `exited with ${signal}` : `completed with ${code}`
}

/**
 * Quote value for `exec`.
 */
function quote (str) {
  return `"${str.replace(/["\\$`!]/g, '\\$&')}"`
}
