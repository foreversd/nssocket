/*
 * nssocker.js - Wraps a TLS/TCP socket to emit namespace events also auto-buffers.
 * nssocket
 * (C) 2011, Nodejitsu Inc.
 */

var util     = require('util'),
    events2 = require('eventemitter2');

//
// ### function NsSocket (socket, options)
// #### @socket {Object} TCP or TLS 'socket' either from a 'connect' 'new' or from a server 
// #### @options {Object} Options for this NsSocket
// NameSpace Socket, NsSocket, is a thin wrapper above TLS/TCP.
// It provides automatic buffering and name space based data emits.
// 
var NsSocket = exports.NsSocket = function (socket, options) {
  if (!(this instanceof NsSocket)) {
    return new NsSocket(socket, options);
  }

  // There has to be a socket to wrap
  if (!socket) {
    this.emit('error', new Error('Cannot wrap undefined socket.'));
    return null;
  }

  //
  // Options should be
  //
  //    { 
  //      type : 'tcp' or 'tls',
  //      delimiter : '::', delimiter that separates between segments
  //      msgLength : 3 //number of segments in a complete message
  //    }
  //
  options = options || {};
 
  // some default options 
  var self = this,
      startName;

  this.socket     = socket;
  this.connected  = options.connected || socket.writable && socket.readable || false;
  
  //
  // Setup default instance variables.
  //
  this._type      = options.type || 'tcp',
  this._delimiter = options.delimiter || '::';
  this._buffer    = '';

  events2.EventEmitter2.call(this, {
    delimiter: this._delimiter,
    wildcard: true,
    maxListeners: options.maxListeners || 10
  });

  //
  // Because of how the code node.js `tls` module works, we have 
  // to separate some bindings. The main difference is on 
  // connection, some socket activities.
  //
  if (this._type === 'tcp') {
    startName = 'connect';
    // create a stub for the setKeepAlive functionality
    self.setKeepAlive = function () {
      socket.setKeepAlive.apply(socket, arguments);
    };
  }
  else if (this._type === 'tls') {
    startName = 'secureConnection';
    // create a stub for the setKeepAlive functionality
    self.setKeepAlive = function () {
      socket.socket.setKeepAlive.apply(socket.socket, arguments);
    }
  }
  else {
    // bad arguments, so throw an error
    this.emit('error', new Error('Bad Option Argument [type]'));
    return null;
  }

  // make sure we listen to the underlying socket
  socket.on(startName, this._onStart.bind(this));
  socket.on('data',    this._onData.bind(this));
  socket.on('close',   this._onClose.bind(this));

  if (socket.socket) {
    //
    // otherwise we get a error passed from net.js
    // they need to backport the fix from v5 to v4
    //
    socket.socket.on('error', this._onError.bind(this));
  }

  socket.on('error',   this._onError.bind(this));
  socket.on('timeout', this._onIdle.bind(this));
};

//
// Inherit from `events2.EventEmitter2`.
//
util.inherits(NsSocket, events2.EventEmitter2);

//
// ### function send (data, callback)
// #### @event {Array|string} The array (or string) that holds the event name
// #### @data {Literal|Object} The data to be sent with the event.
// #### @callback {Function} the callback function when send is done sending
// The send function follows write/send rules for TCP/TLS/UDP
// in that the callback is called when sending is complete, not when delivered
//
NsSocket.prototype.send = function send(event, data, callback) {
  var dataType = typeof data,
      buff,
      msg;

  // rebinds
  if (typeof event === 'string') {
    event = event.split(this._delimiter);
  }
  
  if (dataType === 'undefined' || dataType === 'function') {
    callback = data;
    data = null;
  }

  // if we aren't connected/socketed, then error
  if (!this.socket || !this.connected) {
    return this.emit('error', new Error('NsSocket: sending on a bad socket'));
  }

  // now actually write to the socket
  this.socket.write(Buffer(JSON.stringify(event.concat(data))), callback);
};

