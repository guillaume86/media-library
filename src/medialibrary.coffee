# API:
# library.addPath()     # 
# library.removePath()  # 
# library.refresh()     # search/refresh tracks
# library.clear()       # delete eveything
# library.clean()       # remove non existant files

path = require 'path'
fs = require 'fs'
{EventEmitter} = require 'events'
_ = require 'lodash'
async = require 'async'
Datastore = require 'nedb'
indexer = require './musicindexer'

{
  compare,
  escapeRegExp,
  mapPathToFolder,
  mapTrackToFile,
  getPathRegex
} = require './utils'

class MediaLibrary
  constructor: (options) ->
    @options = @_normalizeOptions(options)
    
    if @options.dataPath
      dbpath = path.join(@options.dataPath, 'ml-tracks.db')

    @db = new Datastore(filename: dbpath, autoload: true)
    
  _normalizeOptions: (options) ->
    options = _.clone(options)
    options.paths = options.paths.map((p) -> path.resolve(p))
    return options
    
  # scan the paths and returns the number of found file
  scan: (callback) ->    
    # only one scan allowed at a time
    return @_activeScan if @_activeScan
    
    # TODO: filter to speed up rescan
    callback ?= _.noop
    emitter = new EventEmitter()
    @_activeScan = true
    _addTrack = @_addTrack.bind(@)
    async.series(@options.paths.map((dir) ->
      (callback) ->
        tracks = []
        indexer(dir)
        .on('file', (rpath, stats, fpath, md) ->
          track = md || {}
          track.path = fpath
          track.size = stats.size
          track.root = dir
          # save some RAM and disk space
          delete track.picture
          
          tracks.push(track)
          emitter.emit('track', track)
        )
        .on('error', (err) -> callback(err))
        .on('done', -> callback(null, tracks))
        .start()
    ), (err, results) =>
      @_activeScan = false
      if err
        console.error('scan error', err)
        emitter.emit('error', err)
        return callback(err, null)
      tracks = _.flatten(results, true)
      async.parallel(tracks.map((track) ->
        (callback) ->
          _addTrack(track, callback)
      ), (err, tracks) ->
        callback(null, tracks)
        emitter.emit('done', tracks)
      )
    )
    
    return emitter
    
  _addTrack: (track, callback) ->
    db = @db
    db.findOne({ path: track.path }, (err, foundTrack) ->
      if foundTrack
        # TODO: update
        return callback(null, foundTrack)
        
      db.insert(track, (err, track) ->
        if err
          return callback(new Error(err))
        return callback(null, track)
      )
    )

  tracks: (query = {}, callback) ->
    # handle optional query argument
    if _.isFunction(query)
      callback = query
      query = {}
      
    q = _.clone(query)
    @db.find(q, (err, tracks) ->
      return callback(err) if err
      
      # sort by artist, album, track no
      tracks.sort((t1, t2) ->
        c = compare(t1.artist?[0], t2.artist?[0])
        return c if c != 0
        c = compare(t1.album, t2.album)
        return c if c != 0
        return compare(t1.track?.no, t2.track?.no)
      )
      
      callback(null, tracks)
    )

  artists: (query = {}, callback) ->
    # handle optional query argument
    if _.isFunction(query)
      callback = query
      query = {}
      
    q = _.clone(query)
    if q.name
      q.artist = query.name
      delete q.name

    @db.find(q, (err, tracks) ->
      return callback(err) if err
      artists = tracks
        .filter((t) -> t.artist && t.artist.length)
        .map((t) -> t.artist[0])
      artists = _.uniq(artists)
      artists = artists.sort().map((a) -> { name: a })
      callback(null, artists)
    )

  albums: (query = {}, callback) ->
    # handle optional query argument
    if _.isFunction(query)
      callback = query
      query = {}
      
    q = _.clone(query)
    if q.title
      q.album = q.title
      delete q.title
    if q.artist
      q.artist = [query.artist]

    @db.find(q, (err, tracks) ->
      return callback(err) if err
      albumtracks = tracks
        .filter((track) -> !!track.album)
        .map((track) ->
          title: track.album
          artist: track.albumartist?[0] || track.artist?[0]
          path: track.path
          dirpath: path.dirname(track.path)
          track_no: track.track?.no
          year: track.year
          _id: track._id
        )
      albums = _.chain(albumtracks)
        .groupBy('dirpath') # group by directory
        .map((pathtracks, dirpath) ->
          _.chain(pathtracks)
          .groupBy('title')
          .map((tracks, title) ->
            artists = _.uniq(tracks.map((t) -> t.artist))
            years = _.uniq(tracks.filter((t) -> !!t.year).map((t) -> t.year))
            return (
              title: title
              artist: (if artists.length > 1 then 'Various Artists' else artists[0])
              artists: artists
              year: (if years.length == 1 then years[0] else null)
              dirpath: dirpath
              tracks: _.sortBy(tracks.map((t) -> t._id), (t) -> t.track_no)
            )
          )
          .value()
        )
        .flatten(true) # true for one level flattening
        .sortBy('title')
        .value()
        
      callback(null, albums)
    )

  files: (p, callback) ->
    # handle optional p argument
    if _.isFunction(p)
      callback = p
      p = null
    
    unless p?
      return callback(null, @options.paths.map(mapPathToFolder))
    else
      p = path.resolve(p)
      names = fs.readdirSync(p)
      folders = names
        .map((name) -> path.join(p, name))
        .filter((p) -> fs.statSync(p).isDirectory())
        .map(mapPathToFolder)

      return @db.find({ path: getPathRegex(p) }, (err, tracks) -> 
        return callback(err) if err
        folders = folders.concat(tracks.map(mapTrackToFile))
        callback(null, folders)
      )

  findTracks: (track, callback) ->
    query = {}
    if track.artist
      artistRegex = new RegExp([escapeRegExp(track.artist)].join(""), "i")
      query.artist = artistRegex
    if track.title
      titleRegex = new RegExp([escapeRegExp(track.title)].join(""), "i")
      query.title = titleRegex
    if track.album
      albumRegex = new RegExp([escapeRegExp(track.album)].join(""), "i")
      query.album = albumRegex
    @db.find(query, callback)


module.exports = MediaLibrary
