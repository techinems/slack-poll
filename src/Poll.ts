import {
    KnownBlock, SectionBlock, ContextBlock, Button, ActionsBlock, StaticSelect, PlainTextElement, MrkdwnElement
} from "@slack/types";
import {Static} from "./Static";
import * as Sentry from "@sentry/node";

export class Poll {
    private getTitleFromMsg(): string {
        return ((this.message[0] as SectionBlock).text as MrkdwnElement).text;
    }
    private checkIfMsgContains(value: string): boolean {
        return this.getTitleFromMsg().includes(value);
    }
    static slashCreate(author: string, parameters: string[]): Poll {
        if (process.env.SENTRY_DSN) {
            Sentry.configureScope(scope => {
                scope.setUser({ username: author });
                scope.setExtra("parameters", parameters);
            });
        }

        let message: KnownBlock[] = [];
        const optionArray = parameters[0].split(" ");
        // Don't have to worry about the difference in comparisons if there is one or two options
        if (optionArray.length === 1) optionArray.push(" ");

        let mrkdwnValue = parameters[0];
        if (optionArray[0].toLowerCase() === "multiple" || optionArray[0].toLowerCase() === "anon") {
            // If options are provided then the first line becomes all the options and the second line is the title
            mrkdwnValue = parameters[1];
            mrkdwnValue += Static.appendIfMatching(optionArray, "multiple", " *(Multiple Answers)* ");
            mrkdwnValue += Static.appendIfMatching(optionArray, "anon", " *(Anonymous)* ");
        }

        const titleBlock = Static.buildSectionBlock(mrkdwnValue);
        message.push(titleBlock, Static.buildContextBlock(`Asked by: ${author}`));
        const start = titleBlock.text!.text === parameters[0] ? 1 : 2;
        const actionBlocks = Static.buildVoteOptions(parameters,start);
        // The various poll options
        const selection: StaticSelect = {
            type: "static_select",
            placeholder: Static.buildTextElem("Poll Options"),
            options: [
                Static.buildSelectOption("Reset your vote", "reset"),
                Static.buildSelectOption(":lock: Lock poll", "lock"),
                Static.buildSelectOption("Move to bottom", "bottom"),
                Static.buildSelectOption("Delete poll", "delete")
            ]
        };
        // If anonymous we want the author to be able to collect the poll results
        if (optionArray[0].toLowerCase() === "anon" || optionArray[1].toLowerCase() === "anon") {
            selection.options!.push(Static.buildSelectOption("Collect Results", "collect"));
        }
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
        //if the is a lock symbol right below the divider, the poll is locked
        this.isLocked = (this.message.length-1 === this.getDividerId())? false : ((this.message[this.getDividerId()+1] as SectionBlock).text as MrkdwnElement).text === ":lock:";
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

    private getVotesAndUserIndex(button: Button, userId: string): { votes: string[]; userIdIndex: number } {
        const votes = button.value!.split(",");
        return { votes, userIdIndex: votes.indexOf(userId) };
    }

    private getDynamicSelect(): ActionsBlock[] {
        const selection: StaticSelect = {
            type: "static_select",
            placeholder: Static.buildTextElem("Poll Options"),
            options: [
                Static.buildSelectOption("Reset your vote", "reset"),
                this.isLocked ? Static.buildSelectOption(":unlock: Unlock poll", "unlock") : Static.buildSelectOption(":lock: Lock poll", "lock"),
                Static.buildSelectOption("Move to bottom", "bottom"),
                Static.buildSelectOption("Delete poll", "delete")
            ]
        };
        if (this.anonymous) {
            selection.options!.push(Static.buildSelectOption("Collect Results", "collect"));
        }
        return [{ type: "actions", elements: [selection] }];
    }

    public resetVote(userId: string): void {
        this.processButtons(this.message.length, button => {
            const { votes, userIdIndex } = this.getVotesAndUserIndex(button, userId);
            if (userIdIndex === -1) return false;
            votes.splice(userIdIndex, 1);
            button.value = votes.join(",");
            // Optimization: why search the rest if we know they only have one vote?
            return !this.multiple;
        });
        this.generateVoteResults();
    }

    public vote(buttonText: string, userId: string): void {
        if (this.isLocked) return;
        this.processButtons(this.message.length, button => {
            const { votes, userIdIndex } = this.getVotesAndUserIndex(button, userId);
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
        this.isLocked = true;
        this.generateVoteResults();
        this.message = this.message.slice(0, this.getDividerId()-1).concat(this.getDynamicSelect()).concat(this.message.slice(this.getDividerId()));
        // ((this.message[2] as ActionsBlock).elements[0] as StaticSelect).options!.splice(0, 2);
    }

    public unlockpoll(): void {
        this.isLocked = false;
        this.message = this.message.slice(0,this.getDividerId()-1).concat(this.getDynamicSelect()).concat({ type: "divider" }).concat(this.message.slice(this.getDividerId()+2));
    }

    // Creates the message that will be sent to the poll author with the final results
    public collectResults(): KnownBlock[] {
        const results = this.generateResults(true);
        return [
            Static.buildSectionBlock(`${this.getTitleFromMsg()} *RESULTS (Confidential: do not distribute)*`)
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
                if (buttonCallback(button)) break;
            }
        }
    }

    private buildVoteTally(overrideAnon: boolean, votes: any, key: string): SectionBlock | null {
        const users: string[] = votes[key].split(",");
        users.splice(0, 1);
        // When anonymous we don"t display the user"s names
        const names = !this.anonymous || overrideAnon ? users.map((k: string) => `<@${k}>`).join(",") : "~HIDDEN~";
        return Static.buildSectionBlock(`*${users.length}* ${key} » ${names}`);
    }

    // Common code used between the public results generated and the empheral collected results
    private generateResults(overrideAnon: boolean): SectionBlock[] {
        const dividerId = this.getDividerId();
        const votes: any = {};
        this.processButtons(dividerId, currentButton => {
            votes[currentButton.text.text] = currentButton.value;
            return false;
        });
        const sections = Object.keys(votes).map(key => this.buildVoteTally(overrideAnon, votes, key) as SectionBlock);
        if (this.isLocked) sections.unshift(Static.buildSectionBlock(":lock:"));
        return sections;
    }

    private generateVoteResults(): void {
        // We throw out the old vote response and construct them again
        this.message = this.message.slice(0, this.getDividerId() + 1).concat(this.generateResults(false));
    }

    private getDividerId(): number {
        for (let i = this.message.length - 1; i >= 0; i--) {
            if (this.message[i].type === "divider") return i;
        }
        return -1;
    }
}