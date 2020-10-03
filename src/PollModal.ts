import { KnownBlock, Block, PlainTextElement, InputBlock, View, Checkboxes } from "@slack/types";
import { text } from "body-parser";
import { PollHelpers } from "./PollHelpers";

export class PollModal {
  private num_options: number;
  private trigger_id: string;
  private title: PlainTextElement;
  private submit: PlainTextElement;
  private options: InputBlock[];
  private blocks: (KnownBlock | Block)[];

  // Every modal must have a trigger id according to slack
  constructor (trigger_id: string) {
    this.num_options = 2;
    this.trigger_id = trigger_id;
    this.options = [];
    this.blocks = [];

    this.title = PollHelpers.buildTextElem("Create a Poll");
    this.submit = PollHelpers.buildTextElem("Create Poll");
    for (let i = 0; i < this.num_options; i++) this.addOption();
  }

  // Creates an additional option block
  public addOption(): void {
    const optionString = `Option ${this.options.length + 1}`;
    const action_id = `option_${this.options.length}`;
    this.options.push(PollHelpers.buildInputElem(optionString, optionString, action_id));
  }

  private static constructModalCheckboxes(): Checkboxes {
    return {
      type: "checkboxes",
      options: [
        {
          text: PollHelpers.buildTextElem("Anonymous?"),
          description: PollHelpers.buildTextElem("Makes poll responses anonymous"),
          value: "anonymous",
        },
        {
          text: PollHelpers.buildTextElem("Multiple Responses?"),
          description: PollHelpers.buildTextElem("Allow users to select more than one option"),
          value: "multiple",
        }
      ]
    };
  }

  // Creates the initial modal view
  public constructModalView(): View {
    this.blocks.push(PollHelpers.buildInputElem("Poll Title", "Title", "title"));
    this.blocks = this.blocks.concat(this.options);
    this.blocks.push({
      type: "actions",
      elements: [
        PollHelpers.buildButton("Add another option", undefined, "add_option"),
        PollModal.constructModalCheckboxes(),
      ],
    });
    return {
      title: this.title,
      type: "modal",
      blocks: this.blocks,
      submit: this.submit,
    };
  }
}