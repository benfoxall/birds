var request = require('request');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();

app.use(express.static('public'));

app.post('/', 
  bodyParser.urlencoded({ extended: false }),
  function (req, res) {

  var keys = "lat_min lon_min lat_max lon_max".split(' ');

  var missing = keys.filter(function(k){ return !req.body[k];});
  if(missing.length) return res.status(400).send({required: missing});

  var box = keys.map(function(k){ return req.body[k];});

  request('http://www.xeno-canto.org/api/2/recordings?query=q:A box:' + box.join(','))
    .pipe(res);
});

var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Started - http://%s:%s', host, port);
});
