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

  // Options should be
  // { 
  //   type : 'tcp' or 'tls',
  //   delimiter : '::', delimiter that separates between segments
  //   msgLength : 3 //number of segments in a complete message
  // }

  options = options || {};
 
  // some default options 
  var self = this,
      startName = '',
      dataName = '',
      closeName = '',
      type = this._type = options.type || 'tcp',
      delim = this._delimiter = options.delimiter || '::';
  
  this.socket = socket;
  this.connected = options.connected || socket.writable && socket.readable || false;
  this._msgLen = options.msgLength || 3;
  this._data = '';

  events2.EventEmitter2.call(this, {
    delimiter: delim,
    wildcard: true,
    maxListeners: options.maxListeners || 10
  });

  // because of how TLS works, we have to separate some bindings.
  // the difference is on connection, some socket activities
  if (type === 'tcp') {
    startName = 'connect';
    // create a stub for the setKeepAlive functionality
    self.setKeepAlive = function () {
      socket.setKeepAlive.apply(socket, arguments);
    };
  }
  else if (type === 'tls') {
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
  socket.on(startName, this.emitStart.bind(this));
  socket.on('data',    this.emitData.bind(this));
  socket.on('close',   this.emitClose.bind(this));

  if (socket.socket) {
    // otherwise we get a error passed from net.js
    // they need to backport the fix from v5 to v4
    socket.socket.on('error', this.emitError.bind(this));
  }

  socket.on('error',   this.emitError.bind(this));
  socket.on('timeout', this.emitIdle.bind(this));

};

// Inherit so we can emit, listen on ourself
util.inherits(NsSocket, events2.EventEmitter2);

// 
// ### function emitStart (void)
// emits a start event when the underlying socket finish connecting
// might be used to do other activities
//
NsSocket.prototype.emitStart = function emitStart() {
  this.emit('start');
};

//
// ### function emitData (message)
// #### @message {String} literal message from the data event of the socket
// Messages are assumed to be delimited properly (if using nssocket to send)
// otherwise the delimiter should exist at the end of every message
// We assume messages arrive in order.
//
NsSocket.prototype.emitData = function emitData(message) {
  // this creates an infinite feedback loop, amybe use rawData?
  this.emit('data', message);

  // relative constants
  var d = this._delimiter,
      type = 'data',
      i = 0, length = 0, msgLen = this._msgLen;
  // data types
  var event = type,
      tags = [],
      payload, segment,
      buffer, data;

  // dummy handle to the buffer to shove the data into
  // add incoming to the buffer.
  this.socket.pause();
  this._data += message.toString();
  this.socket.resume();
  buffer = this._data;
  
  // check if we have enough to parse a message
  // maybe use counts of?
  data = buffer.split(d);
  length = data.length;

  while (length > msgLen) {
    // payload is the 'DATA' portion of the message
    payload = data[this._msgLen-1];
    
    for (i = 0; i < this._msgLen - 1; i++) {
      segment = data.shift();
      length--;
      // we push to both tags/event
      // this allows us to have the event name separate from the msgData
      tags.push(segment);
      // apparently faster?
      event += d + segment;
    }

    // append the data to the tags
    // tags.push(payload);
    length--;
    data.shift();
    // now shorten the buffer by the amount of data being emitted
    // payload + event + the type.length

    this.socket.pause();
    this._data = this._data.substr(payload.length + event.length - type.length + d.length);
    this.socket.resume();

    // emit the event with tags (parsed msg packet)
    this.emit(event, tags, payload);

    // reset the values
    event = [type];
    tags = [];
  }
};

//
// ### function emitClose (had_error)
// #### @had_error {Boolean} true if there was an error, which then include the
// actual error included by the underlying socket
//
NsSocket.prototype.emitClose = function emitClose(had_error) {
  had_error = had_error || false;
  if (had_error) {
    this.emit('close', had_error, arguments[1]);
  }
  else {
    this.emit('close');
  }
  this.connected = false;
};

//
// ### function emitError (error)
// #### @error {Error} emits and error event in place of the socket
// Error event is raise with an error if there was one
//
NsSocket.prototype.emitError = function (error) {
  this.connected = false;
  if (error) {
    this.emit('error', error);
  } 
  else {
    this.emit('error', new Error('An Unknown Error occured'));
  }
};

//
// ### function send (data, callback)
// #### @tag {Array} The array that holds the tag name
// #### @data {String} The data to be sent with the event
// #### @callback {Function} the callback function when send is done sending
// The send function follows write/send rules for TCP/TLS/UDP
// in that the callback is called when sending is complete, not when delivered
NsSocket.prototype.send = function send(tag, data, callback) {

  var args = arguments,
      msg, buff;

  // rebinds
  if (typeof tag === 'string') {
    tag = [tag];
  }
  if (!data || typeof data === 'function') {
    callback = data;
    data = tag.pop();
  }

  // if we aren't connected/socketed, then error
  if (!this.socket || !this.connected) {
    this.emit('error', new Error("NsSocket: sending on a bad socket"));
  }
  else {
    // don't modify the input
    msg = tag.concat(data, '');
    buff = Buffer(msg.join(this._delimiter));
        
    // emit the send event
    this.emit('send', data, callback);
  
    // now actually write to the socket
    this.socket.write(buff, callback);
  }
};

// 
// ### function setIdle (time, callback)
// #### @time {Integer} how often to emit idle 
// Set the idle/timeout timer
NsSocket.prototype.setIdle = function setIdle(time) {
  this.socket.setTimeout(time);
  this._timeout = time;
};

// 
// ### function emitIdle (void) 
// #### Emits the idle event (based on timeout)
//
NsSocket.prototype.emitIdle = function emitIdle() {
  this.emit('idle');
  if (this._timeout) {
    this.socket.setTimeout(this._timeout);
  }
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
  var had_err;
  this.connected = false;

  if (this.socket) {
    try {
      this.socket.end()
    }
    catch (ex) {
      this.emit('error', ex);
      had_err = true;
      return
    }
    this.socket = null;
  }
  return had_err ? this.emit('close', had_err) : this.emit('close');
};

//
// ### function connect (/*port, host, callback*/) 
// A passthrough to the underlying socket's connect function
//
NsSocket.prototype.connect = function connect(/*port, host, callback*/) {
  if (this._type === 'tcp') {
    this.socket.connect.apply(this.socket, arguments);
    this.connected = true;
  }
  else if (this._type === 'tls') {
    this.socket.connect.apply(this.socket, arguments);
    this.connected = true;
  }
  else {
    this.emit('error', new Error('Unknown Socket Type'));
  }
}
