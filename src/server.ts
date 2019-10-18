import express from "express";
import * as dotenv from "dotenv";
import { urlencoded } from "body-parser";
import { createMessageAdapter } from "@slack/interactive-messages";
import { Actions } from "./Actions";
import * as Sentry from '@sentry/node';

// Load Environment variables
dotenv.config();

// Verify required env varables are set
if (!process.env.SLACK_ACCESS_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    throw "Environment variables not properly loaded!";
}

// Configure Sentry exception logging
if (process.env.SENTRY_DSN) {
    const sentryConfig : Sentry.NodeOptions = {
        dsn: process.env.SENTRY_DSN,
        release: require('../package.json').version
    };
    if (process.env.ENVIRONMENT) sentryConfig.environment = process.env.ENVIRONMENT;
    Sentry.init(sentryConfig);
}

const PORT = process.env.PORT || 3000;

// Intialize Express app
const app = express();

// Intialize Slack Web client for sending requests
const actions = new Actions(process.env.SLACK_ACCESS_TOKEN);

// Ensure messages come from slack
const slackInteractions = createMessageAdapter(process.env.SLACK_SIGNING_SECRET);
app.use("/slack/actions", slackInteractions.expressMiddleware());

app.use(urlencoded({ extended: true }));

slackInteractions.action({ type: Actions.BUTTON_ACTION }, actions.onButtonAction);
slackInteractions.action({ type: Actions.STATIC_SELECT_ACTION }, actions.onStaticSelectAction);

app.post("/slack/commands", actions.createPollRoute);

app.listen(PORT, () => console.log(`In Or Out server running on ${PORT}`));

