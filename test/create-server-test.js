/*
 * create-server-test.js : namespace socket unit test for TLS.
 *
 * (C) 2011, Nodejitsu Inc.
 *
 */
 
var assert = require('assert'),
    fs = require('fs'),
    net = require('net'),
    path = require('path'),
    tls = require('tls'),
    vows = require('vows'),
    nssocket = require('../lib/nssocket');

var PORT = 9564;

vows.describe('nssocket/create-server').addBatch({
  "When using NsSocket": {
    "the createServer() method": {
      topic: function () {
        var outbound = new nssocket.NsSocket(),
            server = nssocket.createServer(this.callback.bind(null, null, outbound));
            
        server.listen(PORT);
        outbound.connect(PORT);
      },
      "should create a full-duplex namespaced socket": {
        topic: function (outbound, inbound) {
          outbound.on(['data', 'here', 'is'], this.callback.bind(outbound, null));
          inbound.send(['here', 'is'], 'something.');
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
      }
    }
  }
}).export(module);
