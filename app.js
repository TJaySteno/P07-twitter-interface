'use strict'

/************************************************
  DEPENDENCIES AND CREATE ROUTER
************************************************/

const express = require('express');
const pug = require('pug');
const bodyParser = require('body-parser');
const Twit = require('twit');
const T = new Twit(require('./config'));

const app = express();
app.use(express.static('public'));
app.set('view engine', 'pug');

/************************************************
  GENERAL FUNCTIONS
************************************************/

/* Generalist twit 'GET' function */
async function getFromTwitter(extension, options) {
  try {
    return await T.get(extension, options)
      .then(result => result)
      .catch(err => { throw err; });
  } catch (e) {
    if (e) { throw e; };
  };
};

/* Format time into a readable 'long' or 'short' timestamp
    Param 'time' is in seconds */
function getTimestamp(time, length) {
  if (time < 60) {
    return time + (length === 'long' ? ' seconds ago' : 's');
  } else if (time < 60 * 60) {
    return Math.round(time / 60) + (length === 'long' ? ' minutes ago' : 'm');
  } else if (time < 24 * 60 * 60) {
    return Math.round(time / (60 * 60)) + (length === 'long' ? ' hours ago' : 'h');
  } else {
    return Math.round(time / (24 * 60 * 60)) + (length === 'long' ? ' days ago' : 'd');
  }
}

/************************************************
  PROFILE.SELF
************************************************/

/* Trim down 'self.data' object to the essentials */
function trimSelfInfo(self) {
  return {
    screen_name: `@${self.screen_name}`,
    profile_image_url: self.profile_image_url,
    profile_banner_url: self.profile_banner_url,
    following: self.friends_count,
  };
}

/************************************************
  PROFILE.TIMELINE
************************************************/

/* Trim down 'timeline.data' object to the essentials */
function trimTimeline(tweets) {
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
      favorited: tweet.favorited,
    });
  });
  return timeline;
}

/***** TIMELINE FUNCTIONS **********************/

/* Calculate the time difference between now and a timeline post
    Returns short-form timestamp */
function getTimelineTimestamp(tweet) {
  const now = new Date();
  const offset = tweet.user.utc_offset;
  const timePosted = new Date(tweet.created_at).valueOf()
                     + offset;
  const timeElapsed = Math.round((now - timePosted) / 1000);
  return getTimestamp(timeElapsed, 'short');
}

/************************************************
  PROFILE.FOLLOWING
************************************************/

/* Trim down 'following.data' object to the essentials */
function trimFollowing(users) {
  const following = [];
  users.forEach(user => {
    following.push({
      name: user.name,
      screen_name: `@${user.screen_name}`,
      profile_image_url: user.profile_image_url,
      following: user.following,
    });
  });
  return following;
}

/************************************************
  PROFILE.MESSAGES
************************************************/

/* Trim down 'messages.data' object to the essentials */
async function trimMessageData(rawData, self) {
  try {
    const messages = {};

    messages.friend = await saveFriendInfo(rawData[0].message_create, self);

    const convoData = filterSingleConvo(rawData, messages.friend);
    messages.conversation = trimConvoData(convoData, messages.friend);
    messages.conversation.reverse();

    return messages;
  } catch (err) { throw err; };
}

/***** MESSAGE FUNCTIONS ***********************/

/* Given a DM, find relevant info on a friend */
async function saveFriendInfo(message, self) {
  try {
    const recipientID = message.target.recipient_id;
    const senderID = message.sender_id;
    const recipient = await getFromTwitter('users/lookup', { user_id: recipientID });
    const sender = await getFromTwitter('users/lookup', { user_id: senderID });

    if ('@' + recipient.data[0].screen_name === self.screen_name) {
      return {
        name: sender.data[0].name,
        profile_image_url: sender.data[0].profile_image_url,
        user_id: message.sender_id,
      };
    } else if ('@' + sender.data[0].screen_name === self.screen_name) {
      return {
        name: recipient.data[0].name,
        profile_image_url: recipient.data[0].profile_image_url,
        user_id: message.target.recipient_id,
      };
    }
  } catch (err) { throw err; };
}

