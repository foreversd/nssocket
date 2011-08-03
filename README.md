# NsSocket
  NameSpace based Event based Buffered TCP/TLS Stream

## Purpose
  Wrap a network socket with automatic buffering and parsing such that you can
  simply network level transactions into events

## Major Dependency

[eventemitter2](http://github.com/hij1nx/eventemitter2.git)

## Installation
<pre>
npm install nssocket
or
git clone git@github.com:nodejitsu/nssocket.git
</pre>

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
</pre>
```

 **THE LAST FIELD IS ALWAYS ASSUMED TO BE THE DATA**

 **THE LAST FIELD IS ALWAYS ASSUMED TO BE THE DATA**

 **THE LAST FIELD IS ALWAYS ASSUMED TO BE THE DATA**

## API
 the API is available via the proto file:
 [Proto-API](http://github.com/nodejitsu/nssocket/tree/master/doc/proto.nssocket)

## Coming soon
- Add UDP support
- Add automatic socket creation (no more passing in sockets!)
- Add nssocket.Server functionality (returns a nssocket!)
- Cake(?)

## Demo
  TBA

### Maintainers
Paolo Fragmenti,
Jameson Lee

### License
MIT?
