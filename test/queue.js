const fs = require("fs");
const join = require("path").join;
const assert = require("assert");
const { onchange } = require("..");

const FIXTURE_DIR = join(__dirname, "__test__");
const OUT_FILE = join(FIXTURE_DIR, "out.txt");
const TEST_FILE = join(FIXTURE_DIR, "test.txt");

// Changes happen faster than the script can execute.
const FILE_CHANGE_INTERVAL = 400;
const SLOW_CHANGE_INTERVAL = 1000;

// Set up test directory before proceeding.
if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR);

function run(cb) {
  const out = fs.createWriteStream(OUT_FILE);
  let count = 0;

  const close = onchange({
    matches: [TEST_FILE],
    command: ["node", "scripts/slow.js", "{{event}}", "{{changed}}"],
    cwd: __dirname,
    stdout: out,
    onReady: () => write(),
  });

  function write() {
    if (count === 10) {
      close();
      return cb(count);
    }

    count++;
    fs.writeFileSync(TEST_FILE, `${count}\n`);
    setTimeout(write, FILE_CHANGE_INTERVAL);
  }
}

function getLines() {
  return fs.readFileSync(OUT_FILE, "utf8").trim().split("\n");
}

run(function (count) {
  const completed = ~~((count * FILE_CHANGE_INTERVAL) / SLOW_CHANGE_INTERVAL);
  const pendingTimeout = (count - completed) * SLOW_CHANGE_INTERVAL + 100; // Hack: small safety margin.

  assert.equal(getLines().length, completed);

  setTimeout(() => {
    assert.equal(getLines().length, count);
  }, pendingTimeout);
});
