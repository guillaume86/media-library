[![Build Status][travis-image]][travis-url]
[![NPM version][npm-image]][npm-url]
[![npm downloads][npm-downloads-image]][npm-url]

# Installation

    $ npm install media-library

# Usage

    var MediaLibary = require('media-library')
    var library = new MediaLibrary({
      // persistent storage location (optional)
      databasePath: './'
      // the paths to scan
      paths: [ 'C:\\data\\music', 'C:\\Users\\me\\music' ]
    });

    // Scanning files (only needed at first start and when paths are added)
    library.scan()
      .then(function() {

          // listing all tracks
          library.tracks()
            .then(function(tracks) {
                console.log(tracks);
            });

          // listing artists  
          library.artists()
            .then(function(tracks) {
                console.log(tracks);
            });

          // searching tracks
          library.find({ artist: 'radiohead', title: 'ok' })
            .then(function(tracks) {
                console.log(tracks);
            });
      });

# todo

  - Compilations

    Could auto detect by AlbumArtist and/or heuristic + manual setting

[npm-url]: https://npmjs.org/package/media-library
[npm-image]: https://badge.fury.io/js/media-library.svg
[npm-downloads-image]: http://img.shields.io/npm/dm/media-library.svg

[travis-url]: https://travis-ci.org/guillaume86/media-library
[travis-image]: https://api.travis-ci.org/guillaume86/media-library.svg?branch=master
