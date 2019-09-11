import express from 'express';
import * as dotenv from 'dotenv';
import { urlencoded } from 'body-parser';
import { stringify } from 'qs';
import { createHmac, timingSafeEqual } from 'crypto';
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
app.use(urlencoded({ extended: true }));

app.use('/slack/commands', (req, res, next) => {
    const slackSignature = req.headers['x-slack-signature'] as string;
    const requestBody = stringify(req.body, { format: 'RFC1738' });
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    // Verify slack headers were received
    if (!(timestamp && requestBody && slackSignature)) {
        return res.send('Failed to receive proper headers')
    }
    // convert current time from milliseconds to seconds
    const time = Math.floor(new Date().getTime() / 1000);
    // Most likely a replay attack
    if (Math.abs(time - parseInt(timestamp)) > 300) {
        return res.send('Ignore this request.');
    }
    let sigBasestring = 'v0:' + timestamp + ':' + requestBody;
    let mySignature = 'v0=' +
        createHmac('sha256', slackSigningSecret)
            .update(sigBasestring, 'utf8')
            .digest('hex');
    // Safe against timing attacks
    if (timingSafeEqual(Buffer.from(mySignature, 'utf8'), Buffer.from(slackSignature, 'utf8'))) {
        next();
    } else {
        return res.status(200).send('Request verification failed');
    }
});

app.post('/slack/commands', (req, res) => {
    if (req.body.command === "/inorout") {
        // Create a new poll passing in the poll author and the other params
        const poll = new Poll(`<@${req.body.user_id}>`, req.body.text.split('\n'));
    } else {
        console.error(`Unregistered command ${req.body.command}`);
        res.send('Unhandled command');
    }
});

app.listen(PORT, () => {
    console.log(`In Or Out Server Running on ${PORT}`);
});

