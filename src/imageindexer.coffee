{EventEmitter} = require 'events'
filewalker = require './filewalker'
{dirname, basename} = require 'path'

IMAGE_FILE_REGEX = /\.(?:bmp|jpg|jpeg|gif)$/i
WALKER_OPTIONS =
  maxPending: 20 # throttle handles
  matchRegExp: IMAGE_FILE_REGEX

class ImageIndexer extends EventEmitter
  constructor: (@path, @options = {}) ->
    if @ not instanceof ImageIndexer
      return new ImageIndexer(@path, @options)
    
    @_walker = filewalker(@path, WALKER_OPTIONS)
    .on('dir', @_onDir.bind(@))
    .on('file', @_onFile.bind(@))
    .on('error', @_onError.bind(@))
    .on('done', @_onDone.bind(@))
    
  _onFile: (relativePath, stats, fullPath) ->
    directory = dirname(fullPath)
    @_results[directory] ?= []
    @_results[directory].push(
      fullPath: fullPath
      stats: stats
    )
    # console.log('file: %s, %d bytes', relativePath, stats.size)
    
  _onDir: (relativePath) ->
    # console.log('dir:  %s', relativePath)
    
  _onError: (err) ->
    console.error(err)
    @emit('error', err)
    
  _onDone: ->
    duration = Date.now() - @_started
    # console.log('%d ms', duration)
    # reset
    @_started = null
    @emit('done', @_results)
    
  start: ->
    if @_started
      console.error('Index already in progress...')
      return
    @_results = {}
    @_started = Date.now()
    @_walker.walk()
    @
    
    
module.exports = ImageIndexer
