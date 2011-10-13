/*
 * nssocket-test.js : namespace socket unit test for TLS.
 *
 *  (C) 2011, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    spawn = require('child_process').spawn,
    vows = require('vows'),
    tls = require('tls'),
    NsSocket = require('../lib/nssocket').NsSocket,
    helper = require('./helper');

var TLS_PORT = 50305,
    CA_NAME = 'snake-oil';

var serverOpts = {
  key:            fs.readFileSync(path.join(__dirname, 'CA', CA_NAME+'-key.pem')),
  cert:           fs.readFileSync(path.join(__dirname, 'CA', CA_NAME+'-cert.pem')),
  //ca:           fs.readFileSync(conf.tls.ca),
  requestCert:    true,
  rejectUnauthorized: false
};

var tlsSocket = helper.createTlsSocket(serverOpts),
    tlsServer = tls.createServer(serverOpts),
    tlsOpt;

tlsOpt = {
  type:      'tls',
  delimiter: '::'
};

tlsServer.listen(TLS_PORT);
tlsServer.on('listening', function () {
  console.dir('wtf fuuuu');
})

vows.describe('nssocket').addBatch({
  "When using NsSocket with TLS": {
    topic: new NsSocket(tlsSocket, tlsOpt),
    "should create a wrapped socket": function (instance) {
      assert.instanceOf(instance, NsSocket);
    },
    "that has the proper configuration settings": function (instance) {
      assert.equal(instance._type, tlsOpt.type);
      assert.equal(instance._delimiter, tlsOpt.delimiter);
    },
    "the connect() method": {
      topic: function (instance) {
        var that = this;
        console.dir('here first?');
        tlsServer.on('secureConnection', this.callback.bind(null, null, instance));
        instance.connect(TLS_PORT);
      },
      "it should actually connect": function (_, instance, wrapped) {
        assert.instanceOf(instance, NsSocket);
        assert.isTrue(!!wrapped.authorized);
      },
      "and if we were to send data on it": {
        topic: function (socket, s) {
          socket.on('data::here::is', this.callback.bind(null, null));
          s.write('here::is::something::');
        },
        "we should see it show up with the delimiter": function (_, datas) {
          assert.isArray(datas);
          assert.length(datas, 3);
          assert.isString(datas[0]);
          assert.isString(datas[1]);
          assert.isString(datas[2]);
          assert.equal(datas[1], 'is');
        },
        "and if we were to set it to idle": {
          topic: function (_, _, socket, s) {
            socket.once('idle', this.callback.bind(null, null, socket, s));
            socket.setIdle(100);
          },
          "socket emits `idle` event": function (_, socket, s) {
          },
          "and if we were to close the socket": {
            topic: function (socket, s) {
              socket.on('close', this.callback.bind(null, null, socket, s));
              s.end();
            },
            "we should see it close": function (_, socket, s) {
              //
            }
          }
        }
      }
    }
  }
}).export(module);
