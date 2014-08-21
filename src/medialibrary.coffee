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
    if q.artist
      q.artist = [query.artist]

    @dbfind.track(q)

  artists: (query = {}) ->
    q = _.clone(query)
    if q.name
      q.artist = [query.name]
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
        .filter((t) -> !!t.album)
        .map((t) ->
          title: t.album
          artist: t.artist?[0]
          id: [t.artist?[0], t.album].join('|||')
        )
      )
      .then((albums) -> _.uniq(albums, (a) -> a.id))
      .then((albums) -> _.sortBy(albums, 'id'))

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
