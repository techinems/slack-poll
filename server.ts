import express from 'express';
import * as dotenv from 'dotenv';
import { urlencoded } from 'body-parser';
import { createMessageAdapter } from '@slack/interactive-messages';
import { WebClient } from '@slack/web-api';
import { Poll } from './Poll';

// Load Environment variables
dotenv.config();

// Load in the environment variables
const slackAccessToken = process.env.SLACK_ACCESS_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

const PORT = process.env.PORT || 3000;

if (!(slackAccessToken && slackSigningSecret)) {
    throw "Environment variables not properyl loaded!";
}

// Intialize Express app
const app = express();

// Intialize Slack Web client for sending requests
const webclient = new WebClient(slackAccessToken);

// Ensure messages come from slack
const slackInteractions = createMessageAdapter(slackSigningSecret);
app.use('/slack/commands', slackInteractions.requestListener());

app.use(urlencoded({ extended: true }));

app.post('/slack/commands', (req, res) => {
    if (req.body.command === "/inorout") {
        // Create a new poll passing in the poll author and the other params
        const poll = new Poll(`<@${req.body.user_id}>`, req.body.text.split('\n'));
        webclient.chat.postMessage({ channel: req.body.channel_id, text: 'Unable to render block content.', as_user: false, blocks: poll.getBlocks() })
    } else {
        console.error(`Unregistered command ${req.body.command}`);
        res.send('Unhandled command');
    }
});

app.listen(PORT, () => {
    console.log(`In Or Out Server Running on ${PORT}`);
});

