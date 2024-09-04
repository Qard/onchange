import treeKill from "tree-kill";
import { resolve, dirname, extname, basename } from "path";
import { ChildProcess } from "child_process";
import { spawn } from "cross-spawn";
import chokidar from "chokidar";
import { Writable, Readable } from "stream";
import { Deque } from "@blakeembrey/deque";
import { template, Template } from "@blakeembrey/template";

const ECHO_JS_PATH = resolve(__dirname, "echo.js");
const ECHO_CMD = `${quote(process.execPath)} ${quote(ECHO_JS_PATH)}`;

/**
 * State used for `onchange` commands.
 */
interface State {
  event: string;
  /** @deprecated use file instead */
  changed: string;
  file: string;
  fileExt: string;
  fileBase: string;
  fileBaseNoExt: string;
  fileDir: string;
}

/**
 * Execute a "job" on each change event.
 */
class Job {
  childCommand: ChildProcess | undefined;
  childOutpipe: ChildProcess | undefined;

  constructor(
    public log: (value: string) => void,
    public command: string[],
    public outpipe?: string,
  ) {}

  start(
    cwd: string,
    stdin: Readable,
    stdout: Writable,
    stderr: Writable,
    env: NodeJS.ProcessEnv,
    onexit: () => void,
  ) {
    if (this.outpipe) {
      const stdio = [null, stdout, stderr];

      this.log(`executing outpipe "${this.outpipe}"`);
      this.childOutpipe = spawn(this.outpipe, { cwd, env, stdio, shell: true });

      this.childOutpipe.on("exit", (code, signal) => {
        this.log(`outpipe ${exitMessage(code, signal)}`);
        this.childOutpipe = undefined;
        if (!this.childCommand) return onexit();
      });
    }

    if (this.command.length) {
      const stdio = [
        stdin,
        // Use `--outpipe` when specified, otherwise direct to `stdout`.
        this.childOutpipe ? this.childOutpipe.stdin : stdout,
        stderr,
      ];

      this.log(`executing command "${this.command.join(" ")}"`);
      this.childCommand = spawn(this.command[0], this.command.slice(1), {
        cwd,
        env,
        stdio,
      });

      this.childCommand.on("exit", (code, signal) => {
        this.log(`command ${exitMessage(code, signal)}`);
        this.childCommand = undefined;
        if (!this.childOutpipe) return onexit();
        return this.childOutpipe?.stdin?.end();
      });
    } else {
      // No data to write to `outpipe`.
      this.childOutpipe?.stdin?.end();
    }
  }

  kill(killSignal?: NodeJS.Signals) {
    if (this.childOutpipe?.pid) {
      this.log(`killing outpipe ${this.childOutpipe.pid}`);
      treeKill(this.childOutpipe.pid, killSignal);
    }

    if (this.childCommand?.pid) {
      this.log(`killing command ${this.childCommand.pid}`);
      treeKill(this.childCommand.pid, killSignal);
    }
  }
}

/**
 * Onchange configuration options.
 */
export interface Options {
  add?: boolean;
  awaitWriteFinish?: number;
  command?: string[];
  cwd?: string;
  defaultExclude?: boolean;
  delay?: number;
  env?: NodeJS.ProcessEnv;
  exclude?: (string | ((path: string) => boolean))[];
  filter?: string[];
  initial?: boolean;
  jobs?: number;
  kill?: boolean;
  killSignal?: NodeJS.Signals;
  matches: string[];
  onReady?: () => void;
  outpipe?: string;
  poll?: number;
  stderr?: Writable;
  stdin?: Readable;
  stdout?: Writable;
  verbose?: boolean;
}

/**
 * Onchange manages
 */
