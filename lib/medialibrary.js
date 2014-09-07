(function() {
  var Datastore, MediaLibrary, Q, basename, compare, dirname, escapeRegExp, fs, getPathRegex, indexPath, joinPath, mapPathToFolder, mapTrackToFile, normalizePath, pathSep, _;

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

  compare = function(x, y) {
    if (x === y) {
      return 0;
    }
    return (x > y ? 1 : -1);
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
      return Q.Promise((function(_this) {
        return function(resolve, reject) {
          var db;
          db = _this.db.track;
          return db.findOne({
            path: path
          }, function(err, result) {
            if (result) {
              return resolve(result);
            }
            metadata.picture = void 0;
            metadata.root = root;
            metadata.path = path;
            return db.insert(metadata, function(err, metadata) {
              if (err) {
                return reject(new Error(err));
              }
              return resolve(metadata);
            });
          });
        };
      })(this));
    };

    MediaLibrary.prototype.scan = function() {
      if (this._activeScan) {
        return this._activeScan;
      }
      return this._activeScan = Q.Promise((function(_this) {
        return function(resolve, reject, notify) {
          var addPromise, addPromises, pathDonePromise, pathPromises, root, trackCount;
          trackCount = 0;
          pathPromises = (function() {
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
                    return notify(track);
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
          }).call(_this);
          return Q.all(pathPromises).then(function() {
            _this._activeScan = null;
            return resolve(trackCount);
          })["catch"](reject);
        };
      })(this));
    };

    MediaLibrary.prototype.tracks = function(query) {
      var q;
      if (query == null) {
        query = {};
      }
      q = _.clone(query);
      return this.dbfind.track(q).then(function(tracks) {
        return tracks.sort(function(t1, t2) {
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
      });
    };

    MediaLibrary.prototype.artists = function(query) {
      var q;
      if (query == null) {
        query = {};
      }
      q = _.clone(query);
      if (q.name) {
        q.artist = query.name;
        delete q.name;
      }
      return this.dbfind.track({}).then(function(tracks) {
        return tracks.filter(function(t) {
          return t.artist && t.artist.length;
        }).map(function(t) {
          return t.artist[0];
        });
      }).then(_.uniq).then(function(artists) {
        return artists.sort().map(function(a) {
          return {
            name: a
          };
        });
      });
    };

    MediaLibrary.prototype.albums = function(query) {
      var q;
      if (query == null) {
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
      return this.dbfind.track(q).then(function(tracks) {
        return tracks.filter(function(track) {
          return !!track.album;
        }).map(function(track) {
          var _ref, _ref1, _ref2;
          return {
            title: track.album,
            artist: ((_ref = track.albumartist) != null ? _ref[0] : void 0) || ((_ref1 = track.artist) != null ? _ref1[0] : void 0),
            path: track.path,
            dirpath: dirname(track.path),
            track_no: (_ref2 = track.track) != null ? _ref2.no : void 0,
            year: track.year,
            _id: track._id
          };
        });
      }).then(function(albumtracks) {
        return _.chain(albumtracks).groupBy('dirpath').map(function(pathtracks, dirpath) {
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
        }).flatten(true).value();
      }).then(function(albums) {
        return _.sortBy(albums, 'title');
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

    MediaLibrary.prototype.findTracks = function(track) {
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
