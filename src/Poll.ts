import { KnownBlock, SectionBlock, ContextBlock, Button, ActionsBlock, StaticSelect, PlainTextElement, MrkdwnElement,
    Option } from "@slack/types";

export class Poll {
    private static appendIfMatching(optionArray: string[], keyword: string, appendText): string {
        return optionArray[0].toLowerCase() === keyword || optionArray[1].toLowerCase() === keyword ? appendText : "";
    }
    
    private getTitleFromMsg(): string {
        return ((this.message[0] as SectionBlock).text as MrkdwnElement).text;
    }
    
    private checkIfMsgContains(value: string): boolean {
        return this.getTitleFromMsg().includes(value);
    }
    
    private static buildSectionBlock(mrkdwnValue: string): SectionBlock {
        return { type: "section", text: { type: "mrkdwn", text: mrkdwnValue } };
    }
    
    private static buildSelectOption(text: string, value: string): Option {
        return { text: this.buildTextElem(text), value: value };
    }
    
    private static buildTextElem(text: string): PlainTextElement {
        return { type: "plain_text", text: text, emoji: true };
    }

    static slashCreate(author: string, parameters: string[]): Poll {
        let message: KnownBlock[] = [];
        const optionArray = parameters[0].split(" ");
        // That way I don"t have to worry about the difference in comparisons if there is one or two options
        if (optionArray.length === 1) optionArray.push(" ");

        let mrkdwnValue = parameters[0];
        if (optionArray[0].toLowerCase() === "multiple" || optionArray[0].toLowerCase() === "anon") {
            // If options are provided then the first line becomes all the options and the second line is the title
            mrkdwnValue = parameters[1];
            mrkdwnValue += this.appendIfMatching(optionArray, "multiple", " *(Multiple Answers)* ");
            mrkdwnValue += this.appendIfMatching(optionArray, "anon", " *(Anonymous)* ");
        }

        const titleBlock = Poll.buildSectionBlock(mrkdwnValue);
        const authorBlock: ContextBlock = {
            type: "context",
            elements: [
                { type: "mrkdwn", text: `Asked by: ${author}` }
            ]
        };
        message.push(titleBlock);
        message.push(authorBlock);
        const actionBlocks: ActionsBlock[] = [{ type: "actions", elements: [] }];
        let actionBlockCount = 0;
        // Construct all the buttons
        const start = titleBlock.text!.text === parameters[0] ? 1 : 2;
        for (let i = start; i < parameters.length; i++) {
            if (i % 5 === 0) {
                const newActionBlock: ActionsBlock = { type: "actions", elements: [] };
                actionBlocks.push(newActionBlock);
                actionBlockCount++;
            }
            // Remove special characters, should be able to remove this once slack figures itself out
            parameters[i] = parameters[i].replace("&amp;", "+").replace("&lt;", "greater than ")
                                         .replace("&gt;", "less than ");
            // We set value to empty string so that it is always defined
            const button: Button = { type: "button", value: " ", text: this.buildTextElem(parameters[i]) };
            actionBlocks[actionBlockCount].elements.push(button);
        }
        // The various poll options
        const selection: StaticSelect = {
            type: "static_select",
            placeholder: this.buildTextElem("Poll Options"),
            options: [
                this.buildSelectOption("Reset your vote", "reset"),
                this.buildSelectOption(":lock: Lock poll", "lock"),
                this.buildSelectOption("Move to bottom", "bottom"),
                this.buildSelectOption("Delete poll", "delete")
            ]
        };
        // If anonymous we want the author to be able to collect the poll results
        if (optionArray[0].toLowerCase() === "anon" || optionArray[1].toLowerCase() === "anon") {
            selection.options!.push(this.buildSelectOption("Collect Results", "collect"));
        }
        actionBlockCount++;
        actionBlocks.push({ type: "actions", elements: [selection] });
        message = message.concat(actionBlocks);
        // Add a divider in between so later we can put the messages
        message.push({ type: "divider" });
        // Create the poll based on the intial message
        return new Poll(message);
    }

