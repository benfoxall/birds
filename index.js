require('dotenv').load();

var request = require('request');
var bodyParser = require('body-parser');
var multipart = require('connect-multiparty');
var express = require('express');
var app = express();
var HTMLing = require('htmling');

var Pusher = require('pusher');
 
var pusher = new Pusher({
  appId:  process.env.PUSHER_APP,
  key:    process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET
});


var Redis = require('ioredis');
var redis = new Redis(process.env.REDISTOGO_URL);

// expire stuff after a week
var week = 60*60*24*7;

app.use(express.static('public'));



app.engine('html', HTMLing.express(__dirname + '/views/',
   {watch: process.env.NODE_ENV != 'production'})
);
app.set('view engine', 'html');

app.post('/', 
  bodyParser.urlencoded({ extended: false }),
  multipart(),
  function (req, res) {

  var keys = "lat_min lon_min lat_max lon_max".split(' ');

  var missing = keys.filter(function(k){ return !req.body[k];});
  if(missing.length) return res.status(400).send({required: missing});

  var box = keys.map(function(k){ return req.body[k];});

  request('http://www.xeno-canto.org/api/2/recordings?query=q:A box:' + box.join(','))
    .pipe(res);
});

// cors issues with webAudio
app.get(/\/proxy\/(.*)/, function(req, res){
  request('http://www.xeno-canto.org/' + req.params[0])
    .pipe(res);
});


app.post('/start', 
  bodyParser.urlencoded({ extended: false }),
  multipart(),
  function (req, res, next) {

    console.log(req.body);

    var birds = req.body.birds.split(/\r?\n/);
    if(!birds.length) return next();

    // get the next url
    redis.incr('url_base', function (err, i) {

      if(err) return next(err);

      var key = (Math.random()).toString(36).slice(2);

      // set all the data and redirect
      // to manage page
      redis
        .multi()

        .set('pub-key-' + i, key)
        .sadd('birds-' + i, birds)

        .expire('pub-key-' + i, week)
        .expire('birds-' + i, week)

        .exec(function(err){
          if(err) return next(err);
          var url = '/flock/' + i + '/' + key;
          res.redirect(url);
        })
    });
  });



app.get('/flock/:id', flock,
  function(req, res){
    res.render('bird', req);
})

app.get('/flock/:id/:key', flock, flockAuth,
  function(req, res){
    res.render('controller', req);
})


app.post('/flock/:id/:key', flock, flockAuth,
  bodyParser.urlencoded({ extended: false }),
  multipart(), function(req, res){

    pusher.trigger('flock-' + req.key, 'test_event', { message: "hello world" });

    res.send("done");
})

function flock(req, res, next){
  var id = req.params.id;
  redis
    .multi()
    .get('pub-key-' + id)
    .smembers('birds-' + id)
    .exec()
    .then(function(results){
      req.key   = results[0][1];
      req.birds = results[1][1];
      next();
    }, next)
}

function flockAuth (req, res, next){
  if(req.params.key !== req.key)
    return res.status(403).send('Forbidden');
  next();
};

var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('Started - http://%s:%s', host, port);
});
