console.log(process.argv[2], process.argv[3]);

require("net").createServer().listen();

setTimeout(function () {
  process.exit(0);
}, 1000);
