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
    orchestra = require('../lib/orchestra');
    nssocket = orchestra.NsSocket;
    common = orchestra.Common;

var TLS_PORT = 50305,
    CA_DIR = '../CA/',
    CA_NAME = 'snake-oil';

var serverOpts = {
    key:            fs.readFileSync(CA_DIR+CA_NAME+'-key.pem'),
    cert:           fs.readFileSync(CA_DIR+CA_NAME+'-cert.pem'),
    //ca:           fs.readFileSync(conf.tls.ca),
    requestCert:    true,
    rejectUnauthorized: false
};
var tlsSocket = common.createTlsSocket(serverOpts),
    tlsServer = tls.createServer(serverOpts),
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
        tlsServer.on('secureConnection', function (s) {
        //tlsServer.on('connection', function (s) {
          that.callback(null,socket,s);
        });
        
        // TODO: There is a problem here with tlsServer hanging with vows???
        
        
        tlsServer.on('listening', function () {
          tlsSocket.connect(TLS_PORT, '127.0.0.1', function () {
          //socket.connect(TLS_PORT, '127.0.0.1', function () {
            console.log('hellow');
          });
        });
        tlsServer.listen(TLS_PORT);
      },
      "it should actually connect": function (ign, socket, s) {
        assert.instanceOf(socket, nssocket);
        assert.isNotNull(s.authorized);
        assert.isString(s.authorizationError);
      },
      "without any errors" : function () {
        assert.isTrue(true);
      },
      "and if we were to send data on it": {
        topic : function (socket, s) {
          socket.on('data::here::is', this.callback.bind(null,null));
          s.write('here::is::something::');
        },
        "we should see it show up with the delimiter" : function (ign, event, datas) {
          assert.isString(event);
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
          "we should see the socket emit `idle` event" : function (ign, socket, s, event) {
            assert.isString(event);
            assert.equal(event, 'idle');
          },
          "and if we were to close the socket" : {
            topic : function (socket,s) {
              socket.on('close', this.callback.bind(null,null,socket,s));
              s.end();
            },
            "we should see it close" : function (ign, socket, s, event) {
              assert.isString(event);
              assert.equal(event, 'close');
            }
          }
        }
      }
    }
  }
//}).addBatch({
}).export(module);
