{EventEmitter} = require('events')
filewalker = require 'filewalker'
mm = require 'musicmetadata'
path = require 'path'

# monkeypatch FileWalker to handle windows network paths starting with '\\'
filewalker::_path = (p) ->
  root = @root
  if root[0...2] == '\\\\' and p[0...2] == '\\\\'
    root = root[2..]
    p = p[2..]
    
  if path.relative
    return path.relative(root, p).split('\\').join('/')
  else
    return p.substr(root.length).split('\\').join('/')

AUDIO_FILE_REGEX = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i
WALKER_OPTIONS =
  maxPending: 20 # throttle handles
  matchRegExp: AUDIO_FILE_REGEX

class MusicIndexer extends EventEmitter
  constructor: (@path, @options = {}) ->
    if @ not instanceof MusicIndexer
      return new MusicIndexer(@path, @options)
      
    @_opened = 0
    @_walkDone = false
    
    @_walker = filewalker(@path, WALKER_OPTIONS)
    .on('dir', @_onDir.bind(@))
    .on('file', @_onFile.bind(@))
    .on('stream', @_onStream.bind(@))
    .on('error', @_onError.bind(@))
    .on('done', @_onWalkDone.bind(@))
    
  _onFile: (relativePath, stats, fullPath) ->
    # console.log('file: %s, %d bytes', relativePath, stats.size)
    
  _onDir: (relativePath) ->
    # console.log('dir:  %s', relativePath)
      
  _onWalkDone: (relativePath) ->
    # console.log('%d dirs, %d files, %d bytes', @dirs, @files, @bytes)
    @_walkDone = true
    @_onDone()
    
  _onError: (err) ->
    console.error(err)
    @emit('error', err)
    
  _onStream: (readStream, relativePath, stats, fullPath) ->
    if @options.filter? and not @options.filter(relativePath, stats, fullPath)
      readStream.close()
      return
    
    @_opened++
    metadata = null
    parser = mm(readStream)
    parser.on('metadata', (md) ->
      metadata = md
    )
    
    parser.on('done', (err) =>
      @emit('file', relativePath, stats, fullPath, metadata)
      if err
        console.log('metadata parser error')
        @_onError(err)
      readStream.close()
      @_opened--
      @_onDone()
    )
    
  _onDone: ->
    return if !@_walkDone or @_opened > 0
    
    duration = Date.now() - @_started
    # console.log('%d ms', duration)
    
    # reset
    @_started = null
    @_walkDone = false
    
    @emit('done')
    
    
  start: ->
    if @_started
      console.error('Index already in progress...')
      return
    @_started = Date.now()
    @_walker.walk()
    
    
module.exports = MusicIndexer