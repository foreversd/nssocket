/*
 * create-server-test.js : namespace socket unit test for TLS.
 *
 * (C) 2011, Nodejitsu Inc.
 *
 */

var net = require('net'),
    tls = require('tls'),
    fs = require ('fs'),
    path = require('path'),
    assert = require('chai').assert,
    nssocket = require('../');

var TCP_PORT = 30105;
var TCP_OPTIONS = {
  type : 'tcp4',
  delimiter: '.}',
  reconnect: true,
  retryInterval: 200
};

describe('nssocket/tcp/reconnect', function () {
  after(function (done) {
    this.server.close(done);
    this.outbound.end();
    this.inbound.end();
  });
  describe('client', function () {
    it('should connect', function (done) {
      var self = this;
      self.outbound = nssocket(TCP_OPTIONS).connect(TCP_PORT);
      self.server = nssocket.createServer(TCP_OPTIONS, done.bind(null, null));
      setTimeout(function () {
        self.server.listen(TCP_PORT);
      }, 200);
    });
    it('should handle reconnection', function (done) {
      var self = this;
      self.server.close(function () {
        self.server = nssocket.createServer(TCP_OPTIONS, function (inbound) {
          self.inbound = inbound;
          done();
        }).listen(TCP_PORT);
      });
      self.outbound.end();
    });
    it('should be able to send after reconnection', function (done) {
      this.outbound.once('data.}here.}is', function (data) {
        assert.deepEqual(this.event, ['data', 'here', 'is']);
        assert.equal(data, 'something.');
        done();
      });
      this.inbound.send('here.}is', 'something.');
    });
  });
});