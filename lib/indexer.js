(function() {
  var audiofileRegex, fs, indexPath, joinPath, mm, walk,
    __slice = [].slice;

  fs = require('fs');

  joinPath = require('path').join;

  walk = require('walk');

  mm = require('musicmetadata');

  audiofileRegex = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i;

  indexPath = function(path, foundCb, doneCb) {
    var parserCount, waitingParser, walker;
    parserCount = 0;
    waitingParser = false;
    walker = walk.walk(path);
    walker.on("file", function(root, fileStats, next) {
      var foundmetadata, fullpath, parser, stream;
      if (!audiofileRegex.test(fileStats.name)) {
        next();
        return;
      }
      fullpath = joinPath(root, fileStats.name);
      stream = fs.createReadStream(fullpath);
      parser = mm(stream);
      foundmetadata = false;
      parserCount++;
      parser.on('metadata', function(result) {
        foundmetadata = true;
        foundCb(fullpath, result);
        return next();
      });
      return parser.on('done', function(err) {
        parserCount--;
        if (err) {
          console.log('parser error');
          console.log(err);
        }
        stream.destroy();
        if (!foundmetadata) {
          foundCb(fullpath, {});
        }
        next();
        if (parserCount === 0 && waitingParser) {
          return doneCb();
        }
      });
    });
    walker.on('error', function(err) {
      console.log('walker error');
      return console.log(err);
    });
    return walker.on('end', function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (parserCount === 0) {
        return doneCb();
      } else {
        return waitingParser = true;
      }
    });
  };

  module.exports = indexPath;

}).call(this);
