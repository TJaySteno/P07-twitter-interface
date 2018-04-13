// http://localhost:3000/

// get full tweets
// Displays 5 tweets, 5 friends, 5 messages, and username in a Jade/Pug template that roughly matches the mockups

// Allows users to post a new tweet.
// Add an ‘error’ route that renders a friendly error page when something goes wrong.
// Display a new tweet without having to refresh the page.
// Displays the user’s profile background image as the site header’s background

'use strict'

const express = require('express');
const pug = require('pug');
const Twit = require('twit');
const T = new Twit(require('./config'));

const app = express();
app.set('view engine', 'pug');
app.use(express.static('public'));


app.get('/', async (req, res, next) => {
  try {
    function getFromTwitter (extension, options) {
      return T.get(extension, options, (err, data, res) => {
        if (err) throw err;
        return data;
      });
    }

    function getTimeDifference (tweet) {
      const now = new Date();
      const offset = tweet.user.utc_offset;
      const posted = new Date(tweet.created_at).valueOf()
                     + offset;

      return Math.round((now - posted)
                      / (60*60*1000));
    }

    function trimTimeline (tweets) {
      const timeline = [];
      tweets.forEach(tweet => {
        timeline.push({
          profile_image_url: tweet.user.profile_image_url,
          name: tweet.user.name,
          screen_name: `@${tweet.user.screen_name}`,
          timestamp: getTimeDifference(tweet) + 'h',
          text: tweet.text,
          retweet_count: tweet.retweet_count,
          favorite_count: tweet.favorite_count,
          retweeted: tweet.retweeted,
          favorited: tweet.favorited
        });
      });
      return timeline;
    }

    function trimFollowing (users) {
      // name, pic, tag name, following or no
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

    async function getThem (message, self) {
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

    function getMessageTimeDiff (timestamp) {
      const now = new Date().valueOf();

      const time = Math.round((now - timestamp)
                                  / (60*60*1000));

      return time + ' hours ago';
    }

    async function trimMessages (messageData, self) {
      const messages = {};
      const senderID = messageData[0].message_create.sender_id;
      const recipientID = messageData[0].message_create.target.recipient_id;

      messages.them = await getThem(messageData[0].message_create, self);

      const oneConvo = messageData.filter(message => {
        return message.message_create.target.recipient_id === messages.them.user_id
            || message.message_create.sender_id === messages.them.user_id;
      });

      messages.conversation = [];
      oneConvo.forEach((message, i) => {
        const conversation = {
          text: message.message_create.message_data.text,
          timestamp: getMessageTimeDiff(message.created_timestamp)
        };

        if (recipientID === messages.them.user_id) conversation.source = 'me';
        else if (senderID === messages.them.user_id) conversation.source = 'them';

        messages.conversation.push(conversation);
      });

      return messages;
    }

    async function getProfile () {
      const profile = {};

      const self = await getFromTwitter('account/verify_credentials');
      profile.self = {
        screen_name: `@${self.data.screen_name}`,
        profile_image_url: self.data.profile_image_url,
        following: self.data.friends_count
      }

      const timeline = await getFromTwitter('statuses/home_timeline', { count: 5 });
      profile.timeline = trimTimeline(timeline.data);

      const following = await getFromTwitter('followers/list', { count: 5 });
      profile.following = trimFollowing(following.data.users);

      const messages = await getFromTwitter('direct_messages/events/list');
      profile.messages = await trimMessages(messages.data.events, profile.self);

      return profile;
    }

    res.profile = await getProfile();
    next();
  } catch (err) { next(err) }
}, (req, res, next) => {
  res.render('layout.pug', { globals: [res.profile] });
  next();
});

app.listen(3000, () => {console.log('\nListening on port 3000\n')} );

app.use((err, req, res, next) => { console.error(err + '\n') });
