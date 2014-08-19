(function() {
  var Datastore, MediaLibrary, Q, activeScan, basename, dirname, escapeRegExp, fs, getPathRegex, indexPath, joinPath, mapPathToFolder, mapTrackToFile, normalizePath, pathSep, _;

  fs = require('fs');

  joinPath = require('path').join;

  basename = require('path').basename;

  dirname = require('path').dirname;

  pathSep = require('path').sep;

  Datastore = require('nedb');

  indexPath = require('./indexer');

  Q = require('q');

  _ = require('lodash');

  indexPath = Q.nfbind(indexPath);

  escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };

  activeScan = null;

  mapPathToFolder = function(path) {
    return {
      path: path,
      name: basename(path),
      type: 'folder'
    };
  };

  mapTrackToFile = function(track) {
    return {
      path: track.path,
      name: basename(track.path),
      type: 'file',
      track: track
    };
  };

  normalizePath = function(path) {
    path = path.replace(/(?:\\|\/)/g, pathSep);
    if (path.slice(0, 2) === ('.' + pathSep)) {
      path = path.slice(2);
    }
    if (path.length > 1 && path[0] === pathSep && path[1] !== pathSep) {
      path = path.slice(1);
    }
    if (path.length > 1 && path.slice(-1) === pathSep) {
      path = path.slice(0, -1);
    }
    return path;
  };

  getPathRegex = function(path) {
    return new RegExp(['^', escapeRegExp(path + pathSep), '[^', escapeRegExp(pathSep), ']+', '$'].join(""));
  };

  MediaLibrary = (function() {
    function MediaLibrary(opts) {
      var trackdbpath;
      this.opts = opts;
      if (this.opts.databasePath) {
        trackdbpath = joinPath(this.opts.databasePath, 'ml-tracks.db');
      }
      this.db = {
        track: new Datastore({
          filename: trackdbpath,
          autoload: true
        })
      };
      this.dbfind = {
        track: Q.nbind(this.db.track.find, this.db.track)
      };
      this.opts.paths = this.opts.paths.map(normalizePath);
    }

    MediaLibrary.prototype.addTrack = function(root, path, metadata) {
      var db, deferred;
      db = this.db.track;
      deferred = Q.defer();
      db.findOne({
        path: path
      }, function(err, result) {
        if (result) {
          deferred.resolve(result);
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
      if (activeScan) {
        return activeScan;
      }
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
      activeScan = deferred.promise.then(function() {
        activeScan = null;
        return trackCount;
      });
      return activeScan;
    };

    MediaLibrary.prototype.tracks = function() {
      return this.dbfind.track({});
    };

    MediaLibrary.prototype.artists = function() {
      return this.dbfind.track({}).then(function(tracks) {
        return tracks.filter(function(t) {
          return t.artist && t.artist.length;
        }).map(function(t) {
          return t.artist[0];
        });
      }).then(_.uniq).then(function(artists) {
        return artists.sort();
      });
    };

    MediaLibrary.prototype.albums = function() {
      return this.dbfind.track({}).then(function(tracks) {
        return tracks.filter(function(t) {
          return !!t.album;
        }).map(function(t) {
          var _ref, _ref1;
          return {
            title: t.album,
            artist: (_ref = t.artist) != null ? _ref[0] : void 0,
            id: [(_ref1 = t.artist) != null ? _ref1[0] : void 0, t.album].join('|||')
          };
        });
      }).then(function(albums) {
        return _.uniq(albums, function(a) {
          return a.id;
        });
      }).then(function(albums) {
        return _.sortBy(albums, 'id');
      });
    };

    MediaLibrary.prototype.files = function(path) {
      var folders, names;
      if (path == null) {
        return Q(this.opts.paths.map(mapPathToFolder));
      } else {
        path = normalizePath(path);
        names = fs.readdirSync(path);
        folders = names.map(function(name) {
          return joinPath(path, name);
        }).filter(function(path) {
          return fs.statSync(path).isDirectory();
        }).map(mapPathToFolder);
        return this.dbfind.track({
          path: getPathRegex(path)
        }).then(function(tracks) {
          return folders.concat(tracks.map(mapTrackToFile));
        });
      }
    };

    MediaLibrary.prototype.findTrack = function(track) {
      var albumRegex, artistRegex, query, titleRegex;
      query = {};
      if (track.artist) {
        artistRegex = new RegExp([escapeRegExp(track.artist)].join(""), "i");
        query.artist = artistRegex;
      }
      if (track.title) {
        titleRegex = new RegExp([escapeRegExp(track.title)].join(""), "i");
        query.title = titleRegex;
      }
      if (track.album) {
        albumRegex = new RegExp([escapeRegExp(track.album)].join(""), "i");
        query.album = albumRegex;
      }
      return this.dbfind.track(query);
    };

    return MediaLibrary;

  })();

  module.exports = MediaLibrary;

}).call(this);
