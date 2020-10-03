import { Poll } from "./Poll";
import { ChatPostMessageArguments, ChatUpdateArguments, WebAPICallResult, WebClient } from "@slack/web-api";
import { KnownBlock } from "@slack/types";
import { Request, Response } from "express";
import * as Sentry from "@sentry/node";

const errorMsg = "An error occurred; please contact the administrators for assistance.";

export class Actions {
    public static readonly BUTTON_ACTION = "button";
    public static readonly STATIC_SELECT_ACTION = "static_select";

    private wc: WebClient;

    public constructor(slackAccessToken: string) {
        this.wc = new WebClient(slackAccessToken);

        // These are called in server.ts without scoping
        this.onButtonAction = this.onButtonAction.bind(this);
        this.onStaticSelectAction = this.onStaticSelectAction.bind(this);
        this.createPollRoute = this.createPollRoute.bind(this);
    }

    public postMessage(channel: string, text: string, blocks: KnownBlock[]): Promise<WebAPICallResult> {
        const msg: ChatPostMessageArguments = { channel, text, blocks };
        return this.wc.chat.postMessage(msg);
    }

    public onButtonAction(payload: any, res: (message: any) => Promise<unknown>): { text: string } {
        try {
            const poll = new Poll(payload.message.blocks);
            payload.actions[0].text.text = payload.actions[0].text.text.replace("&lt;","<")
                .replace("&gt;",">").replace("&amp;","&");
            poll.vote(payload.actions[0].text.text, payload.user.id);
            payload.message.blocks = poll.getBlocks();
            payload.message.text = "Vote changed!";
            // We respond with the new payload
            res(payload.message);
            // In case it is being slow users will see this message
            return { text: "Vote processing!" };
        } catch(err) {
            return this.handleActionException(err);
        }
    }

    public onStaticSelectAction(payload: any, res: (message: any) => Promise<unknown>): { text: string } {
        try {
            const poll = new Poll(payload.message.blocks);
            switch (payload.actions[0].selected_option.value) {
                case "reset":
                    this.onResetSelected(payload, poll);
                    break;
                case "bottom":
                    this.onBottomSelected(payload, poll);
                    break;
                case "lock":
                    this.onLockSelected(payload, poll);
                    break;
                case "delete":
                    this.onDeleteSelected(payload, poll);
                    break;
            }
            res(payload.message);
            return { text: "Processing request!" };
        } catch (err) {
            return this.handleActionException(err);
        }
    }

    public async createPollRoute(req: Request, res: Response): Promise<void> {
        if (req.body.command !== "/inorout") {
            console.error(`Unregistered command ${req.body.command}`);
            res.send("Unhandled command");
            return;
        }

        // Create a new poll passing in the poll author and the other params
        const poll = Poll.slashCreate(`<@${req.body.user_id}>`, req.body.text.replace("@channel", "").replace("@everyone", "").replace("@here", "").split("\n"));
        try {
            await this.postMessage(req.body.channel_id, "A poll has been posted!", poll.getBlocks());
            res.send();
        } catch (err) {
            // Better handling of when the bot isn't invited to the channel
            if (err.data.error === "not_in_channel") {
                res.send("Bot must be invited to the channel before you can use it!");
            } else {
                res.send(this.handleActionException(err).text);
            }
        }
    }

    private onResetSelected(payload: any, poll: Poll): void {
        payload.message.text = "Vote reset!";
        if (poll.getLockedStatus()) {
            this.wc.chat.postEphemeral({
                channel: payload.channel.id,
                text: "You cannot reset your vote after the poll has been locked.", user: payload.user.id
            });
        } else {
            poll.resetVote(payload.user.id);
            payload.message.blocks = poll.getBlocks();
        }
    }

    private async onBottomSelected(payload: any, poll: Poll): Promise<void> {
        payload.message.text = "Poll moved!";
        payload.message.blocks = poll.getBlocks();
        if (Actions.isPollAuthor(payload, poll)) {
            await this.wc.chat.delete({ channel: payload.channel.id, ts: payload.message.ts })
                .catch((err: any) => console.error(err));
            // Must be artificially slowed down to prevent the poll from glitching out on Slack's end
            setTimeout(() => this.postMessage(payload.channel.id, "Poll Moved!", []).then((res: any) => {
                const msg: ChatUpdateArguments = {
                    channel: payload.channel.id, text: payload.message.text,
                    ts: res.ts, blocks: payload.message.blocks
                };
                this.wc.chat.update(msg);
            }), 300);
        } else {
            this.postEphemeralOnlyAuthor("move", "poll", payload.channel.id, payload.user.id);
        }
    }

    private onLockSelected(payload: any, poll: Poll): void {
        payload.message.text = "Poll locked!";
        if (Actions.isPollAuthor(payload, poll)) {
            poll.lockPoll();
            payload.message.blocks = poll.getBlocks();
        } else {
            this.postEphemeralOnlyAuthor("lock", "poll", payload.channel.id, payload.user.id);
        }
    }

    private onDeleteSelected(payload: any, poll: Poll): void {
        if (Actions.isPollAuthor(payload, poll)) {
            payload.message.text = "This poll has been deleted.";
            payload.message.blocks = undefined;
        } else {
            this.postEphemeralOnlyAuthor("delete", "poll", payload.channel.id, payload.user.id);
        }
    }

    private postEphemeralOnlyAuthor(verb: string, object: string, channel: string, user: string): Promise<WebAPICallResult> {
        return this.wc.chat.postEphemeral({ channel, text: `Only the poll author may ${verb} the ${object}.`, user });
    }

    private static isPollAuthor(payload: any, poll: Poll): boolean {
        return `<@${payload.user.id}>` === poll.getAuthor();
    }

    private handleActionException(err: any): { text: string } {
        Sentry.captureException(err);
        console.error(err);
        return { text: errorMsg };
    }
}
