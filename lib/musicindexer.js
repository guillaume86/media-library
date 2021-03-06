(function() {
  var AUDIO_FILE_REGEX, EventEmitter, MusicIndexer, WALKER_OPTIONS, filewalker, mm,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  EventEmitter = require('events').EventEmitter;

  filewalker = require('./filewalker');

  mm = require('musicmetadata');

  AUDIO_FILE_REGEX = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i;

  WALKER_OPTIONS = {
    maxPending: 20,
    matchRegExp: AUDIO_FILE_REGEX
  };

  MusicIndexer = (function(superClass) {
    extend(MusicIndexer, superClass);

    function MusicIndexer(path, options1) {
      this.path = path;
      this.options = options1 != null ? options1 : {};
      if (!(this instanceof MusicIndexer)) {
        return new MusicIndexer(this.path, this.options);
      }
      this._opened = 0;
      this._walkDone = false;
      this._walker = filewalker(this.path, WALKER_OPTIONS).on('dir', this._onDir.bind(this)).on('file', this._onFile.bind(this)).on('stream', this._onStream.bind(this)).on('error', this._onError.bind(this)).on('done', this._onWalkDone.bind(this));
      if (options.filter) {
        this._walker._emitStream = function(relativePath, stats, fullPath) {
          if (options.filter(relativePath, stats, fullPath)) {
            return filewalker.prototype._emitStream.apply(this, arguments);
          } else {
            return this.done();
          }
        };
      }
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
      this._opened++;
      metadata = null;
      return parser = mm(readStream, (function(_this) {
        return function(err, md) {
          metadata = md;
          _this.emit('file', relativePath, stats, fullPath, metadata);
          if (err) {
            console.log('metadata parser error', err);
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
      this._walker.walk();
      return this;
    };

    return MusicIndexer;

  })(EventEmitter);

  module.exports = MusicIndexer;

}).call(this);