/* From an array of all recent messages, return only the ones from a given friend */
function filterSingleConvo(data, friend) {
  return data.filter(message => {
    const recipient = message.message_create.target.recipient_id;
    const sender = message.message_create.sender_id;
    return recipient === friend.user_id
        || sender    === friend.user_id;
  });
}

/* Trim down a raw conversation array to the essentials */
function trimConvoData(convoData, friend) {
  const conversation = [];

  for (let i = 0; i < 5; i++) {
    const message = {};
    const sender = convoData[i].message_create.sender_id;

    message.text = convoData[i].message_create.message_data.text;
    message.timestamp = getMessageTimeDiff(convoData[i].created_timestamp);
    // Potentially unused vars
    // if (sender === friend.user_id) message.source = 'friend';
    // else message.source = 'me';

    conversation.push(message);
  };

  return conversation;
}

/* Calculate the time difference between message posting and now
    Returns long-form timestamp */
function getMessageTimeDiff(timestamp) {
  const now = new Date().valueOf();
  const timeElapsed = Math.round((now - timestamp) / (1000));
  return getTimestamp(timeElapsed, 'long');
}

/************************************************
  EXECUTE
************************************************/

/* Store relevant profile information in 'res.profile' object */
app.get('/', async (req, res, next) => {
  try {
    /* Get info on user's profile */
    res.profile = {};
    const self = await getFromTwitter('account/verify_credentials');
    res.profile.self = trimSelfInfo(self.data);
    next();
  } catch (err) {
    if (!err.message) err.message = 'Problem getting user information from Twitter';
    next(err);
  };
}, async (req, res, next) => {
  try {
    /* Get info on user's tweets */
    const timeline = await getFromTwitter('statuses/user_timeline', { count: 5 });
    res.profile.timeline = trimTimeline(timeline.data);
    next();
  } catch (err) {
    if (!err.message) err.message = 'Problem getting timeline from Twitter';
    next(err);
  };
}, async (req, res, next) => {
  try {
    /* Get info on user's followers */
    const following = await getFromTwitter('followers/list', { count: 5 });
    res.profile.following = trimFollowing(following.data.users);
    next();
  } catch (err) {
    if (!err.message) err.message = 'Problem getting followers from Twitter';
    next(err);
  };
}, async (req, res, next) => {
  try {
    /* Get info on user's direct messages */
    const messages = await getFromTwitter('direct_messages/events/list');
    if (messages.data.errors) throw messages.data.errors[0];
    res.profile.messages = await trimMessageData(messages.data.events, res.profile.self);
    next();
  } catch (err) {
    if (!err.message) err.message = 'Problem getting direct messages from Twitter';
    next(err);
  };
});

/* Render the page using the assembled profile info */
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

/* Retrieve a tweet from the request parameters, post it to Twitter, and refresh the page */
app.get('/tweet/:encodedTweet', (req, res, next) => {
  try {
    const tweet = decodeURI(req.params.encodedTweet);

    T.post('statuses/update', { status: tweet }, function (err, data, response) {
      if (err) throw err;
      else console.log(`'${data.text}' posted to Twitter`);
    });

    res.redirect('/');
  } catch (err) { next(err); }
});

/* View on http://localhost:3000 */
app.listen(3000, () => {
  console.log('\nListening on port 3000\n');
});

/* Error handler */
app.use((err, req, res, next) => {
  if (!err.statusCode) {
    if (err.code) err.statusCode = err.code;
    else err.statusCode = 500;
  }

  console.error(err);
  const fakeProfile = {
    self: {
      profile_banner_url: '',
      screen_name: '',
    },
  };
  res.render('error', { globals: [fakeProfile, err] });
});
