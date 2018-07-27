# slack-poll
A simple databaseless polling app for Slack

## How to Setup
1. Create a Slack App with slash command and chat:write bot scope
2. Add a slash command of /inorout and an interactive message and provide your server's url + /slack/commands if it's the command url and /slack/actions if it is the interactive messages url in the required fields on slack's website.
3. Fill out the .env file with the necessary tokens.
4. npm start
5. You're done!

## How to Use
/inorout Question
:emoji: Answer
:emoji2: Answer2
etc.

Emojis are optional but always fun :)
