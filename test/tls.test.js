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

var TLS_PORT = 30105;
var TLS_OPTIONS = {
  type: 'tls',
  delimiter: '.}',
  key:  fs.readFileSync(path.join(__dirname, 'fixtures', 'ryans-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'ryans-cert.pem')),
  ca:   fs.readFileSync(path.join(__dirname, 'fixtures', 'ryans-csr.pem'))
};

describe('nssocket/tls', function () {
  describe('#()', function () {
    before(function () {
      this.outbound = nssocket({ type: 'tls', delimiter: '.}' });
    });
    it('should create a wrapped socket', function () {
      assert.instanceOf(this.outbound, nssocket);
    });
    it('should have the proper configuration settings', function () {
      assert.equal(this.outbound.type, TLS_OPTIONS.type);
      assert.equal(this.outbound.delimiter, TLS_OPTIONS.delimiter);
    });
  });
  describe('#connect()', function () {
    it('should actually connect', function (done) {
      var self = this;
      self.server = nssocket.createServer(TLS_OPTIONS, function (inbound) {
        self.inbound = inbound;
        done();
      }).listen(TLS_PORT, function () {
        self.outbound.connect(TLS_PORT);
      });
    });
  });
  describe('#setIdle()', function () {
    it('should save idle timeout', function (done) {
      this.outbound.once('idle', done);
      this.outbound.setIdle(100);
    });
  });
  describe('#createMessage()', function () {
    it('should package json into binary messages', function () {
      var rawMessage = this.outbound.createMessage(['foo', 'bar'], { content: 'foobar!' });
      var eventLength = rawMessage.readUInt32BE(0);
      var messageLength = rawMessage.readUInt32BE(4);
      var messagetype = rawMessage.readInt8(8);
      var event = JSON.parse(rawMessage.slice(9, eventLength + 9));
      var data = JSON.parse(rawMessage.slice(9 + eventLength).toString());

      assert.equal(messagetype, 0);
      assert.deepEqual(event, ['foo', 'bar']);
      assert.deepEqual(data, { content: 'foobar!' });
    });
    it('should package buffers into binary messages', function () {
      var rawMessage = this.outbound.createMessage(['foo', 'bar'], Buffer('foo::bar'));
      var eventLength = rawMessage.readUInt32BE(0);
      var messageLength = rawMessage.readUInt32BE(4);
      var messagetype = rawMessage.readInt8(8);
      var event = JSON.parse(rawMessage.slice(9, eventLength + 9));
      var data = rawMessage.slice(9 + eventLength).toString();

      assert.equal(messagetype, 1);
      assert.deepEqual(event, ['foo', 'bar']);
      assert.equal(data.toString(), 'foo::bar');
    });
  });
  describe('#on()', function () {
    it('should handle namespaced events', function (done) {
      var rawMessage = this.outbound.createMessage(['here', 'is'], 'something.');
      this.inbound.once('data.}here.}is', function (data) {
        assert.deepEqual(this.event, ['data', 'here', 'is']);
        assert.equal(data, 'something.');
        done();
      });
      this.outbound.write(rawMessage);
    });
  });
  describe('#send()', function () {
    it('should package and send json messages', function (done) {
      this.inbound.once('data.}hello.}world', function (data) {
        assert.deepEqual(this.event, ['data', 'hello', 'world']);
        assert.deepEqual(data, { content: 'foobar!' });
        done();
      });
      this.outbound.send(['hello','world'], { content: 'foobar!' });
    });
    it('should package and send binary messages', function (done) {
      this.inbound.once('data.}hello.}world', function (data) {
        assert.deepEqual(this.event, ['data', 'hello', 'world']);
        assert.equal(data.toString(), 'foo::bar');
        done();
      });
      this.outbound.send(['hello','world'], Buffer('foo::bar'));
    });
  });
  describe('#end()', function () {
    it('should close the connection', function (done) {
      this.outbound.on('close', done);
      this.inbound.end();
    });
  });
});