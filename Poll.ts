import { KnownBlock, SectionBlock, ContextBlock, KnownAction, Button, ActionsBlock, StaticSelect } from "@slack/types";

export class Poll {

    private message: KnownBlock[] = [];
    constructor(author: string, parameters: string[]) {
        const titleBlock: SectionBlock = {
            type: 'section',
            text: { type: 'mrkdwn', text: parameters[0] }
        };
        const authorBlock: ContextBlock = {
            type: 'context',
            elements: [
                { type: 'mrkdwn', text: `Asked by: ${author}` }
            ]
        }
        this.message.push(titleBlock);
        this.message.push(authorBlock);
        const actionBlocks: ActionsBlock[] = [{ type: 'actions', elements: [] }];
        let actionBlockCount: number = 0;
        // Construct all the buttons
        for (let i = 1; i < parameters.length; i++) {
            if (i % 5 === 0) {
                const newActionBlock: ActionsBlock = { type: 'actions', elements: [] };
                actionBlocks.push(newActionBlock);
                actionBlockCount++;
            }
            const button: Button = { type: 'button', text: { type: 'plain_text', text: parameters[i], emoji: true } };
            actionBlocks[actionBlockCount].elements.push(button);
        }
        // The various poll options
        const selection: StaticSelect = {
            type: 'static_select',
            placeholder: {
                type: 'plain_text',
                text: 'Poll Options',
                emoji: true
            },
            options: [
                {
                    text: {
                        type: 'plain_text',
                        text: 'Reset your vote',
                        emoji: true
                    },
                    value: 'reset'
                },
                {
                    text: {
                        type: 'plain_text',
                        text: 'Move to bottom',
                        emoji: true
                    },
                    value: 'bottom'
                },
                {
                    text: {
                        type: 'plain_text',
                        text: 'Delete poll',
                        emoji: true
                    },
                    value: 'delete'
                }
            ]
        };
        actionBlockCount++;
        actionBlocks.push({ type: 'actions', elements: [selection] });
        this.message = this.message.concat(actionBlocks);
        // Add a divider in between so later we can put the messages
        this.message.push({ type: 'divider' });
    }

    public getBlocks() {
        return this.message;
    }
}