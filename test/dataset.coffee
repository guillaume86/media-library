fs = require 'fs'

module.exports =
  path: './test/data/'
  files: fs.readdirSync('./test/data/')
