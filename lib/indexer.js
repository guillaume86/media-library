(function() {
  var audiofileRegex, fs, indexPath, joinPath, mm, walk;

  fs = require('fs');

  joinPath = require('path').join;

  walk = require('walk');

  mm = require('musicmetadata');

  audiofileRegex = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i;

  indexPath = function(path, foundCb, doneCb) {
    var pendingParsers, walkDone, walker;
    pendingParsers = 0;
    walkDone = false;
    walker = walk.walk(path);
    walker.on('names', function(root, nodeNamesArray) {
      return nodeNamesArray.sort(function(a, b) {
        if (a > b) {
          return 1;
        }
        if (a < b) {
          return -1;
        }
        return 0;
      });
    });
    walker.on("file", function(root, fileStats, next) {
      var foundmetadata, fullpath, parser, stream;
      if (!audiofileRegex.test(fileStats.name) || fileStats.size === 0) {
        next();
        return;
      }
      fullpath = joinPath(root, fileStats.name);
      stream = fs.createReadStream(fullpath);
      parser = mm(stream);
      pendingParsers++;
      foundmetadata = false;
      parser.on('metadata', function(result) {
        foundmetadata = true;
        return foundCb(fullpath, result);
      });
      return parser.on('done', function(err) {
        pendingParsers--;
        if (err) {
          console.log('parser error');
          console.log(err);
        }
        stream.destroy();
        if (!foundmetadata) {
          foundCb(fullpath, {});
        }
        next();
        if (walkDone && pendingParsers === 0) {
          return doneCb();
        }
      });
    });
    walker.on('error', function(err) {
      console.log('walker error');
      return console.log(err);
    });
    return walker.on('end', function() {
      if (pendingParsers === 0) {
        return doneCb();
      } else {
        return walkDone = true;
      }
    });
  };

  module.exports = indexPath;

}).call(this);
