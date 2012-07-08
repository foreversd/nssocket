module.exports = process.env.NSSOCKET_COV
   ? require('./lib-cov/nssocket')
   : require('./lib/nssocket')