import { Poll } from "./Poll";
import { ChatPostMessageArguments, ChatUpdateArguments, WebAPICallResult, WebClient } from "@slack/web-api";
import { KnownBlock } from "@slack/types";
import * as Sentry from "@sentry/node";
import { PollModal, ModalMap } from "./PollModal";

const errorMsg = "An error occurred; please contact the administrators for assistance.";

// This class holds all of the poll interaction logic. It was previously wired to
// Slack's deprecated @slack/interactive-messages adapter; it is now driven by
// Bolt listeners (see server.ts). Web API calls still go through a WebClient
// constructed from the bot token, and all message updates go back to Slack via
// Bolt's `respond` (response_url) — matching the original replace-the-message
// behavior.
export class Actions {
    private wc: WebClient;

    public constructor(slackAccessToken: string) {
        this.wc = new WebClient(slackAccessToken);
    }

    public postMessage(channel: string, text: string, blocks: KnownBlock[]): Promise<WebAPICallResult> {
        const msg: ChatPostMessageArguments = { channel, text, blocks };
        return this.wc.chat.postMessage(msg);
    }

    public async displayModal(channelId: string, triggerId: string): Promise<void> {
        const modal = new PollModal(channelId);
        const response = await this.wc.views.open({
            trigger_id: triggerId,
            view: modal.constructModalView(),
        });
        ModalMap.set((response as any).view.id, modal);
    }

    // Slash command: /inorout
    public async onSlashCommand({ command, ack, respond }: any): Promise<void> {
        await ack();

        // If the user just did /inorout (no args) we enter modal mode
        const initiateModal = command.text.trim().length == 0;

        try {
            if (!initiateModal) {
                // Create a new poll passing in the poll author and the other params
                const poll = Poll.slashCreate(
                    `<@${command.user_id}>`,
                    command.text.replace("@channel", "").replace("@everyone", "").replace("@here", "").split("\n")
                );
                await this.postMessage(command.channel_id, "A poll has been posted!", poll.getBlocks());
            } else {
                await this.displayModal(command.channel_id, command.trigger_id);
            }
        } catch (err: any) {
            // Better handling of when the bot isn't invited to the channel
            if (err && err.data && err.data.error === "not_in_channel") {
                await respond("Bot not in channel please use /invite @inorout or ask a dev team member for help.");
            } else {
                Sentry.captureException(err);
                console.error(err);
                await respond(errorMsg);
            }
        }
    }

    // A poll vote button (action_id "vote_<n>") on a poll message.
    public async onButtonAction({ ack, body, action, respond }: any): Promise<void> {
        await ack();
        try {
            const poll = new Poll(body.message.blocks);
            action.text.text = action.text.text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&");
            poll.vote(action.text.text, body.user.id);
            await respond({ replace_original: true, text: "Vote changed!", blocks: poll.getBlocks() });
        } catch (err) {
            await this.respondException(respond, err);
        }
    }

    // The modal "Add another option" button (action_id "add_option").
    public async onAddOption({ ack, body }: any): Promise<void> {
        await ack();
        const currentModal = ModalMap.get(body.view.id);
        // We don't do anything if viewID is invalid
        if (!currentModal) return;
        currentModal.addOption();
        await this.wc.views.update({
            view_id: body.view.id,
            view: currentModal.constructModalView(),
        });
    }

    // The modal "Anonymous / Multiple" checkboxes — nothing to do server-side,
    // just acknowledge (the original handler was a no-op for this action too).
    public async onModalCheckboxes({ ack }: any): Promise<void> {
        await ack();
    }

    // The poll's "Poll Options" static select (reset / lock / move / delete).
    public async onStaticSelectAction({ ack, body, action, respond }: any): Promise<void> {
        await ack();
        try {
            const poll = new Poll(body.message.blocks);
            switch (action.selected_option.value) {
                case "reset":
                    await this.onResetSelected(body, poll, respond);
                    break;
                case "bottom":
                    await this.onBottomSelected(body, poll, respond);
                    break;
                case "lock":
                    await this.onLockSelected(body, poll, respond);
                    break;
                case "delete":
                    await this.onDeleteSelected(body, poll, respond);
                    break;
            }
        } catch (err) {
            await this.respondException(respond, err);
        }
    }

