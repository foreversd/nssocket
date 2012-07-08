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
    nssocket = require('../')

var TCP_PORT = 30105
var TCP_OPTIONS = {
  type : 'tcp4',
  delimiter: '.}',
  reconnect: true,
  retryInterval: 200
}

describe('nssocket/tcp', function () {
  after(function (done) {
    this.server.close(done)
  })
  describe('#()', function () {
    before(function () {
      this.outbound = nssocket(TCP_OPTIONS)
    })
    it('should create a wrapped socket', function () {
      assert.instanceOf(this.outbound, nssocket)
    })
    it('should have the proper configuration settings', function () {
      assert.equal(this.outbound.type, TCP_OPTIONS.type)
      assert.equal(this.outbound.delimiter, TCP_OPTIONS.delimiter)
    })
  })
  describe('#connect()', function () {
    it('should actually connect', function (done) {
      var self = this
      self.server = nssocket.createServer(TCP_OPTIONS, function (inbound) {
        self.inbound = inbound
        done()
      }).listen(TCP_PORT, function () {
        self.outbound.connect(TCP_PORT)
      })
    })
  })
  describe('#setIdle()', function () {
    it('should save idle timeout', function (done) {
      this.outbound.once('idle', done)
      this.outbound.setIdle(100)
    })
  })
  describe('#createMessage()', function () {
    it('should package json into binary messages', function () {
      var rawMessage = this.outbound.createMessage(['foo', 'bar'], { content: 'foobar!' })
      var eventLength = rawMessage.readUInt32BE(0)
      var messageLength = rawMessage.readUInt32BE(4)
      var messagetype = rawMessage.readInt8(8)
      var event = JSON.parse(rawMessage.slice(9, eventLength + 9))
      var data = JSON.parse(rawMessage.slice(9 + eventLength).toString())

      assert.equal(messagetype, 0)
      assert.deepEqual(event, ['foo', 'bar'])
      assert.deepEqual(data, { content: 'foobar!' })
    })
    it('should package buffers into binary messages', function () {
      var rawMessage = this.outbound.createMessage(['foo', 'bar'], Buffer('foo::bar'))
      var eventLength = rawMessage.readUInt32BE(0)
      var messageLength = rawMessage.readUInt32BE(4)
      var messagetype = rawMessage.readInt8(8)
      var event = JSON.parse(rawMessage.slice(9, eventLength + 9))
      var data = rawMessage.slice(9 + eventLength).toString()

      assert.equal(messagetype, 1)
      assert.deepEqual(event, ['foo', 'bar'])
      assert.equal(data.toString(), 'foo::bar')
    })
  })
  describe('#on()', function () {
    it('should handle namespaced events', function (done) {
      var rawMessage = this.outbound.createMessage(['here', 'is'], 'something.')
      this.inbound.once('data.}here.}is', function (data) {
        assert.deepEqual(this.event, ['data', 'here', 'is'])
        assert.equal(data, 'something.')
        done()
      })
      this.outbound.write(rawMessage)
    })
  })
  describe('#send()', function () {
    it('should package and send json messages', function (done) {
      this.inbound.once('data.}hello.}world', function (data) {
        assert.deepEqual(this.event, ['data', 'hello', 'world'])
        assert.deepEqual(data, { content: 'foobar!' })
        done()
      })
      this.outbound.send(['hello','world'], { content: 'foobar!' })
    })
    it('should package and send binary messages', function (done) {
      this.inbound.once('data.}hello.}world', function (data) {
        assert.deepEqual(this.event, ['data', 'hello', 'world'])
        assert.equal(data.toString(), 'foo::bar')
        done()
      })
      this.outbound.send(['hello','world'], Buffer('foo::bar'))
    })
  })
  describe('#end()', function () {
    it('should close the connection', function (done) {
      this.outbound.on('close', done)
      this.inbound.end()
    })
  })
})