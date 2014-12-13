(function() {
  var filewalker, path;

  path = require('path');

  filewalker = require('filewalker');

  filewalker.prototype._path = function(p) {
    var root;
    root = this.root;
    if (root.slice(0, 2) === '\\\\' && p.slice(0, 2) === '\\\\') {
      root = root.slice(2);
      p = p.slice(2);
    }
    if (path.relative) {
      return path.relative(root, p).split('\\').join('/');
    } else {
      return p.substr(root.length).split('\\').join('/');
    }
  };

  module.exports = filewalker;

}).call(this);
