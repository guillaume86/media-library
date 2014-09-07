fs = require 'fs'
joinPath = require('path').join
basename = require('path').basename
dirname = require('path').dirname
pathSep = require('path').sep
Datastore = require 'nedb'
indexPath = require './indexer'
Q = require 'q'
_ = require 'lodash'

# transform to promise syntax
indexPath = Q.nfbind(indexPath)

escapeRegExp = (str) ->
  str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")

mapPathToFolder = (path) ->
  path: path
  name: basename(path)
  type: 'folder'

mapTrackToFile = (track) ->
  path: track.path
  name: basename(track.path)
  type: 'file'
  track: track
  
compare = (x, y) ->
  return 0 if x == y
  return (if x > y then 1 else -1)

normalizePath = (path) ->
  path = path.replace(/(?:\\|\/)/g, pathSep)
  # remove leading ./
  if path[0...2] == ('.' + pathSep)
    path = path[2...]
  # remove leading /
  # but not if "\\" because it's used in windows to access remote shares
  if path.length > 1 and path[0] == pathSep and path[1] != pathSep
    path = path[1...]
  # remove trailing /
  if path.length > 1 and path[-1...] == pathSep
    path = path[...-1]
  path

getPathRegex = (path) ->
  new RegExp([
    '^',
    escapeRegExp(path + pathSep),
    '[^', escapeRegExp(pathSep), ']+',
    '$'
  ].join(""))

class MediaLibrary
  constructor: (@opts) ->
    if @opts.databasePath
      trackdbpath = joinPath(@opts.databasePath, 'ml-tracks.db')
      #albumdbpath = joinPath(@opts.databasePath, 'ml-albums.db')
      #artistdbpath = joinPath(@opts.databasePath, 'ml-artists.db')

    @db =
      track: new Datastore(filename: trackdbpath, autoload: true)
      #album: new Datastore(filename: albumdbpath, autoload: true)
      #artist: new Datastore(filename: artistdbpath, autoload: true)

    @dbfind =
      track: Q.nbind(@db.track.find, @db.track)

    @opts.paths = @opts.paths.map(normalizePath)

  addTrack: (root, path, metadata) ->
    Q.Promise((resolve, reject) =>
      db = @db.track
      db.findOne({ path: path }, (err, result) ->
        if result
          return resolve(result)
        metadata.picture = undefined
        metadata.root = root
        metadata.path = path
        db.insert(metadata, (err, metadata) ->
          if err
            return reject(new Error(err))
          resolve(metadata)
        )
      )
    )

  # scan the paths and returns the number of found file
  scan: ->
    # only one scan allowed at a time
    return @_activeScan if @_activeScan
    @_activeScan = Q.Promise((resolve, reject, notify) =>
      trackCount = 0
      pathPromises = for root in @opts.paths
        addPromises = []
        addPromise = null
        pathDonePromise = indexPath(root, (path, metadata) =>
          addPromise = @addTrack(root, path, metadata)
          addPromise.then((track) -> notify(track))
          addPromises.push(addPromise)
          trackCount++
        )
        pathDonePromise.then(-> Q.all(addPromises))

      Q.all(pathPromises)
      .then(=>
        @_activeScan = null
        resolve(trackCount)
      )
      .catch(reject)
    )

  tracks: (query = {}) ->
    q = _.clone(query)
    @dbfind.track(q)
    .then((tracks) ->
      # sort by artist, album, track no
      tracks.sort((t1, t2) ->
        c = compare(t1.artist?[0], t2.artist?[0])
        return c if c != 0
        c = compare(t1.album, t2.album)
        return c if c != 0
        return compare(t1.track?.no, t2.track?.no)
      )
    )

  artists: (query = {}) ->
    q = _.clone(query)
    if q.name
      q.artist = query.name
      delete q.name

    @dbfind.track({})
      .then((tracks) ->
        tracks
        .filter((t) -> t.artist && t.artist.length)
        .map((t) -> t.artist[0])
      )
      .then(_.uniq)
      .then((artists) -> artists.sort().map((a) -> { name: a }))

  albums: (query = {}) ->
    q = _.clone(query)
    if q.title
      q.album = q.title
      delete q.title
    if q.artist
      q.artist = [query.artist]

    @dbfind.track(q)
      .then((tracks) ->
        tracks
        .filter((track) -> !!track.album)
        .map((track) ->
          title: track.album
          artist: track.albumartist?[0] || track.artist?[0]
          path: track.path
          dirpath: dirname(track.path)
          track_no: track.track?.no
          year: track.year
          _id: track._id
        )
      )
      .then((albumtracks) ->
        _.chain(albumtracks)
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
        .value()
      )
      .then((albums) -> _.sortBy(albums, 'title'))

  files: (path) ->
    unless path?
      return Q(this.opts.paths.map(mapPathToFolder))
    else
      path = normalizePath(path)
      names = fs.readdirSync(path)
      folders = names
        .map((name) -> joinPath(path, name))
        .filter((path) -> fs.statSync(path).isDirectory())
        .map(mapPathToFolder)

      return @dbfind.track({ path: getPathRegex(path) })
        .then((tracks) -> folders.concat(tracks.map(mapTrackToFile)))


  findTracks: (track) ->
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
    @dbfind.track(query)


module.exports = MediaLibrary
