(function() {
  var AUDIO_FILE_REGEX, EventEmitter, MusicIndexer, WALKER_OPTIONS, filewalker, mm, path,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require('events').EventEmitter;

  filewalker = require('filewalker');

  mm = require('musicmetadata');

  path = require('path');

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

  AUDIO_FILE_REGEX = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i;

  WALKER_OPTIONS = {
    maxPending: 20,
    matchRegExp: AUDIO_FILE_REGEX
  };

  MusicIndexer = (function(_super) {
    __extends(MusicIndexer, _super);

    function MusicIndexer(path, options) {
      this.path = path;
      this.options = options != null ? options : {};
      if (!(this instanceof MusicIndexer)) {
        return new MusicIndexer(this.path, this.options);
      }
      this._opened = 0;
      this._walkDone = false;
      this._walker = filewalker(this.path, WALKER_OPTIONS).on('dir', this._onDir.bind(this)).on('file', this._onFile.bind(this)).on('stream', this._onStream.bind(this)).on('error', this._onError.bind(this)).on('done', this._onWalkDone.bind(this));
    }

    MusicIndexer.prototype._onFile = function(relativePath, stats, fullPath) {};

    MusicIndexer.prototype._onDir = function(relativePath) {};

    MusicIndexer.prototype._onWalkDone = function(relativePath) {
      this._walkDone = true;
      return this._onDone();
    };

    MusicIndexer.prototype._onError = function(err) {
      console.error(err);
      return this.emit('error', err);
    };

    MusicIndexer.prototype._onStream = function(readStream, relativePath, stats, fullPath) {
      var metadata, parser;
      if ((this.options.filter != null) && !this.options.filter(relativePath, stats, fullPath)) {
        readStream.close();
        return;
      }
      this._opened++;
      metadata = null;
      parser = mm(readStream);
      parser.on('metadata', function(md) {
        return metadata = md;
      });
      return parser.on('done', (function(_this) {
        return function(err) {
          _this.emit('file', relativePath, stats, fullPath, metadata);
          if (err) {
            console.log('metadata parser error');
            _this._onError(err);
          }
          readStream.close();
          _this._opened--;
          return _this._onDone();
        };
      })(this));
    };

    MusicIndexer.prototype._onDone = function() {
      var duration;
      if (!this._walkDone || this._opened > 0) {
        return;
      }
      duration = Date.now() - this._started;
      this._started = null;
      this._walkDone = false;
      return this.emit('done');
    };

    MusicIndexer.prototype.start = function() {
      if (this._started) {
        console.error('Index already in progress...');
        return;
      }
      this._started = Date.now();
      return this._walker.walk();
    };

    return MusicIndexer;

  })(EventEmitter);

  module.exports = MusicIndexer;

}).call(this);