const fs = require("fs");
const join = require("path").join;
const assert = require("assert");
const { onchange } = require("..");

const FIXTURE_DIR = join(__dirname, "__test__");
const OUT_FILE = join(FIXTURE_DIR, "out.txt");
const TEST_FILE = join(FIXTURE_DIR, "test.txt");

const FILE_CHANGE_INTERVAL = 400;

// Set up test directory before proceeding.
if (!fs.existsSync(FIXTURE_DIR)) fs.mkdirSync(FIXTURE_DIR);

function run(cb) {
  const out = fs.createWriteStream(OUT_FILE);
  let count = 0;

  const close = onchange({
    matches: [TEST_FILE],
    command: ["node", "scripts/slow.js", "{{event}}", "{{changed}}"],
    jobs: 10,
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
  assert.equal(getLines().length, count);
});
