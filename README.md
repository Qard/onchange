# onchange

[![Greenkeeper badge](https://badges.greenkeeper.io/Qard/onchange.svg)](https://greenkeeper.io/)

Use glob patterns to watch file sets and run a command when anything is added, changed or deleted.

## Install

```sh
npm install onchange
```

## Usage

```sh
onchange 'app/**/*.js' 'test/**/*.js' -- npm test
```

NOTE: Windows users may need to use double quotes rather than single quotes. If used in an npm script, remember to escape the double quotes.

You can match as many glob patterns as you like, just put the command you want to run after the `--` and it will run any time a file matching any of the globs is added changed or deleted.

To use the event and file that changed, use `{{event}}` or `{{changed}}` anywhere in the command after `--`. For example:

```sh
onchange '**/*.js' -- echo '{{event}} to {{changed}}'
```

## Options

### Verbose (`-v`, `--verbose`)

Enable if you want verbose logging from `onchange` (useful for debugging). For example:

```sh
onchange 'app/**/*.js' 'test/**/*.js' -v -- npm test
```

### Initial (`-i`, `--initial`)

To execute the command on the first run (no change), include the `-i` flag: For example:

```sh
onchange '**/*.js' -i -- npm start
```

### Exclude (`-e`, `--exclude`)

To exclude matches (`**/node_modules/**` is excluded by default, use `--no-exclude` to disable):

```sh
onchange '**/*.ts' -e 'dist/**/*.js' -- tslint
```

### Wait (`-w`, `--wait`)

To wait for the current process to exit between restarts:

```sh
onchange '**/*.js' -w -- npm test
```

### Delay (`-d`, `--delay`)

To set the amount of delay (in ms) between process restarts:

```sh
onchange '**/*.js' -d 1000 -- npm start
```

### Poll (`-p`, `--poll`)

Use polling to monitor for changes. Omitting the interval will default to 100ms. This option is useful if you're watching an NFS volume.

```sh
onchange '**/*.js' -p -- npm test
```

### Outpipe (`-o`, `--outpipe`)

Shell command to execute every change:

```sh
onchange 'src/**/*.js' -o '> .change' -- echo '{{event}} to {{changed}}'
```

**P.S.** When a command is used with `--outpipe`, the `stdout` from the command will be piped into `outpipe`.

### Filter (`-f`, `--filter`)

By default, onchange watch for all events from [chokidar](https://github.com/paulmillr/chokidar#methods--events). Use
this option to watch only for events you need:

```sh
onchange '**/*.js' -f add -f change -- npm start
```

You can separate events to listen with comas if you prefer:

```sh
onchange '**/*.js' -f add,change -- npm start
```

Or with spaces:

```sh
onchange '**/*.js' -f 'add change' -- npm start
```

## TypeScript

Includes [types](index.d.ts) for TypeScript users.

---

### Copyright (c) 2013 Stephen Belanger

#### Licensed under MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