export function onchange(options: Options): () => void {
  const { matches } = options;
  const onReady = options.onReady || (() => undefined);
  const initial = !!options.initial;
  const kill = !!options.kill;
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const stdin: Readable = options.stdin || process.stdin;
  const stdout: Writable = options.stdout || process.stdout;
  const stderr: Writable = options.stderr || process.stderr;
  const env = options.env || process.env;
  const delay = Math.max(options.delay || 0, 0);
  const jobs = Math.max(options.jobs || 0, 1);
  const killSignal = options.killSignal || "SIGTERM";
  const command = options.command
    ? options.command.map((arg) => template<State>(arg))
    : [];
  const outpipe = options.outpipe
    ? outpipeTemplate(options.outpipe)
    : undefined;
  const filter = options.filter || [];
  const running = new Set<Job>();
  const queue = new Deque<Job>();

  // Logging.
  const log = options.verbose
    ? function log(message: string) {
        stdout.write(`onchange: ${message}\n`);
      }
    : function () {};

  // Invalid, nothing to run on change.
  if (command.length === 0 && !outpipe) {
    throw new TypeError('Expected "command" and/or "outpipe" to be specified');
  }

  const ignored = options.exclude || [];
  const ignoreInitial = options.add !== true;
  const usePolling = options.poll !== undefined;
  const interval = options.poll !== undefined ? options.poll : undefined;
  const awaitWriteFinish = options.awaitWriteFinish
    ? { stabilityThreshold: options.awaitWriteFinish }
    : undefined;

  // Add default excludes to the ignore list.
  if (options.defaultExclude !== false) {
    ignored.push("**/node_modules/**", "**/.git/**");
  }

  // Create the "watcher" instance for file system changes.
  const watcher = chokidar.watch(matches, {
    cwd,
    ignored,
    ignoreInitial,
    usePolling,
    interval,
    awaitWriteFinish,
  });

  /**
   * Try and dequeue the next job to run.
   */
  function dequeue() {
    // Nothing to process.
    if (queue.size === 0) return;

    // Too many jobs running already.
    if (running.size >= jobs) return;

    // Remove first job from queue (FIFO).
    const job = queue.popLeft();

    // Add job to running set.
    running.add(job);

    // Start the process and remove when finished.
    job.start(cwd, stdin, stdout, stderr, env, () => {
      running.delete(job);
      if (delay > 0) return setTimeout(dequeue, delay);
      return dequeue();
    });
  }

  /**
   * Enqueue the next change event to run.
   */
  function enqueue(event: string, file: string) {
    const fileExt = extname(file);
    const state: State = {
      event,
      changed: file,
      file,
      fileExt,
      fileBase: basename(file),
      fileBaseNoExt: basename(file, fileExt),
      fileDir: dirname(file),
    };

    // Kill all existing tasks on `enqueue`.
    if (kill) {
      queue.clear(); // Remove pending ("killed") tasks.
      running.forEach((child) => child.kill(killSignal)); // Kill running tasks.
    }

    // Log the event and the file affected.
    log(`${file}: ${event}`);

    // Add item to job queue.
    queue.push(
      new Job(
        log,
        command.map((arg) => arg(state)),
        outpipe?.(state),
      ),
    );

    // Try to immediately run the enqueued job.
    return dequeue();
  }

  // Execute initial event without any changes.
  if (initial) enqueue("", "");

  // For any change, creation or deletion, try to run.
  watcher.on("all", (event, file) => {
    if (filter.length && filter.indexOf(event) === -1) return;

    return enqueue(event, file);
  });

  // On ready, prepare triggers.
  watcher.on("ready", () => {
    log(`watcher ready`);

    // Notify external listener of "ready" event.
    return onReady();
  });

  watcher.on("error", (error: Error) => log(`watcher error: ${error}`));

  // Return a close function.
  return () => watcher.close();
}

// Template generator for `outpipe` option.
function outpipeTemplate(str: string): Template<State> {
  var value = str.trim();

  if (value.charAt(0) === "|" || value.charAt(0) === ">") {
    return template<State>(`${ECHO_CMD} ${value}`);
  }

  return template<State>(value);
}

// Simple exit message generator.
function exitMessage(code: number | null, signal: string | null) {
  return code === null ? `exited with ${signal}` : `completed with ${code}`;
}

/**
 * Quote value for `exec`.
 */
function quote(str: string) {
  return `"${str.replace(/["\\$`!]/g, "\\$&")}"`;
}