// 
// ### function setIdle (time, callback)
// #### @time {Integer} how often to emit idle 
// Set the idle/timeout timer
//
NsSocket.prototype.setIdle = function setIdle(time) {
  this.socket.setTimeout(time);
  this._timeout = time;
};


//
// ### function destroy (void)
// #### forcibly destroys this nsSocket, unregister socket, remove all callbacks
//
NsSocket.prototype.destroy = function destroy() {
  // this should be forcibly remove EVERY listener
  this.removeAllListeners();

  if (this.socket) {
    try {
      this.socket.end(); // send FIN
      this.socket.destroy(); // make sure fd's are gone
    }
    catch (ex) {
      // do nothing on errors
    }
  }
  // this may lead to memory leaks?
  // delete this.socket;

  // clear buffer
  this.data = '';
  this.emit('destroy');
};

//
// ### function end (void)
// #### closes the underlying socket, recommend you call destroy after
//
NsSocket.prototype.end = function end() {
  var hadErr;
  this.connected = false;

  if (this.socket) {
    try {
      this.socket.end();
    }
    catch (ex) {
      this.emit('error', ex);
      hadErr = true;
      return;
    }
    
    this.socket = null;
  }
  
  return this.emit('close', hadErr || undefined);
};

//
// ### function connect (/*port, host, callback*/) 
// A passthrough to the underlying socket's connect function
//
NsSocket.prototype.connect = function connect(/*port, host, callback*/) {
  var args = Array.prototype.slice.call(arguments),
      self = this,
      callback,
      host,
      post;

  args.forEach(function handle(arg) {
    var type = typeof arg;
    switch (type) {
      case 'number':
        port = arg;
        break;
      case 'string':
        host = arg;
        break;
      case 'function':
        callback = arg;
        break;
      default:
        self.emit('error', new Error('bad argument to connect'));
        break;
    }
  });

  host = host || '127.0.0.1';
  this._connectOpts = [port, host, callback];

  if (['tcp', 'tls'].indexOf(this._type) === -1) {
    return this.emit('error', new Error('Unknown Socket Type'));
  }

  this.socket.connect.apply(this.socket, arguments);
  this.connected = true;
};


// 
// ### @private function _onStart ()
// Emits a start event when the underlying socket finish connecting
// might be used to do other activities.
//
NsSocket.prototype._onStart = function _onStart() {
  this.emit('start');
};

//
// ### @private function _onData (message)
// #### @message {String} literal message from the data event of the socket
// Messages are assumed to be delimited properly (if using nssocket to send)
// otherwise the delimiter should exist at the end of every message
// We assume messages arrive in order.
//
NsSocket.prototype._onData = function _onData(message) {
  var parsed,
      payload;
  
  this._buffer += message;
  
  try {
    parsed = JSON.parse(this._buffer);
    data = parsed.pop();
    this._buffer = '';
    this.emit(['data'].concat(parsed), data)
  }
  catch (err) {
    //
    // Don't do anything, assume that the message is only partially
    // received.  
    //
  }
};

//
// ### @private function _onClose (hadError)
// #### @hadError {Boolean} true if there was an error, which then include the
// actual error included by the underlying socket
//
NsSocket.prototype._onClose = function _onClose(hadError) {
  if (hadError) {
    this.emit('close', hadError, arguments[1]);
  }
  else {
    this.emit('close');
  }
  
  this.connected = false;
};

//
// ### @private function _onError (error)
// #### @error {Error} emits and error event in place of the socket
// Error event is raise with an error if there was one
//
NsSocket.prototype._onError = function _onError(error) {
  this.connected = false;
  this.emit('error', error || new Error('An Unknown Error occured'));
};

// 
// ### @private function _onIdle () 
// #### Emits the idle event (based on timeout)
//
NsSocket.prototype._onIdle = function _onIdle() {
  this.emit('idle');
  if (this._timeout) {
    this.socket.setTimeout(this._timeout);
  }
};