joinPath = require('path').join
Datastore = require 'nedb'
indexPath = require './indexer'
Q = require 'q'
_ = require 'lodash'

# transform to promise syntax
indexPath = Q.nfbind(indexPath)

escapeRegExp = (str) ->
  str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")

class MediaLibrary
  constructor: (@opts) ->
    filename = joinPath(@opts.databasePath, 'ml-tracks.db') if @opts.databasePath
    @db = new Datastore(
      filename: filename
      autoload: true
    )

    @dbfind = Q.nbind(@db.find, @db)

  addTrack: (root, path, metadata) ->
    db = @db
    deferred = Q.defer()
    db.findOne({ path: path }, (err, result) ->
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
    deferred = Q.defer()
    trackCount = 0
    promises = for root in @opts.paths
      addPromises = []
      addPromise = null
      pathDonePromise = indexPath(root, (path, metadata) =>
        addPromise = @addTrack(root, path, metadata)
        addPromise.then((track) -> deferred.notify(track))
        addPromises.push(addPromise)
        trackCount++
      )
      pathDonePromise.then(-> Q.all(addPromises))
    Q.all(promises).then(deferred.resolve)
    deferred.promise
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
      artistRegex = new RegExp([escapeRegExp(track.artist)].join(""), "i")
      query.artist = artistRegex
    if track.title
      titleRegex = new RegExp([escapeRegExp(track.title)].join(""), "i")
      query.title = titleRegex
    @dbfind(query)


module.exports = MediaLibrary