    private message: KnownBlock[] = [];
    private multiple = false;
    private anonymous = false;
    private isLocked = false;
    constructor(message: KnownBlock[]) {
        this.message = message;
        // Since its databaseless the way we know if it is anonymous or multiple is by parsing the title
        this.multiple = this.checkIfMsgContains("(Multiple Answers)");
        this.anonymous = this.checkIfMsgContains("(Anonymous)");
        // If there's no buttons then the poll is locked
        this.isLocked = this.message[3].type === "divider";
    }

    public getBlocks(): KnownBlock[] {
        return this.message;
    }

    public getAuthor(): string {
        return ((this.message[1] as ContextBlock).elements[0] as PlainTextElement).text.replace("Asked by: ", "");
    }

    public getLockedStatus(): boolean {
        return this.isLocked;
    }
    
    private getVotesAndUserIndex(button: Button, userId: string): {votes: string[]; userIdIndex: number} {
        const votes = button.value!.split(",");
        return {votes, userIdIndex: votes.indexOf(userId)};
    }

    public resetVote(userId: string): void {
        this.processButtons(this.message.length, button => {
            const {votes, userIdIndex} = this.getVotesAndUserIndex(button, userId);
            if (userIdIndex > -1) {
                votes.splice(userIdIndex, 1);
                button.value = votes.join(",");
                // Optimization why search the rest if we know they only have one vote
                if (!this.multiple) return true;
            }
            return false;
        });
        this.generateVoteResults();
    }

    public vote(buttonText: string, userId: string): void {
        this.processButtons(this.message.length, button => {
            const {votes, userIdIndex} = this.getVotesAndUserIndex(button, userId);
            if (!this.multiple && userIdIndex > -1 && button.text.text !== buttonText) {
                votes.splice(userIdIndex, 1);
            } else if (button.text.text === buttonText && userIdIndex === -1) {
                votes.push(userId);
            }
            button.value = votes.join(",");
            return false;
        });
        this.generateVoteResults();
    }

    public lockPoll(): void {
        this.message = this.message.slice(0, 2).concat(this.message.slice(this.getDividerId() - 1));
        // ((this.message[2] as ActionsBlock).elements[0] as StaticSelect).options!.splice(0, 2);
    }

    // Creates the message that will be sent to the poll author with the final results
    public collectResults(): KnownBlock[] {
        const results = this.resultGeneratorHelper(true);
        return [
            Poll.buildSectionBlock(`${this.getTitleFromMsg()} *RESULTS (Confidential do not distribute)*`)
        ].concat(results);
    }
    
    private processButtons(loopEnd: number, buttonCallback: (b: Button) => boolean): void {
        for (let i = 2; i < loopEnd; i++) {
            if (this.message[i].type !== "actions") continue;
            // Since we know it's an action block as we just checked its type we can do this casting
            const currentBlock = this.message[i] as ActionsBlock;
            for (let j = 0; j < currentBlock.elements.length; j++) {
                if (currentBlock.elements[j].type !== "button") continue;
                const button = currentBlock.elements[j] as Button;
                if(buttonCallback(button)) break;
            }
        }
    }

    // Common code used between the public results generated and the empheral collected results
    private resultGeneratorHelper(overrideAnon: boolean): SectionBlock[] {
        const dividerId = this.getDividerId();
        const votes: any = {};
        this.processButtons(dividerId, currentButton => {
            votes[currentButton.text.text] = currentButton.value;
            return false;
        });
        const responseSections: SectionBlock[] = [];
        for (const key in votes) {
            const users: string[] = votes[key].split(",");
            users.splice(0, 1);
            // Don"t bother with empty votes
            if (users.length === 0) continue;
            // When anonymous we don"t display the user"s names
            const names = !this.anonymous || overrideAnon ? users.map((k: string) => `<@${k}>`).join(",") : "~HIDDEN~";
            responseSections.push(Poll.buildSectionBlock(`*${users.length}* ${key} » ${names}`));
        }
        return responseSections;
    }
    private generateVoteResults(): void {
        // We throw out the old vote response and construct them again 
        this.message = this.message.slice(0, this.getDividerId() + 1).concat(this.resultGeneratorHelper(false));
    }

    private getDividerId(): number {
        for (let i = this.message.length - 1; i >= 0; i--) {
            if (this.message[i].type === "divider") return i;
        }
        return -1;
    }
}