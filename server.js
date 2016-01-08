var app = require('./app')
  , http = require('http')

app.init(function() {
  http.createServer(app).listen(3001, function() {
    console.log('Listening on port', 3001)
  })
})
