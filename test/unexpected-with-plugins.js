module.exports = require('unexpected')
  .clone()
  .use(require('assetgraph/test/unexpectedAssetGraph'))
  .use(require('unexpected-image'))
  .use(require('unexpected-sinon'));
