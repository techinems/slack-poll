import { Button, ContextBlock, InputBlock, Option, PlainTextElement, SectionBlock } from "@slack/types";

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

    public static buildButton(buttonText: string, value?: string, actionId?: string): Button {
        return {
            type: "button",
            value: value,
            action_id: actionId,
            text: PollHelpers.buildTextElem(buttonText),
        };
    }

    public static buildInputElem(placeHolderText: string, labelText: string, actionId: string): InputBlock {
        return {
            type: "input",
            block_id: `bid_${actionId}`,
            element: {
                type: "plain_text_input",
                action_id: actionId,
                placeholder: PollHelpers.buildTextElem(placeHolderText),
            },
            label: PollHelpers.buildTextElem(labelText),
        };
    }
}
