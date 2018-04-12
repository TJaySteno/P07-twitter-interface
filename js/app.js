'use strict'

const express = require('express');
const pug = require('pug');
const Twit = require('twit');
const T = new Twit(require('./config'));

const app = express();

async function getProfile () {
  try {
    const profile = await T.get('account/settings', async (err, data, response) => await data);
    const screenName = profile.data.screen_name
    console.log(screenName);
  } catch (err) { handle(err) }
}


async function post (message) {
  await T.post('statuses/update', { status: message },
    function (err, data, response) {
      if (err) throw err;
      console.log(data);
  });
}

async function getTweets () {
  T.get(`statuses/lookup`, { count: 5 },
    function(err, data, response) {
      if (err) throw err;
      console.log(data)
  });
}

function getFollowers () {
  T.get('followers/ids', { screen_name: screenName },
    function (err, data, response) {
      if (err) throw err;
      console.log(data)
  });
}

function getMessages () {
  T.get('direct_messages/events/list', { q: 'banana since:2011-07-11', count: 5 },
    function(err, data, response) {
      if (err) throw err;
      console.log(data)
  });
}

function handle (err) {
  console.error(err);
}

getProfile();
