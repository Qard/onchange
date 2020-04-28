#!/usr/bin/env node

import { onchange } from ".";
import ignore from "ignore";
import { readFileSync, statSync } from "fs";
import { resolve, relative } from "path";
import arg from "arg";

// Extract `onchange` args and command args after `--`.
const [argv, command] = getArgs(process.argv.slice(2));

const args = arg(
  {
    "--add": Boolean,
    "--await-write-finish": Number,
    "--cwd": String,
    "--delay": Number,
    "--exclude-path": String,
    "--exclude": [String],
    "--filter": [String],
    "--help": Boolean,
    "--initial": Boolean,
    "--jobs": Number,
    "--kill-signal": String,
    "--kill": Boolean,
    "--no-exclude": Boolean,
    "--outpipe": String,
    "--poll": Number,
    "--verbose": Boolean,
    "-a": "--add",
    "-c": "--cwd",
    "-d": "--delay",
    "-e": "--exclude",
    "-f": "--filter",
    "-h": "--help",
    "-i": "--initial",
    "-j": "--jobs",
    "-k": "--kill",
    "-o": "--outpipe",
    "-p": "--poll",
    "-v": "--verbose",
  },
  {
    argv,
  }
);

const {
  _: matches,
  "--add": add,
  "--await-write-finish": awaitWriteFinish,
  "--cwd": cwd = process.cwd(),
  "--delay": delay,
  "--exclude-path": excludePath,
  "--filter": filter,
  "--help": help,
  "--initial": initial,
  "--jobs": jobs,
  "--kill-signal": killSignal,
  "--kill": kill,
  "--outpipe": outpipe,
  "--poll": poll,
  "--verbose": verbose,
} = args;
const exclude = getExclude(cwd, args["--exclude"], args["--exclude-path"]);
const defaultExclude = !args["--no-exclude"];

// Print usage info
if (!args._.length || help) {
  console.log("Usage: onchange [...file] -- <command> [...args]");
  process.exit();
}

if (excludePath) {
  exclude.push(getExcludeFunction(excludePath, cwd));
}

// Validate command or outpipe is specified.
if (!command.length && !outpipe) {
  console.error('Remember to pass the command after "--":');
  console.error("  onchange '**/*.js' -- echo '{{changed}}'");
  process.exit(1);
}

// Validate kill signal.
if (
  killSignal !== undefined &&
  killSignal !== "SIGINT" &&
  killSignal !== "SIGKILL"
) {
  console.error('Kill signal must be one of "SIGINT", "SIGKILL".');
  process.exit(1);
}

// Start watcher.
onchange({
  add,
  awaitWriteFinish,
  command,
  cwd,
  defaultExclude,
  delay,
  exclude,
  filter,
  initial,
  jobs,
  kill,
  killSignal,
  matches,
  outpipe,
  poll,
  verbose,
});

function getExclude(cwd: string, exclude?: string[], excludePath?: string) {
  if (!excludePath) return exclude || [];
  const excludeFn = getExcludeFunction(cwd, excludePath);
  if (exclude) return [...exclude, excludeFn];
  return [excludeFn];
}

/**
 * Build an exclude function from path.
 */
function getExcludeFunction(cwd: string, excludePath: string) {
  if (isFileSync(excludePath)) {
    const ignorer = ignore();
    ignorer.add(readFileSync(excludePath, "utf8"));

    return function (path: string) {
      const relPath = relative(cwd, path);
      return relPath ? ignorer.ignores(relPath) : false;
    };
  }

  console.error("Unable to load file from `--exclude-path`:");
  console.error("  " + resolve(excludePath));
  process.exit(1);
}

/**
 * Check if a file exists.
 */
function isFileSync(path: string) {
  try {
    return statSync(path).isFile();
  } catch (e) {
    return false;
  }
}

/**
 * Get program args from `argv`.
 */
function getArgs(args: string[]): [string[], string[]] {
  const index = args.indexOf("--");
  if (index) return [args.slice(0, index), args.slice(index + 1)];
  return [args, []];
}
