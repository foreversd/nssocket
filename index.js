module.exports = process.env.NSSSOCKET_COV
   ? require('./lib-cov/nssocket')
   : require('./lib/nssocket')