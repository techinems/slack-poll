import { KnownBlock, SectionBlock, ContextBlock, Button, ActionsBlock, StaticSelect, PlainTextElement, MrkdwnElement } from "@slack/types";

export class Poll {

    static slashCreate(author: string, parameters: string[]) {
        let message: KnownBlock[] = [];
        const optionArray = parameters[0].split(' ');
        // That way I don't have to worry about the difference in comparisons if there is one or two options
        if (optionArray.length === 1) optionArray.push(' ');
        let titleBlock: SectionBlock;
        if (optionArray[0].toLowerCase() === "multiple" || optionArray[0].toLowerCase() === "anon") {
            // If options are provided then the first line becomes all the options and the second line is the title
            let title = parameters[1];
            title += optionArray[0].toLowerCase() === "multiple" || optionArray[1].toLowerCase() === "multiple" ? " *(Multiple Answers)* " : "";
            title += optionArray[0].toLowerCase() === "anon" || optionArray[1].toLowerCase() === "anon" ? " *(Anonymous)* " : "";
            titleBlock = {
                type: 'section',
                text: { type: 'mrkdwn', text: title }
            };
        } else {
            titleBlock = {
                type: 'section',
                text: { type: 'mrkdwn', text: parameters[0] }
            };
        }

        const authorBlock: ContextBlock = {
            type: 'context',
            elements: [
                { type: 'mrkdwn', text: `Asked by: ${author}` }
            ]
        }
        message.push(titleBlock);
        message.push(authorBlock);
        const actionBlocks: ActionsBlock[] = [{ type: 'actions', elements: [] }];
        let actionBlockCount: number = 0;
        // Construct all the buttons
        const start = titleBlock.text!.text === parameters[0] ? 1 : 2;
        for (let i = start; i < parameters.length; i++) {
            if (i % 5 === 0) {
                const newActionBlock: ActionsBlock = { type: 'actions', elements: [] };
                actionBlocks.push(newActionBlock);
                actionBlockCount++;
            }
            // Remove special characters, should be able to remove this once slack figures itself out
            parameters[i] = parameters[i].replace('&amp;', '+');
            parameters[i] = parameters[i].replace('&lt;', 'greater than ');
            parameters[i] = parameters[i].replace('&gt;', 'less than ');
            // We set value to empty string so that it is always defined
            const button: Button = { type: 'button', value: " ", text: { type: 'plain_text', text: parameters[i], emoji: true } };
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
                        text: ':lock: Lock poll',
                        emoji: true
                    },
                    value: 'lock'
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
        // If anonymous we want the author to be able to collect the poll results
        if (optionArray[0].toLowerCase() === "anon" || optionArray[1].toLowerCase() === "anon") {
            selection.options!.push(
                {
                    text: {
                        type: 'plain_text',
                        text: 'Collect Results',
                        emoji: true
                    },
                    value: 'collect'
                }
            );
        }
        actionBlockCount++;
        actionBlocks.push({ type: 'actions', elements: [selection] });
        message = message.concat(actionBlocks);
        // Add a divider in between so later we can put the messages
        message.push({ type: 'divider' });
        // Create the poll based on the intial message
        return new Poll(message);
    }

    private message: KnownBlock[] = [];
    private multiple: boolean = false;
    private anonymous: boolean = false;
    constructor(message: KnownBlock[]) {
        this.message = message;
        // Since its databaseless the way we know if it is anonymous or multiple is by parsing the title
        this.multiple = ((this.message[0] as SectionBlock).text as MrkdwnElement).text.includes('(Multiple Answers)');
        this.anonymous = ((this.message[0] as SectionBlock).text as MrkdwnElement).text.includes('(Anonymous)');
    }

    public getBlocks() {
        return this.message;
    }

    public getAuthor() {
        return ((this.message[1] as ContextBlock).elements[0] as PlainTextElement).text.replace("Asked by: ", "");
    }

