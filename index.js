var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird'); // Better promise module than default.
var monitor = require('./js/monitor-twitter/index.js'); // Use a local copy of this module with custom modifications.
var app = express();
var http = require('http');
var Vue = require('vue');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

// Twitter Credentials
var twitterConfig = {
  consumer_key: process.env.TWITTER_KEY,
  consumer_secret: process.env.TWITTER_SECRET,
  access_token: process.env.TWITTER_TOKEN,
  access_token_secret: process.env.TWITTER_TOKEN_SECRET
};

// Twilio Credentials
var accountSid = process.env.TWILIO_SID;//'ACc2b1e9225063964a202aa5d04ba71746';
var authToken = process.env.TWILIO_TOKEN;

//require the Twilio module and create a REST client
var client = require('twilio')(accountSid, authToken);

// MongoLab credentials
var mongouri = process.env.MONGOLAB_URI;
var db = mongoose.connect(mongouri);

// Database Schema Information
var SCHEMA = require('./js/schema.js');
var User = mongoose.model('User', SCHEMA.userSchema);
var Item = mongoose.model('Item', SCHEMA.itemSchema);

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// views is directory for all template files - we're just using the default Heroku app ones for now.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  //response.send('Warframe Text Alerts is working! Path Hit: ' + request.url);
  response.render('pages/index', {
    displayedTweetHTML: displayedTweetHTML,
  });
});

server.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

// Initial Variables for main block.
var displayedTweetHTML = "<p>No recent tweets to display.</p>";
var m = new monitor(twitterConfig);
var accountName = 'WarframeAlerts';

// This block sets up a regEX match for every item we want to monitor.
Item.find({}, 'name', {multi: true}, function(err){
  console.log("Obtained item data.");
}).then(function(itemData){
  regexString = "cr|";
  for (var i = 0; i < itemData.length; ++i) {
    regexString += itemData[i]['name'];
    console.log("Item "+(i+1).toString()+": "+itemData[i]['name']);
    if (i < itemData.length - 1) { regexString += "|"; }
  }
  console.log("Final RegEx: \n"+regexString+"\n");
  m.start(accountName, regexString, 30 * 1000);
  return;
});

// Create a socket for displayedTweetHTML
var currentTweet = "<p>No matching tweets found yet.</p>"
io.on('connection', function (socket) {
  // Rapid Emitter for Testing
  /*
  setInterval(function(){
    socket.emit('displayedTweetHTML', { displayedTweetHTML: "<p>"+x.toString()+"</p>" });
    x += 1;
  }, 5000);*/
  socket.emit('connection', "Success.");
  socket.emit('displayedTweetHTML', { displayedTweetHTML: currentTweet })
});

// Called when a matching tweet is received.
m.on(accountName, function(tweet) {
  console.log('Warframe Alert Tweet:', JSON.stringify(tweet));
  twitterURL = 'https://publish.twitter.com/oembed';
  queryString = {url: 'https://twitter.com/'+accountName+'/status/'+tweet['id']};

  // Request the HTML version of the matching Tweet. Done asynchronously.
  request({url: twitterURL, qs: queryString}, function (error, response, body) {
    currentTweet = JSON.parse(body)['html'];
    console.log("HTML: \n"+currentTweet);
    io.emit('displayedTweetHTML', { displayedTweetHTML: currentTweet });
  });

  //sendSMSMessage(tweet['text']);

});

function sendSMSMessage(text) {
  // Send texts to all subscribers.
  User.find({}, 'name phoneNumber', {multi: true}, function(err){
    console.log("Obtained user data.");
  }).then(function(userData){
    for (var i = 0; i < userData.length; ++i) {
      client.messages.create({
          to: userData[i]['phoneNumber'],
          from: process.env.TWILIO_NUMBER,
          body: "Hello "+userData[i]['name']+",\n"+
          "The following Warframe Alert has been released: \n\n"+text,
      }, function(err, message) {
          console.log(message.sid);
      });
    }
    return;
  });
}
