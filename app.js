'use strict'

/************************************************
  DEPENDENCIES AND CREATE ROUTER
************************************************/

const express = require('express');
const pug = require('pug');
const bodyParser = require('body-parser')
const Twit = require('twit');
const T = new Twit(require('./config'));

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());
app.set('view engine', 'pug');

/************************************************
  GENERAL FUNCTIONS
************************************************/

// General 'twit' query function
function getFromTwitter (extension, options) {
  return T.get(extension, options, (err, data, res) => data)
    .catch(err => { throw err });
}

// Format time (passed in seconds) into a readable 'long' or 'short' timestamp
function getTimestampMessage (time, length) {
  if (time < 60) return time + (length === 'long' ? ' seconds ago' : 's');
  else if (time < 60*60) return Math.round(time/60) + (length === 'long' ? ' minutes ago' : 'm');
  else if (time < 24*60*60) return Math.round(time/(60*60)) + (length === 'long' ? ' hours ago' : 'h');
  else return Math.round(time/(24*60*60)) + (length === 'long' ? ' days ago' : 'd');
}

/************************************************
  PROFILE.SELF
************************************************/

// Trim down 'self.data' object to the essentials
function trimSelfInfo (self) {
  return {
    screen_name: `@${self.screen_name}`,
    profile_image_url: self.profile_image_url,
    profile_banner_url: self.profile_banner_url,
    following: self.friends_count
  }
}

/************************************************
  PROFILE.TIMELINE
************************************************/

// Trim down 'timeline.data' object to the essentials
function trimTimeline (tweets) {
  const timeline = [];
  tweets.forEach(tweet => {
    timeline.push({
      profile_image_url: tweet.user.profile_image_url,
      name: tweet.user.name,
      screen_name: `@${tweet.user.screen_name}`,
      timestamp: getTimelineTimestamp(tweet),
      text: tweet.text,
      retweet_count: tweet.retweet_count,
      favorite_count: tweet.favorite_count,
      retweeted: tweet.retweeted,
      favorited: tweet.favorited
    });
  });
  return timeline;
}

/***** TIMELINE FUNCTIONS **********************/

// Calculate the time difference between now and a timeline post; returns short-form timestamp
function getTimelineTimestamp (tweet) {
  const now = new Date();
  const offset = tweet.user.utc_offset;
  const timePosted = new Date(tweet.created_at).valueOf()
                     + offset;
  const timeElapsed = Math.round((now - timePosted) / 1000);
  return getTimestampMessage(timeElapsed, 'short');
}

/************************************************
  PROFILE.FOLLOWING
************************************************/

// Trim down 'following.data' object to the essentials
function trimFollowing (users) {
  const following = [];
  users.forEach(user => {
    following.push({
      name: user.name,
      screen_name: `@${user.screen_name}`,
      profile_image_url: user.profile_image_url,
      following: user.following
    });
  });
  return following;
}

/************************************************
  PROFILE.MESSAGES
************************************************/

// Trim down 'messages.data' object to the essentials
async function trimMessages (rawData, self) {
  const messages = {};

  messages.friend = await getFriendInfo(rawData[0].message_create, self);

  const rawConversation = filterSingleConversation(rawData, messages.friend);
  messages.conversation = trimConversation(rawConversation, messages.friend)
  messages.conversation.reverse();

  return messages;
}

/***** MESSAGE FUNCTIONS ***********************/

// Using the most recent message, figure out who the other party is; return an object containing their info
async function getFriendInfo (message, self) {
  const recipient = await getFromTwitter('users/lookup', { user_id: message.target.recipient_id });
  const sender = await getFromTwitter('users/lookup', { user_id: message.sender_id });

  if ("@" + recipient.data[0].screen_name === self.screen_name) {
    return {
      name: sender.data[0].name,
      profile_image_url: sender.data[0].profile_image_url,
      user_id: message.sender_id
    }
  } else if ("@" + sender.data[0].screen_name === self.screen_name) {
    return {
      name: recipient.data[0].name,
      profile_image_url: recipient.data[0].profile_image_url,
      user_id: message.target.recipient_id
    }
  } else { throw new Error('There was trouble retrieving your messages.') }
}

