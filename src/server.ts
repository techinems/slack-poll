import type { IncomingMessage, ServerResponse } from "http";
import * as dotenv from "dotenv";
import { App, HTTPReceiver } from "@slack/bolt";
import { Actions } from "./Actions";
import * as Sentry from "@sentry/node";
import * as fs from "fs";

// Load Environment variables
dotenv.config();

// Verify required env varables are set
if (!process.env.SLACK_ACCESS_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    throw new Error("Environment variables not properly loaded!");
}

// Configure Sentry exception logging
if (process.env.SENTRY_DSN) {
    const packageJson = JSON.parse(fs.readFileSync("./package.json").toString());
    const sentryConfig: Sentry.NodeOptions = {
        dsn: process.env.SENTRY_DSN,
        release: `slack-poll@${packageJson.version}`
    };
    if (process.env.ENVIRONMENT) sentryConfig.environment = process.env.ENVIRONMENT;
    Sentry.init(sentryConfig);
}

const PORT = Number(process.env.PORT) || 3000;

// Initialize the poll interaction handlers (holds a WebClient for the bot token)
const actions = new Actions(process.env.SLACK_ACCESS_TOKEN);

// Bolt receiver. Slash commands and interactivity both arrive on /slack/events
// (Bolt's single endpoint), verified via the signing secret. A /health route is
// added for container health checks.
const receiver = new HTTPReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    customRoutes: [
        {
            path: "/health",
            method: ["GET"],
            handler: (_req: IncomingMessage, res: ServerResponse): void => {
                res.writeHead(200);
                res.end("ok");
            },
        },
    ],
});

const app = new App({
    token: process.env.SLACK_ACCESS_TOKEN,
    receiver,
});

app.error(async (error): Promise<void> => {
    Sentry.captureException(error);
    console.error(error);
});

// Slash command
app.command("/inorout", (args) => actions.onSlashCommand(args));

// Interactivity — matched by action_id:
//   vote_<n>        poll vote buttons
//   poll_options    the poll's reset/lock/move/delete select
//   add_option      the modal "Add another option" button
//   modal_checkboxes the modal anon/multiple checkboxes (no-op ack)
app.action(/^vote_\d+$/, (args) => actions.onButtonAction(args));
app.action("poll_options", (args) => actions.onStaticSelectAction(args));
app.action("add_option", (args) => actions.onAddOption(args));
app.action("modal_checkboxes", (args) => actions.onModalCheckboxes(args));

// Modal submit / close
app.view("poll_modal", (args) => actions.onModalSubmit(args));
app.view({ callback_id: "poll_modal", type: "view_closed" }, (args) => actions.onModalClose(args));

(async (): Promise<void> => {
    await app.start(PORT);
    console.log(`In Or Out server running on ${PORT}`);
})();
