path = require 'path'
filewalker = require 'filewalker'

# monkeypatch FileWalker to handle windows network paths starting with '\\'
filewalker::_path = (p) ->
  root = @root
  if root[0...2] == '\\\\' and p[0...2] == '\\\\'
    root = root[2..]
    p = p[2..]

  if path.relative
    return path.relative(root, p).split('\\').join('/')
  else
    return p.substr(root.length).split('\\').join('/')

module.exports = filewalker
