/*
 * common.js
 *
 * (C) 2011, Nodejitsu Inc.
 */

var fs = require('fs'),
    tls = require('tls'),
    net = require('net'),
    crypto = require('crypto');

//
// ### function createTlsSocket (options)
// #### @options {Object} Tls options like in tls.js
// #### Should behave like tls.connect, except it just creates the socket like net.Socket
// #### Also has a function called 'connect' that will allow` it to connect to a remote host
// this is a rip of tls.js's connect
//
exports.createTlsSocket = function(options, cb) {
  var self = this;
  self.cb = cb;
  // make socket
  var socket = new net.Stream();
  // and context
  var sslcontext = crypto.createCredentials(options);
  // create the pair
  var pair = tls.createSecurePair(sslcontext, false);
  // and join the streams
  var cleartext = pipe(pair, socket);
  // normally connects here
  //socket.connect(port, host);

  pair.on('secure', function() {
    var verifyError = pair.ssl.verifyError();

    if (verifyError) {
      cleartext.authorized = false;
      cleartext.authorizationError = verifyError;
    } else {
      cleartext.authorized = true;
    }
    
    if (self.cb) self.cb();
  });

  cleartext._controlReleased = true;
  // bind a connect, should just make a submission to tls in core
  // but meh~
  cleartext.connect = function (port, host, cb) {
    self.cb = cb || self.cb;
    socket.connect(port,host, self.cb);
  }
  //cleartext.connect = socket.connect;

  // receive bacon
  return cleartext;
};

//
// helper function for createTlsSocket
// 
function pipe(pair, socket) {
  pair.encrypted.pipe(socket);
  socket.pipe(pair.encrypted);

  pair.fd = socket.fd;
  var cleartext = pair.cleartext;
  cleartext.socket = socket;
  cleartext.encrypted = pair.encrypted;
  cleartext.authorized = false;

  function onerror(e) {
    if (cleartext._controlReleased) {
      cleartext.emit('error', e);
    }
  }

  function onclose() {
    socket.removeListener('error', onerror);
    socket.removeListener('close', onclose);
    socket.removeListener('timeout', ontimeout);
  }

  function ontimeout() {
    cleartext.emit('timeout');
  }

  socket.on('error', onerror);
  socket.on('close', onclose);
  socket.on('timeout', ontimeout);

  return cleartext;
}
