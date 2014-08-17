[![NPM version](https://badge.fury.io/js/media-library.svg)](http://badge.fury.io/js/media-library)
[![NPM downloads](http://img.shields.io/npm/dm/localeval.svg)](http://img.shields.io/npm/dm/localeval.svg)

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
