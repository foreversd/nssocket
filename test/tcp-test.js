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
    NsSocket = require('../lib/nssocket').NsSocket;

var TCP_PORT = 30103;

var tcpSocket = new net.Socket({ type:'tcp4' }),
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
    topic: new NsSocket(tcpSocket, tcpOpt),
    "should create a wrapped socket": function (instance) {
      assert.instanceOf(instance, NsSocket);
    },
    "should have the proper configuration settings": function (instance) {
      assert.equal(instance._type, tcpOpt.type);
      assert.equal(instance._delimiter, tcpOpt.delimiter);
    },
    "the connect() method": {
      topic: function (instance) {
        var that = this;
        tcpServer.on('connection', this.callback.bind(null, null, instance));
        instance.connect(TCP_PORT);
      },
      "should actually connect": function (_, instance, wrapped) {
        assert.instanceOf(instance, NsSocket);
        assert.instanceOf(wrapped, net.Socket);
      },
      "the write() method": {
        topic: function (instance, wrapped) {
          instance.on('data.}here.}is', this.callback.bind(instance, null));
          wrapped.write(JSON.stringify(['here', 'is', 'something.']));
        },
        "should split the data": function (_, data) {
          assert.isArray(this.event);
          assert.length(this.event, 3);
          assert.isString(this.event[0]);
          assert.isString(this.event[1]);
          assert.isString(this.event[2]);
          assert.isString(data);
          assert.equal(this.event[0], 'data');
          assert.equal(this.event[1], 'here');
          assert.equal(this.event[2], 'is');
          assert.equal(data, 'something.');
        },
        "once idle": {
          topic: function (_, instance, wrapped) {
            instance.once('idle', this.callback.bind(null, null, instance, wrapped));
            instance.setIdle(100);
          },
          "it should emit `idle`": function (_, instance, wrapped) {
            assert.isNull(_);
          },
          "the send() method": {
            topic: function (instance, wrapped) {
              wrapped.on('data', this.callback.bind(null, null, instance, wrapped));
              instance.send(['hello','world'], { some: "json", data: 123 });
            },
            "we should see it on the other end": function (_, instance, wraped, data) {
              assert.isObject(data);
              arr = JSON.parse(data.toString());
              assert.length(arr, 3);
              assert.equal(arr[0], 'hello');
              assert.equal(arr[1], 'world');
              assert.deepEqual(arr[2], { some: "json", data: 123 });
            },
            "the end() method": {
              topic: function (instance, wrapped) {
                instance.on('close', this.callback.bind(null, null, instance, wrapped));
                wrapped.end();
              },
              "should close without errors": function (_, _, _, err) {
                assert.isUndefined(err);
              }
            }
          }
        }
      }
    }
  }
}).export(module);
