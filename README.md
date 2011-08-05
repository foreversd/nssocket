# NsSocket
  NameSpace based Event based Buffered TCP/TLS Stream

## Purpose
  Wrap a network socket with automatic buffering to simply network string communication into events

## Major Dependency
NsSocket Inherits from [eventemitter2](http://github.com/hij1nx/EventEmitter2.git)

## Installation
<pre>
npm install nssocket
or
git clone git@github.com:nodejitsu/nssocket.git
</pre>

## API

### new nssocket.NsSocket(socket, config)
 - `socket` network (tcp or tls) socket
 - `config` config options for this NsSocket

### NsSocket.send(dataArray)
 - `dataArray` Array object that will be sent, should not include `delimiter`

### NsSocket.on(event, callback)
 - `event` name of the event
 - `callback` - the callback function
 Register callbacks to events on this NsSocket

### NsSocket.emit(event, [data], ...)
 - `event` event to emit
 *use at your own risk*

### NsSocket.connect(port, [host], [callback])
 - `port` destination port
 - `host` destination host, ip or hostname
 - `callback` callback on successful `connect`

### NsSocket.end()
 - closes the current socket, emits `close` event, possibly also `error`

### NsSocket.destroy()
 - remove all listeners, destroys socket, clears buffer
 - should normally use `NsSocket.end()`

### Events

#### start
`function () {}`

Emitted once the underlying socket has connected/started
#### data
`function (data) {}`
Emitted on raw data received on the underlying socket

#### data :: * :: ...
`function (dataArray) {}`
Emitted once when a full message has been received on the socket,
`DataArray` will be an `Array` object with items corresponding to the segments
of the message

e.g. `some::evented:blahbblahblah` would be caught with
<pre>
nsSocket.on('data::some::evented', function (datas) {
  console.log(datas);
}
</pre>

#### error
`function (err) {}`

Emitted when there are any errors
#### close 
`function (had_err) {}`

Emitted when the underlying connection is closed, `had_err` will be true if
there were any errors.
#### idle
emitted when the socket has been idle,
only emitted if `setKeepAlive` or `setTimeout` has been bound

## Usage Demo
```javascript
var net = require('net'),
    nssocket = require('nssocket');

// Config object
var config = {
  delimiter : '::' // default (recommended)
  type : 'tcp' // default (tcp, tls)
  msgLength : 3 // default (can be any length, technically even 1)
};

// socket gets wrapped
var socket = new net.Socket({ type: 'tcp4'}),
    nsSocket = nssocket.NsSocket(socket, config);

nsSocket.connect(80, '127.0.0.1', function onConnect() {
  // pass in an array
  nsSocket.send(['hello', 'world', 'derp']);
  console.dir('success!');  
});
```

## Coming soon
- More & Better Tests
- Make Demo in examples/
- Add automatic socket creation (no more passing in sockets!)
- Add UDP support
- Add nssocket.Server functionality (returns a nssocket!)
- Cake(?)

## Demo
  TBA

### Maintainers
[Paolo Fragmenti](https://github.com/hij1nx),
[Jameson Lee](https://github.com/drjackal)

### License
MIT?
