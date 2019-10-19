import {
    SectionBlock, ContextBlock, PlainTextElement, Option
} from "@slack/types";

export class PollHelpers {
    public static appendIfMatching(optionArray: string[], keyword: string, appendText: string): string {
        return optionArray[0].toLowerCase() === keyword || optionArray[1].toLowerCase() === keyword ? appendText : "";
    }

    public static buildSectionBlock(mrkdwnValue: string): SectionBlock {
        return { type: "section", text: { type: "mrkdwn", text: mrkdwnValue } };
    }

    public static buildContextBlock(mrkdwnValue: string): ContextBlock {
        return { type: "context", elements: [ { type: "mrkdwn", text: mrkdwnValue } ] };
    }

    public static buildSelectOption(text: string, value: string): Option {
        return { text: this.buildTextElem(text), value: value };
    }

    public static buildTextElem(text: string): PlainTextElement {
        return { type: "plain_text", text, emoji: true };
    }
}