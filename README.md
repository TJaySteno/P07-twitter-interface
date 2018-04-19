## Project 7
### Twitter Interface

Using Node.js, request information from Twitter and display it in the provided interface. This information includes my own info, the 5 most recent posts on my home timeline, 5 of my followers, and up to 5 messages from my most recent conversation. Of course, information on Tweets and DMs such as likes, retweets, time since posting, etc. will be included. Overall, this project simulates converting information found on a public API into a template passed down from the design team.

*__Skills:__ Node.js, Express, Pug/Jade, Twitter API*

*__Personal Development Emphasis:__ Further review on async/await and APIs, and experimenting with Express middleware and Pug layouts*

---

### Instructions for Setup

This app uses the Twitter API and therefore requires an API key to use. This is just a simple matter of going to (https://apps.twitter.com)[https://apps.twitter.com] and applying for a free key. Make sure to go to 'Permissions' and give your key access to Read, Write, and Direct Messages, otherwise the app is likely to break down. Once that has been changed, go to 'Keys and Access Tokens' for your unique keys, plug them into the provided file 'config-template.js', and rename that file to 'config.js'.

Then just install dependencies and you're off!
