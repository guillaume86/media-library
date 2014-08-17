(function() {
  var Datastore, MediaLibrary, Q, escapeRegExp, indexPath, joinPath, _;

  joinPath = require('path').join;

  Datastore = require('nedb');

  indexPath = require('./indexer');

  Q = require('q');

  _ = require('lodash');

  indexPath = Q.nfbind(indexPath);

  escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };

  MediaLibrary = (function() {
    function MediaLibrary(opts) {
      var filename;
      this.opts = opts;
      if (this.opts.databasePath) {
        filename = joinPath(this.opts.databasePath, 'ml-tracks.db');
      }
      this.db = new Datastore({
        filename: filename,
        autoload: true
      });
      this.dbfind = Q.nbind(this.db.find, this.db);
    }

    MediaLibrary.prototype.addTrack = function(root, path, metadata) {
      var db, deferred;
      db = this.db;
      deferred = Q.defer();
      db.findOne({
        path: path
      }, function(err, result) {
        if (result) {
          deferred.reject(new Error("track already in database: " + root + '/' + path));
          return;
        }
        metadata.picture = void 0;
        metadata.root = root;
        metadata.path = path;
        return db.insert(metadata, function(err, metadata) {
          if (err) {
            deferred.reject(new Error(err));
            return;
          }
          return deferred.resolve(metadata);
        });
      });
      return deferred.promise;
    };

    MediaLibrary.prototype.scan = function() {
      var addPromise, addPromises, deferred, pathDonePromise, promises, root, trackCount;
      deferred = Q.defer();
      trackCount = 0;
      promises = (function() {
        var _i, _len, _ref, _results;
        _ref = this.opts.paths;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          root = _ref[_i];
          addPromises = [];
          addPromise = null;
          pathDonePromise = indexPath(root, (function(_this) {
            return function(path, metadata) {
              addPromise = _this.addTrack(root, path, metadata);
              addPromise.then(function(track) {
                return deferred.notify(track);
              });
              addPromises.push(addPromise);
              return trackCount++;
            };
          })(this));
          _results.push(pathDonePromise.then(function() {
            return Q.all(addPromises);
          }));
        }
        return _results;
      }).call(this);
      Q.all(promises).then(deferred.resolve);
      return deferred.promise.then(function() {
        return trackCount;
      });
    };

    MediaLibrary.prototype.tracks = function() {
      return this.dbfind({});
    };

    MediaLibrary.prototype.artists = function() {
      return this.dbfind({}).then(function(tracks) {
        return tracks.filter(function(t) {
          return t.artist && t.artist.length;
        }).map(function(t) {
          return t.artist[0];
        });
      }).then(_.uniq).then(function(artists) {
        return artists.sort();
      });
    };

    MediaLibrary.prototype.find = function(track) {
      var artistRegex, query, titleRegex;
      query = {};
      if (track.artist) {
        artistRegex = new RegExp([escapeRegExp(track.artist)].join(""), "i");
        query.artist = artistRegex;
      }
      if (track.title) {
        titleRegex = new RegExp([escapeRegExp(track.title)].join(""), "i");
        query.title = titleRegex;
      }
      return this.dbfind(query);
    };

    return MediaLibrary;

  })();

  module.exports = MediaLibrary;

}).call(this);
