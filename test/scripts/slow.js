require('net').createServer().listen()

console.log(process.argv[2], process.argv[3])

setTimeout(function () {
  process.exit(0)
}, 1000)
