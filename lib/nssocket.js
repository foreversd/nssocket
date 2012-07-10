var net = require('net'),
    tls = require('tls'),
    util = require('util'),
    assert = require('chai').assert,
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    bufferjoiner = require('bufferjoiner')

module.exports = NsSocket

module.exports.createClient = NsSocket

module.exports.createServer = function createServer(options, connectionListener) {
  if (!connectionListener && typeof options === 'function') {
    connectionListener = options
    options = {}
  }

  options.type = options.type || 'tcp4'
  options.delimiter = options.delimiter || '::'

  function onConnection (socket) {
    // inbounds sockets can not reconnect by definition
    options.reconnect = false
    connectionListener(new NsSocket(options, socket))
  }

  return options.type === 'tls'
    ? tls.createServer(options, onConnection)
    : net.createServer(options, onConnection)
}

// retro compatibility fixes
module.exports.data = module.exports.ondata
module.exports.unData = module.exports.offdata
module.exports.dataOnce = module.exports.oncedata

function NsSocket(options, socket) {
  if (!(this instanceof NsSocket)) {
    return new NsSocket(options, socket)
  }

  if (!options) {
    options = socket || {}
  }

  this.connected = false
  this.type = options.type || 'tcp4'
  this.retry = options.reconnect ? {
    retries: 0,
    max: options.maxRetries || 10,
    wait: options.retryInterval || 5000,
    timeoutId: undefined
  } : false

  EventEmitter2.call(this, {
    delimiter: options.delimiter || '::',
    wildcard: true,
    maxListeners: options.maxListeners || 10
  })

  if (socket) {
    this.stream = socket
    this.socket = this.stream instanceof net.Socket ? this.stream : this.stream.socket
    this.connected = this.socket.writable && this.socket.readable || false
    configureEvents(this)
  }
}

util.inherits(NsSocket, EventEmitter2)

NsSocket.prototype.connect = function connect(port) {
  this.retry.timeoutId && clearTimeout(this.retry.timeoutId)

  if (!this.socket) {
    var module = this.type === 'tls' ? tls : net

    this.stream = module.connect.apply(null, arguments)
    this.socket = this.stream instanceof net.Socket ? this.stream : this.stream.socket
    this.connected = this.socket.writable && this.socket.readable || false
    this.connectionArgs = arguments

    configureEvents(this)
  } else {
    this.socket.connect.apply(this.socket, arguments)
  }
  return this
}

NsSocket.prototype.write = function write(buff) {
  // if we aren't connected/socketed, then error
  if (!this.socket || !this.connected) {
    return this.emit('error', new Error('NsSocket: sending on a bad socket'))
  }
  this.stream.write(buff)
  return this
}

NsSocket.prototype.send = function send(event, data, callback) {
  // if we aren't connected/socketed, then error
  if (!this.socket || !this.connected) {
    return this.emit('error', new Error('NsSocket: sending on a bad socket'))
  }

  var dataType = typeof data
  if (dataType === 'undefined' || dataType === 'function') {
    callback = data
    data = null
  }

  this.stream.write(this.createMessage(event, data), callback)
  return this
}

NsSocket.prototype.createMessage = function createMessage(event, data) {
  var header = new Buffer(9)

  if (typeof event === 'string') {
    event = event.split(this.delimiter)
  }

  event = Buffer(JSON.stringify(event))

  if (Buffer.isBuffer(data)) {
    header.writeInt8(1, 8)
  } else {
    data = Buffer(JSON.stringify(data))
    header.writeInt8(0, 8)
  }

  header.writeUInt32BE(event.length, 0)
  header.writeUInt32BE(data.length, 4)

  return Buffer.concat([header, event, data], 9 + event.length + data.length)
}

NsSocket.prototype.ondata = function (event, listener) {
  if (typeof event === 'string') {
    event = event.split(this.delimiter)
  }
  return this.on(['data'].concat(event), listener)
}

