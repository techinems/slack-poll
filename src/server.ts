import express from "express";
import * as dotenv from "dotenv";
import { urlencoded } from "body-parser";
import { createMessageAdapter } from "@slack/interactive-messages";
import { Actions } from "./Actions";
import { Sentry } = require('@sentry/node');

// Configure Sentry exception logging
if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN });
}

// Load Environment variables
dotenv.config();

// Load in the environment variables
const SLACK_ACCESS_TOKEN = process.env.SLACK_ACCESS_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

const PORT = process.env.PORT || 3000;

if (!(SLACK_ACCESS_TOKEN && SLACK_SIGNING_SECRET)) {
    throw "Environment variables not properly loaded!";
}

// Intialize Express app
const app = express();

// Intialize Slack Web client for sending requests
const actions = new Actions(SLACK_ACCESS_TOKEN);

// Ensure messages come from slack
const slackInteractions = createMessageAdapter(SLACK_SIGNING_SECRET);
app.use("/slack/actions", slackInteractions.expressMiddleware());

app.use(urlencoded({ extended: true }));

slackInteractions.action({ type: Actions.BUTTON_ACTION }, actions.onButtonAction);
slackInteractions.action({ type: Actions.STATIC_SELECT_ACTION }, actions.onStaticSelectAction);

app.post("/slack/commands", actions.createPollRoute);

app.listen(PORT, () => console.log(`In Or Out server running on ${PORT}`));

