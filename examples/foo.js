var nssocket = require('../')
var outbound = nssocket()

outbound.on('data::broadcasting', function (data) {
  console.log(data)
}).connect(4949, function () {
  outbound.send('connecting', { 'random' : Math.random() })
})
