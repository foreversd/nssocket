var nss = require('../');
var outbound = nss();

outbound.on('data::broadcasting', function (data) {
  console.log(data);
}).connect(4949, function () {
  outbound.send('connecting', { 'random' : Math.random() });
});