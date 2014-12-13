(function() {
  var EventEmitter, IMAGE_FILE_REGEX, ImageIndexer, WALKER_OPTIONS, basename, dirname, filewalker, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require('events').EventEmitter;

  filewalker = require('./filewalker');

  _ref = require('path'), dirname = _ref.dirname, basename = _ref.basename;

  IMAGE_FILE_REGEX = /\.(?:bmp|jpg|jpeg|gif)$/i;

  WALKER_OPTIONS = {
    maxPending: 20,
    matchRegExp: IMAGE_FILE_REGEX
  };

  ImageIndexer = (function(_super) {
    __extends(ImageIndexer, _super);

    function ImageIndexer(path, options) {
      this.path = path;
      this.options = options != null ? options : {};
      if (!(this instanceof ImageIndexer)) {
        return new ImageIndexer(this.path, this.options);
      }
      this._walker = filewalker(this.path, WALKER_OPTIONS).on('dir', this._onDir.bind(this)).on('file', this._onFile.bind(this)).on('error', this._onError.bind(this)).on('done', this._onDone.bind(this));
    }

    ImageIndexer.prototype._onFile = function(relativePath, stats, fullPath) {
      var directory, _base;
      directory = dirname(fullPath);
      if ((_base = this._results)[directory] == null) {
        _base[directory] = [];
      }
      return this._results[directory].push({
        fullPath: fullPath,
        stats: stats
      });
    };

    ImageIndexer.prototype._onDir = function(relativePath) {};

    ImageIndexer.prototype._onError = function(err) {
      console.error(err);
      return this.emit('error', err);
    };

    ImageIndexer.prototype._onDone = function() {
      var duration;
      duration = Date.now() - this._started;
      this._started = null;
      return this.emit('done', this._results);
    };

    ImageIndexer.prototype.start = function() {
      if (this._started) {
        console.error('Index already in progress...');
        return;
      }
      this._results = {};
      this._started = Date.now();
      this._walker.walk();
      return this;
    };

    return ImageIndexer;

  })(EventEmitter);

  module.exports = ImageIndexer;

}).call(this);
