fs = require 'fs'
should = require 'should'
MediaLibrary = require '../lib/medialibrary'

dataset = require './dataset'
opts =
  # databaseFile: './test/test-database.nedb' # commented to use in memory database
  paths: [dataset.path]

clearDatabase = ->
  if opts.databaseFile and fs.existsSync(opts.databaseFile)
    fs.unlinkSync(opts.databaseFile)



describe('MediaLibrary', () ->
  medialib = null

  beforeEach(->
    clearDatabase()
    medialib = new MediaLibrary(opts)
  )

  describe('#scan()', () ->

    it('should return found tracks count', (done) ->
      medialib.scan()
        .then((count) ->
          count.should.equal(dataset.files.length)
          done()
        )
    )

    it('should insert path and metadata', (done) ->
      medialib.scan()
        .then(-> medialib.tracks())
        .then((tracks) ->
          track = tracks.filter((t) -> /Artist 1 - Track 1\.mp3$/.test(t.path))[0]
          track.should.be.ok
          track.root.should.ok
          track.path.should.ok
          track.title.should.ok
          track.artist.should.ok
          track.artist[0].should.ok
          done()
        )
    )

  )

  describe('#tracks()', () ->

    beforeEach((done) ->
      medialib.scan().then(-> done())
    )

    it('should return tracks', (done) ->
      medialib.tracks()
        .then((tracks) ->
          tracks.should.be.instanceof(Array).and.have.lengthOf(dataset.files.length)
          done()
        )
    )

  )

  describe('#artists()', () ->

    beforeEach((done) ->
      medialib.scan().then(-> done())
    )

    it('should return distinct artists', (done) ->
      medialib.artists()
        .then((artists) ->
          artists.should.eql(['Artist 1', 'Artist 2'])
          done()
        )
    )

  )

  describe('#find()', () ->

    beforeEach((done) ->
      medialib.scan().then(-> done())
    )

    it('should find by artist', (done) ->
      medialib.find(artist: 'Artist 1')
        .then((results) ->
          results.should.have.length(2)
          done()
        )
    )

    it('should find by title', (done) ->
      medialib.find(title: 'Track 1')
        .then((results) ->
          results.should.have.length(2)
          done()
        )
    )

  )

)
