/*
 * nssocket-test.js : namespace socket unit test for TCP
 *
 * (C) 2011, Nodejitsu Inc.
 *
 */
 
var assert = require('assert'),
    fs = require('fs'),
    net = require('net'),
    path = require('path'),
    vows = require('vows'),
    NsSocket = require('../lib/nssocket').NsSocket;

var TCP_PORT = 30103;

var tcpServer = net.createServer(),
    tcpOpt;

tcpOpt = {
  type : 'tcp4',
  delimiter: '.}'
};

tcpServer.listen(TCP_PORT);

vows.describe('nssocket/tcp').addBatch({
  "When using NsSocket with TCP": {
    topic: new NsSocket(tcpOpt),
    "should create a wrapped socket": function (outbound) {
      assert.instanceOf(outbound, NsSocket);
    },
    "should have the proper configuration settings": function (outbound) {
      assert.equal(outbound._type, tcpOpt.type);
      assert.equal(outbound._delimiter, tcpOpt.delimiter);
    },
    "the connect() method": {
      topic: function (outbound) {
        var that = this;
        tcpServer.on('connection', this.callback.bind(null, null, outbound));
        outbound.connect(TCP_PORT);
      },
      "should actually connect": function (_, outbound, inbound) {
        assert.instanceOf(outbound, NsSocket);
        assert.instanceOf(inbound, net.Socket);
      },
      "the on() method": {
        topic: function (outbound, inbound) {
          outbound.on('data.}here.}is', this.callback.bind(outbound, null));
          inbound.write(Buffer('0000000d0000000c005b2268657265222c226973225d22736f6d657468696e672e22', 'hex'));
        },
        "should handle namespaced events": function (_, data) {
          assert.isArray(this.event);
          assert.lengthOf(this.event, 3);
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
          topic: function (_, outbound, inbound) {
            outbound.once('idle', this.callback.bind(null, null, outbound, inbound));
            outbound.setIdle(100);
          },
          "it should emit `idle`": function (_, outbound, inbound) {
            assert.isNull(_);
          },
          "the send() method": {
            topic: function (outbound, inbound) {
              inbound.on('data', this.callback.bind(null, null, outbound, inbound));
              outbound.send(['hello','world'], Buffer('foo::bar'));
            },
            "we should see it on the other end": function (_, outbound, wraped, data) {
              assert.isObject(data);
              event = JSON.parse(data.slice(9, 26).toString());
              data = data.slice(26).toString();
              assert.lengthOf(event, 2);
              assert.equal(event[0], 'hello');
              assert.equal(event[1], 'world');
              assert.deepEqual(data, 'foo::bar');
            },
            "the end() method": {
              topic: function (outbound, inbound) {
                outbound.on('close', this.callback.bind(null, null, outbound, inbound));
                inbound.end();
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
