# NsSocket
  NameSpace based Event based Buffered TCP/TLS Stream

## Purpose
  Wrap a network socket to change (text-based) network communication into events

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
 <pre>
 // default values of config, if not specified
 config = {
   type : 'tcp',
   delimiter : '::',
   connected : false,
   msgLength : 3,
   maxListeners : 10,
 }
 </pre>

### NsSocket.send(nameArray, data)
 - `nameArray` Array describing the namespace, e.g. `['some', 'namespace']`
 - `data` string data, (use of `JSON.stringify` and `JSON.parse` is highly recommended)
 *Do Not Use your delimiter in your nameArray or data*

### NsSocket.on(event, callback)
 - `event` name of the event
 - `callback` - the callback function
 Register callbacks to events on this NsSocket

### NsSocket.emit(event, [data], ...)
 - `event` event to emit
 *use at your own risk*
 It is recommended that you do not emit events on the nssocket itself.

### NsSocket.connect(port, [host], [callback])
 - `port` destination port
 - `host` destination host, ip or hostname
 - `callback` callback on successful `connect`
This is a very thin wrapper around `net` or `tls`

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

#### data::some::names ...
`function (nameArray, data) {}`
Emitted once when a full message has been received on the socket, the output
 corresponds to the input given to `NsSocket.send`

e.g.
<pre>
nsSocket.on('data::some::evented', function (tags, data) {
  console.log('Got a message in space: ', tags);
  console.log('With the data of: ', data);
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
  nsSocket.send(
    ['hello', 'world'], 
    JSON.stringify({ foo:1, bar:2 })
  );
  console.dir('sent!');  
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