// Filter out messages other than ones from the most recent person that messaged you
function filterSingleConversation (data, friend) {
  return data.filter(message => {
    const recipient = message.message_create.target.recipient_id;
    const sender = message.message_create.sender_id;
    return recipient === friend.user_id
        || sender    === friend.user_id;
  });
}

// Trim down a raw conversation array to the essentials
  // Each message: text, timestamp, source
function trimConversation (rawConversation, friend) {
  const conversation = [];

  for (let i = 0; i < 5; i++) {
    const message = {
      text: rawConversation[i].message_create.message_data.text,
      timestamp: getMessageTimeDiff(rawConversation[i].created_timestamp)
    };

    const sender = rawConversation[i].message_create.sender_id;
    if (sender === friend.user_id) message.source = 'friend';
    else message.source = 'me';

    conversation.push(message);
  };

  return conversation;
}

// Calculate the time difference between now and a message; returns long-form timestamp
function getMessageTimeDiff (timestamp) {
  const now = new Date().valueOf();
  const timeElapsed = Math.round((now - timestamp) / (1000));
  return getTimestampMessage(timeElapsed, 'long');
}



/************************************************
  EXECUTE
************************************************/

// Store relevant profile information in 'res.profile' object
app.get('/', async (req, res, next) => {
  try {
    res.profile = {};
    const self = await getFromTwitter('account/verify_credentials');
    res.profile.self = trimSelfInfo(self.data)
    next();
  } catch (err) {
    if (!err.message) err.message = 'Problem getting user information from Twitter';
    err.statusCode = 500;
    next(err);
  };
}, async (req, res, next) => {
  try {
    const timeline = await getFromTwitter('statuses/home_timeline', { count: 5 });
    res.profile.timeline = trimTimeline(timeline.data);
    next();
  } catch (err) {
    err.message = 'Problem getting timeline from Twitter';
    err.statusCode = 500;
    next(err);
  };
}, async (req, res, next) => {
  try {
    const following = await getFromTwitter('followers/list', { count: 5 });
    res.profile.following = trimFollowing(following.data.users);
    next();
  } catch (err) {
    err.message = 'Problem getting followers from Twitter';
    err.statusCode = 500;
    next(err);
  };
}, async (req, res, next) => {
  try {
    const messages = await getFromTwitter('direct_messages/events/list');
    res.profile.messages = await trimMessages(messages.data.events, res.profile.self);
    next();
  } catch (err) {
    err.message = 'Problem getting direct messages from Twitter';
    err.statusCode = 500;
    next(err);
  };
});

// Using 'res.profile', render the page with PUG
app.get('/', (req, res, next) => {
  try {
    res.render('main', { globals: [res.profile] });
    next();
  } catch (err) {
    err.message = 'There was a problem rendering the page';
    err.statusCode = 500;
    next(err);
  };
});




// On submission of new Tweet, upload it to Twitter and immediately display in interface
app.post('/', (req, res, next) => {
  console.log(req.body);
  res.setHeader('Content-Type', 'text/plain')
  res.write('you posted:\n')
  res.end(JSON.stringify(req.body, null, 2))





  // T.post('statuses/update', { status: 'hello world!' }, function(err, data, response) {
  //   console.log(data)
  // })
});
  // NOTE: Allows users to post a new tweet. exceeds
  // NOTE: Display a new tweet without having to refresh the page. (onSubmit is fine)

// Listen on port 3000
app.listen(3000, () => { console.log('\nListening on port 3000\n') } );

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  const fakeProfile = { self: { profile_banner_url: '', screen_name: ''} }
  res.render('error', { globals: [fakeProfile, err] });
});
