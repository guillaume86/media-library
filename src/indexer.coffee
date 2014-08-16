fs = require 'fs'
joinPath = require('path').join
walk = require 'walk'
mm = require 'musicmetadata'

audiofileRegex = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i

indexPath = (path, foundCb, doneCb) ->
  parserCount = 0
  waitingParser = false

  walker = walk.walk(path)
  walker.on("file", (root, fileStats, next) ->
    if !audiofileRegex.test(fileStats.name)
      next()
      return

    fullpath = joinPath(root, fileStats.name)
    # console.log(fullpath)
    stream = fs.createReadStream(fullpath)
    parser = mm(stream)
    foundmetadata = false

    # listen for the metadata event
    parserCount++
    parser.on('metadata', (result) ->
      foundmetadata = true
      foundCb(fullpath, result)
      next()
    )

    parser.on('done', (err) ->
      parserCount--
      if err
        console.log('parser error')
        console.log(err)
      stream.destroy()

      if !foundmetadata
        foundCb(fullpath, {})

      next()

      if parserCount == 0 and waitingParser
        doneCb()
    )
  )

  walker.on('error', (err) ->
    console.log('walker error')
    console.log(err)
  )

  walker.on('end', (args...) ->
    if parserCount == 0
      doneCb()
    else
      waitingParser = true
  )


module.exports = indexPath
