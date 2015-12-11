DataStore = require 'nedb'

class MediaStore
  constructor: (config) ->
    @_filename = config.filename
    @_db = new Datastore(filename: @_filename, autoload: true)
    
  query: (options, callback) ->
    return new MediaQuery(@, options).exec(callback)
    

class TrackStore extends MediaStore
  constructor: (config) ->
    super(config)
  
  ###
  interface Metadata {
    path: string;
    size: number;
    root: string;
    
    title: string;
    artist: string[];
    albumartist: string[];
    album: string;
    year: string;
    track: { no: number: of: number },
    genre: string[],
    disc: { no: number: of: number },
    duration: number,
  }
  ###
  insert: (metadata) ->
    
    
class MediaQuery
  constructor: (store, options) ->
    @_store = store
    @_filter = options.filter || {}
    @_sort = options.sort
    @_skip = options.skip
    @_limit = options.limit
    
  exec: (callback) ->
    query = @_store.find(@_filter)
    if @_sort?
      query = query.sort(@_sort)
    if @_skip?
      query = query.skip(@_skip)
    if @_limit?
      query = query.limit(@_limit)
    query.exec(callback)
    return @
    
    
module.exports = MediaStore
