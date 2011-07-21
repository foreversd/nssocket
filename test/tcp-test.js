/*
 * nssocket-test.js : namespace socket unit test for TCP
 *
 *  (C) 2011, Nodejitsu Inc.
 *
 */
 
var fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    spawn = require('child_process').spawn,
    vows = require('vows'),
    net = require('net'),
    nssocket = require('../lib/nssocket').NsSocket;

var TCP_PORT = 30103;

var tcpSocket = new net.Socket({type:'tcp4'}),
    tcpServer = net.createServer(),
    tcpOpt;

tcpOpt = {
  type : 'tcp',
  msgLength : 3,
  delimiter: '.}'
};

tcpServer.listen(TCP_PORT);

vows.describe('nssocket').addBatch({
  "When using NsSocket with TCP": {
    topic: function () {
      var that = this;
      return nssocket(tcpSocket, tcpOpt);
    },
    "should create a wrapped socket": function (socket) {
      assert.instanceOf(socket, nssocket);
    },
    "that has the proper configuration settings" : function (socket) {
      assert.equal(socket._type, tcpOpt.type);
      assert.equal(socket._delimiter, tcpOpt.delimiter);
      assert.equal(socket._msgLen, tcpOpt.msgLength);
    },
    "If we were to connect the socket" : {
      topic : function (socket) {
        var that = this;
        tcpServer.on('connection', this.callback.bind(null,null,socket));
        socket.connect(TCP_PORT);
      },
      "it should actually connect": function (ign, socket, s) {
        assert.instanceOf(socket, nssocket);
        assert.instanceOf(s, net.Socket);
      },
      "without any errors" : function () {
        assert.isTrue(true);
      },
      "and if we were to send data on it": {
        topic : function (socket, s) {
          socket.on('data.}here.}is', this.callback.bind(null,null));
          s.write('here.}is.}something.}');
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
          "If we were to send a message on the socket" : {
            topic : function (socket, s) {
              s.on('data', this.callback.bind(null,null, socket, s));
              socket.send(['hello','world','andsome']);
            },
            "we should see it on the other end" : function (ign, socket, s, data) {
              assert.isObject(data);
              assert.isString(data.toString());
              var arr = data.toString().split(tcpOpt.delimiter);
              assert.length(arr, 4);
              assert.equal(arr[0], 'hello');
              assert.equal(arr[1], 'world');
              assert.equal(arr[2], 'andsome');
              assert.equal(arr[3], '');
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
  }
//}).addBatch({
}).export(module);
