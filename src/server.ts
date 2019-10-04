import express from "express";
import * as dotenv from "dotenv";
import { urlencoded } from "body-parser";
import { createMessageAdapter } from "@slack/interactive-messages";
import { WebClient } from "@slack/web-api";
import { Poll } from "./Poll";

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
app.use("/slack/actions", slackInteractions.expressMiddleware());

app.use(urlencoded({ extended: true }));

slackInteractions.action({ type: "button" }, (payload, res) => {
    const poll = new Poll(payload.message.blocks);
    poll.vote(payload.actions[0].text.text, payload.user.id);
    payload.message.blocks = poll.getBlocks();
    payload.message.text = "Vote changed!";
    // We respond with the new payload
    res(payload.message);
    // In case it is being slow users will see this message
    return ({ text: "Vote processing!" });
});

slackInteractions.action({ type: "static_select" }, async (payload, res) => {
    const selectOption = payload.actions[0].selected_option.value;
    const poll = new Poll(payload.message.blocks);
    switch (selectOption) {
        case "reset":
            payload.message.text = "Vote reset!";
            if (poll.getLockedStatus()) {
                await webclient.chat.postEphemeral({ channel: payload.channel.id, text: "You cannot reset your vote after the poll has been locked.", user: payload.user.id });
            } else {
                poll.resetVote(payload.user.id);
                payload.message.blocks = poll.getBlocks();
            }
            break;
        case "bottom":
            payload.message.text = "Poll moved!";
            payload.message.blocks = poll.getBlocks();
            if (`<@${payload.user.id}>` === poll.getAuthor()) {
                await webclient.chat.delete({ channel: payload.channel.id, ts: payload.message.ts }).catch((err: any) => console.error(err));
                // Must be artificially slowed down to prevent the poll from glitching out on Slack's end
                setTimeout(async () => {
                    await webclient.chat.postMessage({ channel: payload.channel.id, text: payload.message.text, as_user: false, blocks: payload.message.blocks });
                }, 300);
            } else {
                await webclient.chat.postEphemeral({ channel: payload.channel.id, text: "Only the poll author may move the poll.", user: payload.user.id });
            }
            break;
        case "lock":
            payload.message.text = "Poll locked!";
            if (`<@${payload.user.id}>` === poll.getAuthor()) {
                poll.lockPoll();
                payload.message.blocks = poll.getBlocks();
            } else {
                await webclient.chat.postEphemeral({ channel: payload.channel.id, text: "Only the poll author may lock the poll.", user: payload.user.id });
            }
            break;
        case "delete":
            if (`<@${payload.user.id}>` === poll.getAuthor()) {
                payload.message.text = "This poll has been deleted.";
                payload.message.blocks = undefined;
            } else {
                await webclient.chat.postEphemeral({ channel: payload.channel.id, text: "Only the poll author may delete the poll.", user: payload.user.id });
            }
            break;
        case "collect":
            payload.message.text = "Poll results collected!";
            if (`<@${payload.user.id}>` === poll.getAuthor()) {
                const dm: any = await webclient.conversations.open({ users: payload.user.id });
                await webclient.chat.postMessage({ channel: dm.channel.id, text: `${payload.message.blocks[0].text.text} *RESULTS (Confidential do not distribute)*`, blocks: poll.collectResults(), user: payload.user.id }).catch((err: any) => console.error(err));
            } else {
                await webclient.chat.postEphemeral({ channel: payload.channel.id, text: "Only the poll author may collect the results.", user: payload.user.id });
            }
            break;
    }
    res(payload.message);
    return ({ text: "Processing request!" });
});

app.post("/slack/commands", async (req, res) => {
    if (req.body.command === "/inorout") {
        // Create a new poll passing in the poll author and the other params
        const poll = Poll.slashCreate(`<@${req.body.user_id}>`, req.body.text.split("\n"));
        try {
            await webclient.chat.postMessage({ channel: req.body.channel_id, text: "A poll has been posted!", as_user: false, blocks: poll.getBlocks() });
            res.send();
        } catch (err) {
            console.error(err);
            res.send("Something went wrong");
        }
    } else {
        console.error(`Unregistered command ${req.body.command}`);
        res.send("Unhandled command");
    }
});

app.listen(PORT, () => {
    console.log(`In Or Out server running on ${PORT}`);
});

