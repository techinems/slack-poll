# slack-poll
[![Maintainability](https://api.codeclimate.com/v1/badges/0a764a4c908cda530ba9/maintainability)](https://codeclimate.com/github/rpiambulance/slack-poll/maintainability) 
[![Build Status](https://cloud.drone.io/api/badges/rpiambulance/slack-poll/status.svg)](https://cloud.drone.io/rpiambulance/slack-poll)


A simple databaseless polling app for Slack

## How to Setup
1. Create a Slack App with slash command and chat:write bot scope
2. Add a slash command of /inorout and an interactive message and provide your server's url + /slack/commands if it's the command url and /slack/actions if it is the interactive messages url in the required fields on slack's website.
3. Fill out the .env file with the necessary tokens.
4. npm start
5. You're done!

## How to Use
```
/inorout Question
:emoji: Answer
:emoji2: Answer 2
...
:emojin: Answer n
```

Emojis are optional but always fun :)
