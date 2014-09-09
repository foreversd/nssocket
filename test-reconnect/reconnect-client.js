var nssocket = require('../lib/nssocket');

//
// Create an NsSocket instance with reconnect enabled
//
var socket = new nssocket.NsSocket({
  reconnect: true,
  type: 'tcp4'
});

socket.on('start', function () {
  //
  // The socket will emit this event periodically
  // as it attempts to reconnect
  //
    console.log('hello nssocket reconnect from server:3001');
});

socket.connect(3001);

var socket2 = new nssocket.NsSocket({
    reconnect: true,
    type: 'tcp4'
});

socket2.on('start', function () {
    //
    // The socket will emit this event periodically
    // as it attempts to reconnect
    //
    console.log('hello nssocket reconnect from server:3002');
});

socket2.connect(3002);