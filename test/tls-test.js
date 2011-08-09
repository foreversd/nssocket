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
    nssocket = require('../lib/nssocket').NsSocket,
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
    tlsServer = tls.createServer(serverOpts, console.log),
    tlsOpt;

tlsOpt = {
  type : 'tls',
  msgLength : 3,
  delimiter: '::'
};

vows.describe('orchestra/nssocket').addBatch({
  "When using the Orchestra's NsSocket with TLS": {
    topic: function () {
      var that = this;
      return nssocket(tlsSocket, tlsOpt);
    },
    "should create a wrapped socket": function (socket) {
      assert.instanceOf(socket, nssocket);
    },
    "that has the proper configuration settings" : function (socket) {
      assert.equal(socket._type, tlsOpt.type);
      assert.equal(socket._delimiter, tlsOpt.delimiter);
      assert.equal(socket._msgLen, tlsOpt.msgLength);
    },
    "If we were to connect the socket" : {
      topic : function (socket) {
        var that = this;
        tlsServer.on('secureConnection', this.callback(null,null, socket, s));
        // the above does not work
        tlsServer.on('listening', function () {
          socket.connect(TLS_PORT, '127.0.0.1', function () {
            console.dir('hello');
          });
        });
        tlsServer.listen(TLS_PORT);
      },
      "it should actually connect": function (ign, socket, s) {
        assert.instanceOf(socket, nssocket);
        assert.isTrue(!!s.authorized);
      },
      "without any errors" : function () {
        assert.isTrue(true);
      },
      "and if we were to send data on it": {
        topic : function (socket, s) {
          socket.on('data::here::is', this.callback.bind(null,null));
          s.write('here::is::something::');
        },
        "we should see it show up with the delimiter" : function (ign, datas) {
          assert.isArray(datas);
          assert.length(datas, 3);
          assert.isString(datas[0]);
          assert.isString(datas[1]);
          assert.isString(datas[2]);
          assert.equal(datas[1], 'is');
        },
        "and if we were to set it to idle" : {
          topic : function (_,_,socket,s) {
            socket.once('idle', this.callback.bind(null,null,socket,s));
            socket.setIdle(100);
          },
          "socket emits `idle` event" : function (ign, socket, s) {
          },
          "and if we were to close the socket" : {
            topic : function (socket,s) {
              socket.on('close', this.callback.bind(null,null,socket,s));
              s.end();
            },
            "we should see it close" : function (ign, socket, s) {
              //
            }
          }
        }
      }
    }
  }
}).export(module);
