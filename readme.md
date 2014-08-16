# Usage

    var MediaLibary = require('media-library')
    var library = new MediaLibrary({
      // persistent storage location (optional)
      databaseFile: 'library.nedb'
      // the paths to scan
      paths: [ 'C:\\data\\music', 'C:\\Users\\me\\music' ]
    });

    // Scanning files
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
