{relative} = require('path')
should = require 'should'
indexer = require '../lib/musicindexer'

dataset = require './dataset'

describe('musicindexer', ->
  describe('#()', () ->
    it('should find audio files', (done) ->
      tracks = []
      foundTrack = (rpath, stats, path, md) ->
        tracks.push { path, md }
      finished = ->
        tracks.should.have.length(dataset.files.length)
        done()
        
      indexer(dataset.path)
      .on('file', foundTrack)
      .on('done', finished)
      .start()
    )

    it('should parse metadata', (done) ->
      tracks = []
      foundTrack = (rpath, stats, path, md) ->
        tracks.push(md || {})
      finished = ->
        track = tracks.filter((t) -> t.title == 'Track 1')[0]
        track.should.ok
        track.artist.should.eql(['Artist 1'])
        done()
      
      indexer(dataset.path)
      .on('file', foundTrack)
      .on('done', finished)
      .start()
    )
    
    it('should use filter', (done) ->
      tracks = []
      ignorePath = dataset.files[0]
      filter = (p) ->
        ignorePath != p
        
      foundTrack = (rpath, stats, path, md) ->
        tracks.push { path, md }
        
      finished = ->
        tracks.should.have.length(dataset.files.length - 1)
        done()
        
      indexer(dataset.path, {filter: filter})
      .on('file', foundTrack)
      .on('done', finished)
      .start()
    )
  )
)
