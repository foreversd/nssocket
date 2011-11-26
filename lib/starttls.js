/*
 * starttls.js
 *
 * this module helps to upgrade the socket from TCP to a TLS connection,
 * originally written by Nathan Rajlich and improved by Bradley Meck.
 * (C) 2011, Nodejitsu Inc.
 *
 */

var fs = require('fs'),
    tls = require('tls'),
    net = require('net'),
    crypto = require('crypto');

exports.createSocket = function (options) {
  options = options || {};
  options.type = options.type || 'tcp4';
  
  return options.type === 'tls' 
    ? exports.createTlsSocket(options)
    : new net.Socket(options);
};

//
// ### function setupTlsPipe(options, socket)
// #### @options {Object} Tls options like in tls.js
// #### @socket {Object} The actual socket that was created by instantiating net.Stream
// Create the TLS pair and Pipe the TLS pair to the TCP socket
//
function setupTlsPipe (options, socket) {
  var sslcontext = crypto.createCredentials(options),
      pair = tls.createSecurePair(sslcontext, false),
      cleartext = pipe(pair, socket);
      
  pair.on('secure', function() {
    var verifyError = pair.ssl.verifyError();

    if (verifyError) {
      cleartext.authorized = false;
      cleartext.authorizationError = verifyError;
    } 
    else {
      cleartext.authorized = true;
    }
  });

  //
  // Setup the cleartext stream to have a `.connect()` method
  // which passes through to the underlying TCP socket.
  //
  socket.cleartext = cleartext;
  cleartext._controlReleased = true;
}

//
// ### function createTlsSocket (options)
// #### @options {Object} Tls options like in tls.js
// #### Should behave like tls.connect, except it just creates the socket like net.Socket
// #### Also has a function called 'connect' that will allow` it to connect to a remote host
//
exports.createTlsSocket = function(options) {

  // 
  // Setup the TLS connection over the existing TCP connection by
  // creating a new instance of `net.Socket` and then passing the
  // in a set of credentials with `options`.
  // 
  var socket = new net.Stream({ type: 'tcp4' });

  socket.on('connect', function () {
    setupTlsPipe(options, socket);
  });

  return socket;
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
