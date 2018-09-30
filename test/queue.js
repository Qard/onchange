const fs = require('fs')
const join = require('path').join
const assert = require('assert')
const onchange = require('..')

const FIXTURE_DIR = join(__dirname, '__test__')
const OUT_FILE = join(FIXTURE_DIR, 'out.txt')
const TEST_FILE = join(FIXTURE_DIR, 'test.txt')

const FILE_CHANGE_INTERVAL = 400
const SLOW_CHANGE_INTERVAL = 1000

// Set up test directory before proceeding.
if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR)

function run (cb) {
  const out = fs.createWriteStream(OUT_FILE)
  let count = 0

  onchange([TEST_FILE], 'node', ['scripts/slow.js', '{{event}}', '{{changed}}'], {
    poll: true,
    cwd: __dirname,
    stdout: out,
    ready: () => write()
  })

  function write () {
    if (count === 10) return cb(count)

    count++
    fs.writeFileSync(TEST_FILE, `${count}\n`)
    setTimeout(write, FILE_CHANGE_INTERVAL)
  }
}

function getlines () {
  return fs.readFileSync(OUT_FILE, 'utf8').trim().split('\n')
}

run(function (count) {
  const completed = ~~(count * FILE_CHANGE_INTERVAL / SLOW_CHANGE_INTERVAL)
  const pendingTimeout = (count - completed) * SLOW_CHANGE_INTERVAL

  assert.equal(getlines().length, completed)

  setTimeout(() => {
    assert.equal(getlines().length, count)

    process.exit(0)
  }, pendingTimeout)
})