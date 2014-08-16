(function() {
  var Datastore, MediaLibrary, Q, indexPath, _;

  Datastore = require('nedb');

  indexPath = require('./indexer');

  Q = require('q');

  _ = require('lodash');

  indexPath = Q.nfbind(indexPath);

  MediaLibrary = (function() {
    function MediaLibrary(opts) {
      this.opts = opts;
      this.db = new Datastore({
        filename: this.opts.databaseFile,
        autoload: true
      });
      this.dbfind = Q.nbind(this.db.find, this.db);
    }

    MediaLibrary.prototype.addTrack = function(root, path, metadata) {
      var db, deferred;
      db = this.db;
      deferred = Q.defer();
      db.findOne({
        root: root,
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
      var addPromises, pathDonePromise, promises, root, trackCount;
      trackCount = 0;
      promises = (function() {
        var _i, _len, _ref, _results;
        _ref = this.opts.paths;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          root = _ref[_i];
          addPromises = [];
          pathDonePromise = indexPath(root, (function(_this) {
            return function(path, metadata) {
              addPromises.push(_this.addTrack(root, path, metadata));
              return trackCount++;
            };
          })(this));
          _results.push(pathDonePromise.then(function() {
            return Q.all(addPromises);
          }));
        }
        return _results;
      }).call(this);
      return Q.all(promises).then(function() {
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
        artistRegex = new RegExp([track.artist].join(""), "i");
        query.artist = artistRegex;
      }
      if (track.title) {
        titleRegex = new RegExp([track.title].join(""), "i");
        query.title = titleRegex;
      }
      return this.dbfind(query);
    };

    return MediaLibrary;

  })();

  module.exports = MediaLibrary;

}).call(this);
