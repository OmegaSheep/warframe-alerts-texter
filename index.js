var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
mongoose.Promise = require('bluebird'); // Better promise module than default.
var monitor = require('monitor-twitter');
var app = express();

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
  response.send('Warframe Text Alerts is working! Path Hit: ' + request.url);
});

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

app.get('/testmessage', function(request, response) {
  client.messages.create({
      to: process.env.TEST_NUMBER,
      from: process.env.TWILIO_NUMBER,
      body: "The test message has been called."
  }, function(err, message) {
      response.send(message.sid);
  });
  response.send('Message sent to test number.');
});

// Initial Variables for main block.
var m = new monitor(twitterConfig);
var accountName = 'warframealerts';

// This block sets up a regEX match for every item we want to monitor.
Item.find({}, 'name', {multi: true}, function(err){
  console.log("Obtained item data.");
}).then(function(itemData){
  for (var i = 0; i < itemData.length; ++i) {
    m.start(accountName, itemData[i]['name'], 30 * 1000);
    console.log("Item "+str(i+1)+": "+itemData[i]['name']);
  }
  return;
});

// Called when a matching tweet is received.
m.on(accountName, function(tweet) {
  console.log('Warframe Alert Tweet:', tweet);

  User.find({}, 'name phoneNumber', {multi: true}, function(err){
    console.log("Obtained user data.");
  }).then(function(userData){
    for (var i = 0; i < userData.length; ++i) {
      client.messages.create({
          to: userData[i]['phoneNumber'],
          from: process.env.TWILIO_NUMBER,
          body: "Hello "+userData[i]['name']+",\n"+
          "The following Warframe Alert has been released: \n\n"+tweet,
      }, function(err, message) {
          console.log(message.sid);
      });
    }
    return;
  });
});
