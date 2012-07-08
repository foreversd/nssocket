var net = require('net'),
    nssocket = require('../')

net.createServer(function (socket) {
  setTimeout(function () {
    socket.destroy()
  }, 1000)
}).listen(8345)

nssocket({ reconnect: true }).on('start', function () {
  console.log('start')
}).connect(8345)