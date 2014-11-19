(function() {
  var Datastore, EventEmitter, MediaLibrary, async, compare, escapeRegExp, fs, getPathRegex, indexer, mapPathToFolder, mapTrackToFile, path, _;

  path = require('path');

  fs = require('fs');

  EventEmitter = require('events').EventEmitter;

  _ = require('lodash');

  async = require('async');

  Datastore = require('nedb');

  indexer = require('./musicindexer');

  compare = function(x, y) {
    if (x === y) {
      return 0;
    }
    return (x > y ? 1 : -1);
  };

  escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };

  mapPathToFolder = function(p) {
    return {
      path: p,
      name: path.basename(p),
      type: 'folder'
    };
  };

  mapTrackToFile = function(track) {
    return {
      path: track.path,
      name: path.basename(track.path),
      type: 'file',
      track: track
    };
  };

  getPathRegex = function(p) {
    return new RegExp(['^', escapeRegExp(p + path.sep), '[^', escapeRegExp(path.sep), ']+', '$'].join(""));
  };

  MediaLibrary = (function() {
    function MediaLibrary(options) {
      var dbpath;
      this.options = this._normalizeOptions(options);
      if (this.options.dataPath) {
        dbpath = join(this.options.dataPath, 'ml-tracks.db');
      }
      this.db = new Datastore({
        filename: dbpath,
        autoload: true
      });
    }

    MediaLibrary.prototype._normalizeOptions = function(options) {
      options = _.clone(options);
      options.paths = options.paths.map(function(p) {
        return path.resolve(p);
      });
      return options;
    };

    MediaLibrary.prototype.scan = function(callback) {
      var emitter, _addTrack;
      if (this._activeScan) {
        return this._activeScan;
      }
      if (callback == null) {
        callback = _.noop;
      }
      emitter = new EventEmitter();
      this._activeScan = true;
      _addTrack = this._addTrack.bind(this);
      async.series(this.options.paths.map(function(dir) {
        return function(callback) {
          var tracks;
          tracks = [];
          return indexer(dir).on('file', function(rpath, stats, fpath, md) {
            var track;
            track = md || {};
            track.path = fpath;
            track.size = stats.size;
            track.root = dir;
            delete track.picture;
            tracks.push(track);
            return emitter.emit('track', track);
          }).on('error', function(err) {
            return callback(err);
          }).on('done', function() {
            return callback(null, tracks);
          }).start();
        };
      }), (function(_this) {
        return function(err, results) {
          var tracks;
          _this._activeScan = false;
          if (err) {
            console.error('scan error', err);
            emitter.emit('error', err);
            return callback(err, null);
          }
          tracks = _.flatten(results, true);
          return async.parallel(tracks.map(function(track) {
            return function(callback) {
              return _addTrack(track, callback);
            };
          }), function(err, tracks) {
            callback(null, tracks);
            return emitter.emit('done', tracks);
          });
        };
      })(this));
      return emitter;
    };

    MediaLibrary.prototype._addTrack = function(track, callback) {
      var db;
      db = this.db;
      return db.findOne({
        path: track.path
      }, function(err, foundTrack) {
        if (foundTrack) {
          return callback(null, foundTrack);
        }
        return db.insert(track, function(err, track) {
          if (err) {
            return callback(new Error(err));
          }
          return callback(null, track);
        });
      });
    };

    MediaLibrary.prototype.tracks = function(query, callback) {
      var q;
      if (query == null) {
        query = {};
      }
      if (_.isFunction(query)) {
        callback = query;
        query = {};
      }
      q = _.clone(query);
      return this.db.find(q, function(err, tracks) {
        if (err) {
          return callback(err);
        }
        tracks.sort(function(t1, t2) {
          var c, _ref, _ref1, _ref2, _ref3;
          c = compare((_ref = t1.artist) != null ? _ref[0] : void 0, (_ref1 = t2.artist) != null ? _ref1[0] : void 0);
          if (c !== 0) {
            return c;
          }
          c = compare(t1.album, t2.album);
          if (c !== 0) {
            return c;
          }
          return compare((_ref2 = t1.track) != null ? _ref2.no : void 0, (_ref3 = t2.track) != null ? _ref3.no : void 0);
        });
        return callback(null, tracks);
      });
    };

    MediaLibrary.prototype.artists = function(query, callback) {
      var q;
      if (query == null) {
        query = {};
      }
      if (_.isFunction(query)) {
        callback = query;
        query = {};
      }
      q = _.clone(query);
      if (q.name) {
        q.artist = query.name;
        delete q.name;
      }
      return this.db.find(q, function(err, tracks) {
        var artists;
        if (err) {
          return callback(err);
        }
        artists = tracks.filter(function(t) {
          return t.artist && t.artist.length;
        }).map(function(t) {
          return t.artist[0];
        });
        artists = _.uniq(artists);
        artists = artists.sort().map(function(a) {
          return {
            name: a
          };
        });
        return callback(null, artists);
      });
    };

    MediaLibrary.prototype.albums = function(query, callback) {
      var q;
      if (query == null) {
        query = {};
      }
      if (_.isFunction(query)) {
        callback = query;
        query = {};
      }
      q = _.clone(query);
      if (q.title) {
        q.album = q.title;
        delete q.title;
      }
      if (q.artist) {
        q.artist = [query.artist];
      }
      return this.db.find(q, function(err, tracks) {
        var albums, albumtracks;
        if (err) {
          return callback(err);
        }
        albumtracks = tracks.filter(function(track) {
          return !!track.album;
        }).map(function(track) {
          var _ref, _ref1, _ref2;
          return {
            title: track.album,
            artist: ((_ref = track.albumartist) != null ? _ref[0] : void 0) || ((_ref1 = track.artist) != null ? _ref1[0] : void 0),
            path: track.path,
            dirpath: path.dirname(track.path),
            track_no: (_ref2 = track.track) != null ? _ref2.no : void 0,
            year: track.year,
            _id: track._id
          };
        });
        albums = _.chain(albumtracks).groupBy('dirpath').map(function(pathtracks, dirpath) {
          return _.chain(pathtracks).groupBy('title').map(function(tracks, title) {
            var artists, years;
            artists = _.uniq(tracks.map(function(t) {
              return t.artist;
            }));
            years = _.uniq(tracks.filter(function(t) {
              return !!t.year;
            }).map(function(t) {
              return t.year;
            }));
            return {
              title: title,
              artist: (artists.length > 1 ? 'Various Artists' : artists[0]),
              artists: artists,
              year: (years.length === 1 ? years[0] : null),
              dirpath: dirpath,
              tracks: _.sortBy(tracks.map(function(t) {
                return t._id;
              }), function(t) {
                return t.track_no;
              })
            };
          }).value();
        }).flatten(true).sortBy('title').value();
        return callback(null, albums);
      });
    };

    MediaLibrary.prototype.files = function(p, callback) {
      var folders, names;
      if (_.isFunction(p)) {
        callback = p;
        p = null;
      }
      if (p == null) {
        return callback(null, this.options.paths.map(mapPathToFolder));
      } else {
        p = path.resolve(p);
        names = fs.readdirSync(p);
        folders = names.map(function(name) {
          return path.join(p, name);
        }).filter(function(p) {
          return fs.statSync(p).isDirectory();
        }).map(mapPathToFolder);
        return this.db.find({
          path: getPathRegex(p)
        }, function(err, tracks) {
          if (err) {
            return callback(err);
          }
          folders = folders.concat(tracks.map(mapTrackToFile));
          return callback(null, folders);
        });
      }
    };

    MediaLibrary.prototype.findTracks = function(track, callback) {
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
      return this.db.find(query, callback);
    };

    return MediaLibrary;

  })();

  module.exports = MediaLibrary;

}).call(this);