    public resetVote(userId: string) {
        for (let i = 2; i < this.message.length; i++) {
            if (this.message[i].type === "actions") {
                // Since we know it's an action block as we just checked its type we can do this casting
                const currentBlock = this.message[i] as ActionsBlock;
                for (let j = 0; j < currentBlock.elements.length; j++) {
                    if (currentBlock.elements[j].type === "button") {
                        const button = currentBlock.elements[j] as Button;
                        const votes = button.value!.split(',');
                        const userIdIndex = votes.indexOf(userId);
                        if (userIdIndex > -1) {
                            votes.splice(userIdIndex, 1);
                            // Optimization why search the rest if we know they only have one vote
                            if (!this.multiple) break;
                        }
                        (currentBlock.elements[j] as Button).value = votes.join(',');
                    }
                }
            }
        }
        this.generateVoteResults();
    }

    public vote(buttonText: string, userId: string) {
        for (let i = 2; i < this.message.length; i++) {
            if (this.message[i].type === "actions") {
                // Since we know it's an action block as we just checked its type we can do this casting
                const currentBlock = this.message[i] as ActionsBlock;
                for (let j = 0; j < currentBlock.elements.length; j++) {
                    if (currentBlock.elements[j].type === "button") {
                        const button = currentBlock.elements[j] as Button;
                        const votes = button.value!.split(',');
                        const userIdIndex = votes.indexOf(userId);
                        if (!this.multiple && userIdIndex > -1 && button.text.text !== buttonText) {
                            votes.splice(userIdIndex, 1);
                        } else if (button.text.text === buttonText && userIdIndex === -1) {
                            votes.push(userId);
                        }
                        (currentBlock.elements[j] as Button).value = votes.join(',');
                    }
                }
            }
        }
        this.generateVoteResults();
    }

    public lockPoll() {
        this.message = this.message.slice(0, 2).concat(this.message.slice(this.getDividerId() - 1));
        ((this.message[2] as ActionsBlock).elements[0] as StaticSelect).options!.splice(0, 2);
    }

    // Creates the message that will be sent to the poll author with the final results
    public collectResults() {
        const results = this.resultGeneratorHelper(true);
        const title = ((this.message[0] as SectionBlock).text as MrkdwnElement).text;
        const titleBlock: SectionBlock = {
            type: 'section',
            text: { type: 'mrkdwn', text: `${title} *RESULTS (Confidential do not distribute)*` }
        };
        return [titleBlock].concat(results);
    }

    // Common code used between the public results generated and the empheral collected results
    private resultGeneratorHelper(overrideAnon: boolean) {
        const dividerId = this.getDividerId();
        const votes: any = {};
        for (let i = 2; i < dividerId; i++) {
            if (this.message[i].type === "actions") {
                const currentBlock = this.message[i] as ActionsBlock;
                for (let j = 0; j < currentBlock.elements.length; j++) {
                    if (currentBlock.elements[j].type === "button") {
                        const currentButton = currentBlock.elements[j] as Button;
                        votes[currentButton.text.text] = currentButton.value;
                    }
                }
            }
        }
        const responseSections: SectionBlock[] = [];
        for (const key in votes) {
            let users: string[] = votes[key].split(',');
            users.splice(0, 1);
            // Don't bother with empty votes
            if (users.length === 0) continue;
            let sectionText = "";
            // When anonymous we don't display the user's names
            if (this.anonymous && !overrideAnon) {
                sectionText = `*${users.length}* ${key} » ~HIDDEN~`;
            } else {
                users = users.map((k: string) => `<@${k}>`);
                sectionText = `*${users.length}* ${key} » ` + users.join(',');
            }
            const sectionBlock: SectionBlock = { type: "section", text: { type: "mrkdwn", text: sectionText } }
            responseSections.push(sectionBlock);
        }
        return responseSections;
    }
    private generateVoteResults() {
        const dividerId = this.getDividerId();
        // We throw out the old vote response and construct them again 
        this.message = this.message.slice(0, dividerId + 1);
        this.message = this.message.concat(this.resultGeneratorHelper(false));
    }

    private getDividerId(): number {
        for (let i = this.message.length - 1; i >= 0; i--) {
            if (this.message[i].type === "divider") {
                return i;
            }
        }
        return -1;
    }
}