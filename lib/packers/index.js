// Install getters for all packers in this directory:

for (const fileName of require('fs').readdirSync(__dirname)) {
  if (/\.js$/.test(fileName) && fileName !== 'index.js') {
    Object.defineProperty(exports, fileName.replace(/\.js$/, ''), {
      get: () => require('./' + fileName)
    });
  }
}
