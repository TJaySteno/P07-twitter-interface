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

function getFromTwitter (extension, options) {
  return T.get(extension, options, (err, data, res) => {
    if (err) throw err;
    return data;
  });
}

function getTimestampMessage (time, length) {
  if (time < 60) return time + (length === 'long' ? ' seconds ago' : 's');
  else if (time < 60*60) return Math.round(time/60) + (length === 'long' ? ' minutes ago' : 'm');
  else if (time < 24*60*60) return Math.round(time/(60*60)) + (length === 'long' ? ' hours ago' : 'h');
  else return Math.round(time/(24*60*60)) + (length === 'long' ? ' days ago' : 'd');
}

/************************************************
  PROFILE.SELF
************************************************/

function trimSelfInfo (self) {
  return {
    screen_name: `@${self.screen_name}`,
    profile_image_url: self.profile_image_url,
    profile_background_image_url: self.profile_background_image_url,
      // NOTE: Displays the user’s profile background image as the site header’s background
    following: self.friends_count
  }
}

/************************************************
  PROFILE.TIMELINE
************************************************/

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

async function trimMessages (messageData, self) {
  const messages = { conversation: [] };

  messages.friend = await getFriendInfo(messageData[0].message_create, self);
  const conversation = filterSingleConversation(messageData, messages);

  for (let i = 0; i < 5; i++) {
    const message = {
      text: conversation[i].message_create.message_data.text,
      timestamp: getMessageTimeDiff(conversation[i].created_timestamp)
    };

    const sender = conversation[i].message_create.sender_id;
    if (sender === messages.friend.user_id) message.source = 'friend';
    else message.source = 'me';

    messages.conversation.push(message);
  };

  messages.conversation.reverse();

  return messages;
}

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

function filterSingleConversation (data, messages) {
  return data.filter(message => {
    const recipient = message.message_create.target.recipient_id;
    const sender = message.message_create.sender_id;
    return recipient === messages.friend.user_id
        || sender    === messages.friend.user_id;
  });
}

function getMessageTimeDiff (timestamp) {
  const now = new Date().valueOf();
  const timeElapsed = Math.round((now - timestamp) / (1000));
  return getTimestampMessage(timeElapsed, 'long');
}

/************************************************
  EXECUTE
************************************************/

// Store relevant profile information in 'res.profile' object
app.get(async (req, res, next) => {
  res.profile = {};
  const self = await getFromTwitter('account/verify_credentials');
  res.profile.self = trimSelfInfo(self.data)
  next();
}, async (req, res, next) => {
  const timeline = await getFromTwitter('statuses/home_timeline', { count: 5 });
  res.profile.timeline = trimTimeline(timeline.data);
  next();
}, async (req, res, next) => {
  const following = await getFromTwitter('followers/list', { count: 5 });
  res.profile.following = trimFollowing(following.data.users);
  next();
}, async (req, res, next) => {
  const messages = await getFromTwitter('direct_messages/events/list');
  res.profile.messages = await trimMessages(messages.data.events, res.profile.self);
  next();
});

// Using 'res.profile', render the page with PUG
app.get((req, res, next) => {
  res.render('layout.pug', { globals: [res.profile] });
  next();
});

// On submission of new Tweet, upload it to Twitter and immediately display in interface
// app.post((req, res, next) => {})
  // NOTE: Allows users to post a new tweet. exceeds
  // NOTE: Display a new tweet without having to refresh the page.

// Listen on port 3000
app.listen(3000, () => {console.log('\nListening on port 3000\n')} );

// Error handler
app.use((err, req, res, next) => { console.error(err) });
  // NOTE: Add an ‘error’ route that renders a friendly error page when something goes wrong.
