# onchange

Use glob patterns to watch file sets and run a command when anything is added, changed or deleted.

## Install

```sh
npm install onchange
```

## Usage

```sh
# On every change run `npm test`.
onchange 'app/**/*.js' 'test/**/*.js' -- npm test

# On every change restart `server.js` (by killing the running process).
onchange -i -k '**/*.js' -- node server.js

# On every change `echo` file change.
onchange '**/*.js' -- echo '{{event}} to {{changed}}'
```

NOTE: Windows users may need to use double quotes rather than single quotes. If used in an npm script, remember to escape the double quotes.

You can match as many glob patterns as you like, just put the command you want to run after the `--` and it will run any time a file matching any of the globs is added changed or deleted.

## Options

### Verbose (`-v`, `--verbose`)

Enable if you want verbose logging from `onchange` (useful for debugging). For example:

```sh
onchange -v 'app/**/*.js' 'test/**/*.js' -- npm test
```

### Add (`-a`, `--add`)

To execute the command for all initially added paths:

```sh
onchange -a 'config.json' -- microservice-proxy -c {{changed}} -p 9000
```

### Initial (`-i`, `--initial`)

To execute the command once on load without any event:

```sh
onchange -i '**/*.js' -- npm start
```

### Exclude (`-e`, `--exclude`)

To exclude matches (`**/node_modules/**` is excluded by default, use `--no-exclude` to disable):

```sh
onchange '**/*.ts' -e 'dist/**/*.js' -- tslint
```

**P.S.** When you exclude something, it overrides the default, so if you want to keep `**/node_modules/**` excluded, then you need to add it to the command explicitly.

### Kill (`-k`, `--kill`)

To kill current and pending processes between changes:

```sh
onchange -k '**/*.js' -- npm test
```

### Jobs (`-j`, `--jobs`)

Set the maximum concurrent processes to run (default is `1`):

```sh
onchange -j2 '**/*.js' -- cp -v -r '{{changed}}' 'test/{{changed}}'
```

### Delay (`-d`, `--delay`)

To set the amount of delay (in ms) between process changes:

```sh
onchange -d 1000 '**/*.js' -- npm start
```

### Await Write Finish (`--await-write-finish <ms>`)

To hold the events until the size does not change for a configurable amount of time (in ms, default is [`2000`](https://www.npmjs.com/package/chokidar#performance)):

```sh
onchange --await-write-finish 1500 '**/*.js' -- npm test
```

### Poll (`-p <ms>`, `--poll <ms>`)

Use polling to monitor for changes. This option is useful if you're watching an NFS volume.

```sh
onchange -p 100 '**/*.js' -- npm test
```

### Outpipe (`-o`, `--outpipe`)

Shell command to execute every change:

```sh
onchange -o '> .changelog' 'src/**/*.js' -- echo '{{event}} to {{changed}}'
```

**P.S.** When a command is used with `--outpipe`, the `stdout` from the command will be piped into `outpipe`.

### Filter (`-f`, `--filter`)

By default, onchange watch for all events from [chokidar](https://github.com/paulmillr/chokidar#methods--events). Use
this option to watch only for events you need:

```sh
onchange -f 'add change' '**/*.js' -- npm start
```

## TypeScript

Includes [types](index.d.ts) for TypeScript users.

## Related

* [cli-error-notifier](https://github.com/micromata/cli-error-notifier) - Send native desktop notifications if a command exits with an exit code other than `0`.

---

### Copyright (c) 2013 Stephen Belanger

#### Licensed under MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