NsSocket.prototype.offdata = function (event, listener) {
  return this.off(['data'].concat(event), listener)
}

NsSocket.prototype.oncedata = function (event, listener) {
  if (typeof event === 'string') {
    event = event.split(this.delimiter)
  }
  return this.once(['data'].concat(event), listener)
}

NsSocket.prototype.setIdle = function setIdle(timeout) {
  this.socket.setTimeout(timeout)
  this.timeout = timeout
}

NsSocket.prototype.destroy = function destroy() {
  this.removeAllListeners()

  try {
    this.socket.end()
    this.socket.destroy()
  } catch (err) {}

  this.emit('destroy')
}

NsSocket.prototype.end = function end() {
  var hadErr
  this.connected = false

  try {
    this.socket.end()
  } catch (err) {
    hadErr = true
    this.emit('error', err)
  }

  this.emit('close', hadErr)
}

NsSocket.prototype.reconnect = function reconnect() {
  var self = this

  this.retry.timeoutId = setTimeout(function tryReconnect() {
    self.retry.retries ++

    if (self.retry.retries >= self.retry.max) {
      return self.emit('error', new Error('Did not reconnect after maximum retries: ' + self.retry.max))
    }

    self.retry.waiting = true

    // here for debugging reasons
    assert.isFalse(self.connected, 'before actually reconnect connected must be false')
    assert.isUndefined(self.socket, 'before actually reconnect socket must be destroied')

    self.once('start', function () {
      self.retry.waiting = false
      self.retry.retries = 0
    })

    self.connect.apply(self, self.connectionArgs)
  }, this.retry.wait)
}

function configureEvents(self) {
  // parsing holders
  var eventLength = -1
  var messageLength = -1
  var messagetype = 0
  var bufferJoiner = bufferjoiner()

  if (self.type === 'tls') {
    self.stream.on('secureConnect', onStart)
  } else {
    self.socket.on('connect', onStart)
  }

  function onStart() {
    self.connected = true
    self.emit('start')
  }

  self.stream.on('data', function onData(chunk) {
    ~messageLength
      ? fetchBody(chunk)
      : fetchHeader(chunk)
  })

  function fetchHeader(chunk) {
    if (bufferJoiner.length + chunk.length >= 9) {
      var header = bufferJoiner.add(chunk).join()
      eventLength = header.readUInt32BE(0)
      messageLength = header.readUInt32BE(4)
      messagetype = header.readInt8(8)
      fetchBody(chunk.slice(9))
    } else {
      bufferJoiner.add(chunk)
    }
  }

  function fetchBody(chunk) {
    var raw, event, data
    var chunkLength = chunk.length
    var bytesLeft = (eventLength + messageLength) - bufferJoiner.length

    if (chunkLength >= bytesLeft) {
      raw = bufferJoiner.add(chunk.slice(0, bytesLeft)).join()
      event = JSON.parse(raw.slice(0, eventLength))
      data = messagetype ? raw.slice(eventLength) : JSON.parse(raw.slice(eventLength).toString())

      eventLength = -1
      messageLength = -1

      self.emit(['data'].concat(event), data)

      if (chunkLength - bytesLeft) {
        fetchHeader(chunk.slice(bytesLeft))
      }

      return
    }

    bufferJoiner.add(chunk)
  }

  self.socket.on('close', function onClose(hadError) {
    self.socket.destroy()
    self.socket = undefined
    self.connected = false

    if (hadError) {
      self.emit('close', hadError, arguments[1])
    } else {
      self.emit('close')
    }

    self.retry && self.reconnect()
  })

  self.socket.on('error', function (err) {
    !self.retry && self.emit('error', err || new Error('An Unknown Error occured'))
  })

  self.socket.on('timeout', function onIdle() {
    self.emit('idle')
    self.timeout && self.socket.setTimeout(this.timeout)
  })
}