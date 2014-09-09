var net = require('net');

net.createServer(function (socket) {
    //
    // Close the underlying socket after `1000ms`
    //
    setTimeout(function () {
        socket.destroy();
    }, 1000);

}).listen(3002);