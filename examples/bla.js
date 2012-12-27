var nss = require('../');

var sockets = [];

//
// Server code for foo.js to connect to
//
nss.createServer(function (socket) {
  sockets.push(socket);
  socket.ondata('connecting', function (data) {
    console.log('There are now', sockets.length);
    sockets.forEach(function (s) {
      if (socket !== socket) {
        s.send('broadcasting', data);
      }
    });
   console.dir(data);
 });
}).listen(4949);