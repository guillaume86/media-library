gulp = require 'gulp'
coffee = require 'gulp-coffee'
gutil = require 'gulp-util'
mocha = require 'gulp-mocha'

config =
  coffee: './src/*.coffee'
  tests: './test/*.coffee'

handle_errors = (stream) ->
  stream.on('error', (e) ->
    gutil.log(e)
    gutil.beep()
    stream.end()
  )

gulp.task('coffee', ->
  gulp.src(config.coffee)
    .pipe(handle_errors(coffee()))
    .pipe(gulp.dest('./lib/'))
)

gulp.task('test', ->
  gulp.src(config.tests, read: false)
    .pipe(mocha(
      #reporter: 'nyan'
      compilers: ['coffee:coffee-script/register']
    ))
)

gulp.task('watch', ['build'], ->
  gulp.watch([config.coffee], ['build'])
  gulp.watch(['./lib/*.js', config.tests], ['test'])
)

gulp.task('build', ['coffee'])
gulp.task('default', ['build'])
