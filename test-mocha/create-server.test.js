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

var PORT = 9568
var HOST = '127.0.0.1'
var PIPE = path.join(__dirname, 'fixtures', 'nssocket.sock')
var HOSTNAME = 'localhost'

describe('nssocket/create-server', function () {
  describe('#createServer()', function () {
    before(function() {
      try { fs.unlinkSync(PIPE) }
      catch (err) {}
    })
    afterEach(function (done) {
      this.server.close(done)
      this.outbound.end()
      this.inbound.end()
    })
    it('should create a full-duplex namespaced socket / (PORT)', testWith(PORT))
    it('should create a full-duplex namespaced socket / (PORT, HOST)', testWith(PORT, HOST))
    it('should create a full-duplex namespaced socket / (PORT, HOSTNAME)', testWith(PORT, HOSTNAME))
    it('should create a full-duplex namespaced socket / (PIPE)', testWith(PIPE))
  })
})

function testWith() {
  var args = [].slice.call(arguments)

  return function (done) {
    var self = this
    self.outbound = new nssocket.NsSocket()
    self.server = nssocket.createServer(function (inbound) {
      self.inbound = inbound
      self.outbound.on(['data', 'here', 'is'], function (data) {
        assert.deepEqual(this.event, ['data', 'here', 'is'])
        assert.equal(data, 'something.')
        done()
      })
      self.inbound.send(['here', 'is'], 'something.');
    })
    self.server.listen.apply(self.server, args.concat(function () {
      self.outbound.connect.apply(self.outbound, args)
    }))
  }
}