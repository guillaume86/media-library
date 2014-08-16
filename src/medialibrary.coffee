Datastore = require 'nedb'
indexPath = require './indexer'
Q = require 'q'
_ = require 'lodash'

# transform to promise syntax
indexPath = Q.nfbind(indexPath)

class MediaLibrary
  constructor: (@opts) ->
    @db = new Datastore(
      filename: @opts.databaseFile
      autoload: true
    )

    @dbfind = Q.nbind(@db.find, @db)

  addTrack: (root, path, metadata) ->
    db = @db
    deferred = Q.defer()
    db.findOne({ root: root, path: path }, (err, result) ->
      if result
        deferred.reject(new Error("track already in database: " + root + '/' + path))
        return
      metadata.picture = undefined
      metadata.root = root
      metadata.path = path
      db.insert(metadata, (err, metadata) ->
        if err
          deferred.reject(new Error(err))
          return
        deferred.resolve(metadata)
      )
    )
    deferred.promise

  # scan the paths and returns the number of found file
  scan: ->
    trackCount = 0
    promises = for root in @opts.paths
      addPromises = []
      pathDonePromise = indexPath(root, (path, metadata) =>
        addPromises.push(@addTrack(root, path, metadata))
        trackCount++
      )
      pathDonePromise.then(-> Q.all(addPromises))
    Q.all(promises)
      .then(-> trackCount)

  tracks: ->
    @dbfind({})

  artists: ->
    @dbfind({})
      .then((tracks) ->
        tracks
        .filter((t) -> t.artist && t.artist.length)
        .map((t) -> t.artist[0])
      )
      .then(_.uniq)
      .then((artists) -> artists.sort())

  find: (track) ->
    query = {}
    if track.artist
      artistRegex = new RegExp([track.artist].join(""), "i")
      query.artist = artistRegex
    if track.title
      titleRegex = new RegExp([track.title].join(""), "i")
      query.title = titleRegex
    @dbfind(query)


module.exports = MediaLibrary
