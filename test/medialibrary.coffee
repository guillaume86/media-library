fs = require 'fs'
should = require 'should'
MediaLibrary = require '../lib/medialibrary'

dataset = require './dataset'
opts =
  paths: [dataset.path]

describe('MediaLibrary', () ->
  medialib = null

  beforeEach(->
    medialib = new MediaLibrary(opts)
  )

  describe('#scan()', () ->

    it('should return found tracks count', (done) ->
      medialib.scan()
        .then((count) ->
          count.should.equal(dataset.files.length)
          done()
        )
        .fail(done)
    )

    it('should notify progress', (done) ->
      notifyCount = 0
      medialib.scan()
        .progress((info) ->
          notifyCount++
        )
        .then((count) ->
          count.should.equal(dataset.files.length)
          notifyCount.should.equal(dataset.files.length)
          done()
        )
        .fail(done)
    )

    it('should insert path and metadata', (done) ->
      medialib.scan()
        .then(-> medialib.tracks())
        .then((tracks) ->
          track = tracks
            .filter((t) -> /Artist 1 - Track 1\.mp3$/.test(t.path))[0]
          track.should.be.ok
          track.root.should.ok
          track.path.should.ok
          track.title.should.ok
          track.artist.should.ok
          track.artist[0].should.ok
          done()
        )
        .fail(done)
    )

  )


  describe('#tracks()', () ->

    beforeEach((done) ->
      medialib.scan()
      .then(-> done())
      .fail(done)
    )

    it('should return tracks', (done) ->
      medialib.tracks()
        .then((tracks) ->
          tracks.should.be.instanceof(Array)
            .and.have.lengthOf(dataset.files.length)
          done()
        )
        .fail(done)
    )

  )


  describe('#artists()', () ->

    beforeEach((done) ->
      medialib.scan()
      .then(-> done())
      .fail(done)
    )

    it('should return distinct artists', (done) ->
      medialib.artists()
        .then((artists) ->
          artists.map((a) -> a.name).should.eql(['Artist 1', 'Artist 2'])
          done()
        )
        .fail(done)
    )

  )


  describe('#albums()', () ->

    beforeEach((done) ->
      medialib.scan()
      .then(-> done())
      .fail(done)
    )

    it('should return distinct albums', (done) ->
      medialib.albums()
        .then((albums) ->
          albums.map((a) -> a.artist)
            .should.eql(['Artist 1', 'Artist 2'])
          albums.map((a) -> a.title)
            .should.eql(['Album 1', 'Album 2'])
          done()
        )
        .fail(done)
    )

  )


  describe('#findTracks()', () ->

    beforeEach((done) ->
      medialib.scan()
      .then(-> done())
      .fail(done)
    )

    it('should find by artist', (done) ->
      medialib.findTracks(artist: 'Artist 1')
        .then((results) ->
          results.should.have.length(2)
          done()
        )
        .fail(done)
    )

    it('should find by title', (done) ->
      medialib.findTracks(title: 'Track 1')
        .then((results) ->
          results.should.have.length(2)
          done()
        )
        .fail(done)
    )

  )


  describe('#files()', () ->

    beforeEach((done) ->
      medialib.scan()
      .then(-> done())
      .fail(done)
    )

    it('should return root folder if called without argument', (done) ->
      medialib.files()
        .then((files) ->
          files.should.be.instanceof(Array).and.have.lengthOf(1)
          files[0].should.have.property('type', 'folder')
          files[0].should.have.property('name', 'data')
          done()
        )
        .fail(done)
    )

    it('should return subfolders when called with a folder path', (done) ->
      medialib.files(dataset.path)
        .then((files) ->
          files.filter((file) -> file.type == 'folder')
            .should.have.lengthOf(1)
          done()
        )
        .fail(done)
    )

    it('should return files when called with a folder path', (done) ->
      medialib.files(dataset.path)
        .then((files) ->
          files.filter((file) -> file.type == 'file')
            .should.have.lengthOf(3)
          done()
        )
        .fail(done)
    )

  )


)
