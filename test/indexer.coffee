pathSep = require('path').sep
should = require 'should'
indexer = require '../lib/indexer'

dataset = require './dataset'

describe('indexer', () ->
  describe('#()', () ->
    it('should find audio files', (done) ->
      tracks = []
      foundTrack = (path, md) ->
        tracks.push { path, md }
      finished = () ->
        tracks.should.have.length(dataset.files.length)
        done()
      indexer(dataset.path, foundTrack, finished)
    )

    it('should parse metadata', (done) ->
      tracks = []
      foundTrack = (path, md) ->
        tracks.push { path, md }
      finished = () ->
        tracks[0].should.have.property('md').ok
        tracks[0].md.title.should.equal('Track 1')
        tracks[0].md.artist.should.eql(['Artist 1'])
        done()
      indexer(dataset.path, foundTrack, finished)
    )
  )
)
