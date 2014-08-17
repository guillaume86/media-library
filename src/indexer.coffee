fs = require 'fs'
joinPath = require('path').join
walk = require 'walk'
mm = require 'musicmetadata'

audiofileRegex = /\.(?:wav|mp3|wma|flac|ape|aac|m4a|ogg)$/i

indexPath = (path, foundCb, doneCb) ->
  pendingParsers = 0
  walkDone = false

  walker = walk.walk(path)

  # sort by name to get a better sense of progression
  walker.on('names', (root, nodeNamesArray) ->
    nodeNamesArray.sort((a, b) ->
      return 1 if a > b
      return -1 if a < b
      return 0
    )
  )

  walker.on("file", (root, fileStats, next) ->
    if !audiofileRegex.test(fileStats.name) or fileStats.size == 0
      next()
      return

    fullpath = joinPath(root, fileStats.name)
    stream = fs.createReadStream(fullpath)
    parser = mm(stream)

    pendingParsers++
    foundmetadata = false

    # listen for the metadata event
    parser.on('metadata', (result) ->
      foundmetadata = true
      foundCb(fullpath, result)
    )

    parser.on('done', (err) ->
      pendingParsers--
      if err
        console.log('parser error')
        console.log(err)
      stream.destroy()

      if !foundmetadata
        foundCb(fullpath, {})

      next()

      if walkDone and pendingParsers == 0
        doneCb()
    )

    #next()
  )

  walker.on('error', (err) ->
    console.log('walker error')
    console.log(err)
  )

  walker.on('end', ->
    if pendingParsers == 0
      doneCb()
    else
      walkDone = true
  )


module.exports = indexPath