    // Modal submitted — build and post the poll, then forget the modal.
    public async onModalSubmit({ ack, body }: any): Promise<void> {
        const modal = ModalMap.get(body.view.id);
        // Closing/clearing the modal view is the acknowledgement
        await ack({ response_action: "clear" });
        if (!modal) return;

        const form_values = body.view.state.values;
        const poll_author = `<@${body.user.id}>`;
        const poll_options = PollModal.submissionToPollParams(form_values);
        const poll = Poll.slashCreate(poll_author, poll_options);
        try {
            await this.postMessage(modal.getChannelId(), "A poll has been posted!", poll.getBlocks());
        } catch (err) {
            console.error(err);
        } finally {
            ModalMap.delete(body.view.id);
        }
    }

    // Modal dismissed without submitting.
    public async onModalClose({ ack, body }: any): Promise<void> {
        await ack();
        ModalMap.delete(body.view.id);
    }

    private async onResetSelected(body: any, poll: Poll, respond: any): Promise<void> {
        if (poll.getLockedStatus()) {
            await this.wc.chat.postEphemeral({
                channel: body.channel.id,
                text: "You cannot reset your vote after the poll has been locked.",
                user: body.user.id,
            });
            await respond({ replace_original: true, text: "Vote reset!", blocks: body.message.blocks });
        } else {
            poll.resetVote(body.user.id);
            await respond({ replace_original: true, text: "Vote reset!", blocks: poll.getBlocks() });
        }
    }

    private async onBottomSelected(body: any, poll: Poll, respond: any): Promise<void> {
        const blocks = poll.getBlocks();
        if (Actions.isPollAuthor(body, poll)) {
            await this.wc.chat.delete({ channel: body.channel.id, ts: body.message.ts }).catch((err: any) => console.error(err));
            // Must be artificially slowed down to prevent the poll from glitching out on Slack's end
            setTimeout(() => this.postMessage(body.channel.id, "Poll Moved!", []).then((res: any) => {
                const msg: ChatUpdateArguments = {
                    channel: body.channel.id, text: "Poll moved!",
                    ts: res.ts, blocks,
                };
                this.wc.chat.update(msg);
            }).catch((err: any) => console.error(err)), 300);
        } else {
            await this.postEphemeralOnlyAuthor("move", "poll", body.channel.id, body.user.id);
            await respond({ replace_original: true, text: "Poll moved!", blocks });
        }
    }

    private async onLockSelected(body: any, poll: Poll, respond: any): Promise<void> {
        if (Actions.isPollAuthor(body, poll)) {
            poll.lockPoll();
            await respond({ replace_original: true, text: "Poll locked!", blocks: poll.getBlocks() });
        } else {
            await this.postEphemeralOnlyAuthor("lock", "poll", body.channel.id, body.user.id);
            await respond({ replace_original: true, text: "Poll locked!", blocks: body.message.blocks });
        }
    }

    private async onDeleteSelected(body: any, poll: Poll, respond: any): Promise<void> {
        if (Actions.isPollAuthor(body, poll)) {
            await respond({ replace_original: true, text: "This poll has been deleted.", blocks: [] });
        } else {
            await this.postEphemeralOnlyAuthor("delete", "poll", body.channel.id, body.user.id);
        }
    }

    private postEphemeralOnlyAuthor(verb: string, object: string, channel: string, user: string): Promise<WebAPICallResult> {
        return this.wc.chat.postEphemeral({ channel, text: `Only the poll author may ${verb} the ${object}.`, user });
    }

    private static isPollAuthor(body: any, poll: Poll): boolean {
        return `<@${body.user.id}>` === poll.getAuthor();
    }

    private async respondException(respond: any, err: any): Promise<void> {
        Sentry.captureException(err);
        console.error(err);
        // Ephemeral so a processing error doesn't wipe out the poll message.
        await respond({ replace_original: false, response_type: "ephemeral", text: errorMsg });
    }
}
