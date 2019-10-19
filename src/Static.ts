import {
    SectionBlock, ContextBlock, PlainTextElement, Option, ActionsBlock, Button
} from "@slack/types";

export class Static {
    public static appendIfMatching(optionArray: string[], keyword: string, appendText: string): string {
        return optionArray[0].toLowerCase() === keyword || optionArray[1].toLowerCase() === keyword ? appendText : "";
    }

    public static buildSectionBlock(mrkdwnValue: string): SectionBlock {
        return {type: "section", text: {type: "mrkdwn", text: mrkdwnValue}};
    }

    public static buildContextBlock(mrkdwnValue: string): ContextBlock {
        return {type: "context", elements: [{type: "mrkdwn", text: mrkdwnValue}]};
    }

    public static buildSelectOption(text: string, value: string): Option {
        return {text: this.buildTextElem(text), value: value};
    }

    public static buildTextElem(text: string): PlainTextElement {
        return {type: "plain_text", text, emoji: true};
    }
    public static buildVoteOptions(parameters: string [], start: number ): ActionsBlock[] {
        const actionBlocks: ActionsBlock[] = [{ type: "actions", elements: [] }];
        let actionBlockCount = 0;
        // Construct all the buttons
        for (let i = start; i < parameters.length; i++) {
            if (i % 5 === 0 && i != 0) {
                const newActionBlock: ActionsBlock = { type: "actions", elements: [] };
                actionBlocks.push(newActionBlock);
                actionBlockCount++;
            }
            // Remove special characters, should be able to remove this once slack figures itself out
            parameters[i] = parameters[i].replace("&amp;", "+").replace("&lt;", "greater than ")
                .replace("&gt;", "less than ");
            // We set value to empty string so that it is always defined
            const button: Button = { type: "button", value: " ", text: Static.buildTextElem(parameters[i]) };
            actionBlocks[actionBlockCount].elements.push(button);
        }
        return actionBlocks;
    }
}