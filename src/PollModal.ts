import { KnownBlock, Block, PlainTextElement, InputBlock, View, Checkboxes } from "@slack/types";
import { PollHelpers } from "./PollHelpers";

// This will hold all currently opened modals in memory
// It maps view id to modal object
export const ModalMap: Map<string, PollModal> = new Map();

export class PollModal {
  private num_options: number;
  private title: PlainTextElement;
  private submit: PlainTextElement;
  private options: InputBlock[];
  private channel_id: string;
  private blocks: (KnownBlock | Block)[];

  // Modals have no sense of channel id so we must storei t
  constructor (channel_id: string) {
    this.channel_id = channel_id;
    this.num_options = 2;
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

  public getChannelId(): string { return this.channel_id; }

  private static constructModalCheckboxes(): Checkboxes {
    return {
      type: "checkboxes",
      action_id: "modal_checkboxes",
      options: [
        {
          text: PollHelpers.buildTextElem("Anonymous?"),
          description: PollHelpers.buildTextElem("Makes poll responses anonymous"),
          value: "anon",
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
    this.blocks = [];
    this.blocks.push(PollHelpers.buildInputElem("Poll Title", "Title", "title"));
    this.blocks = this.blocks.concat(this.options);
    this.blocks.push({
      type: "actions",
      block_id: "modal_actions",
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
      notify_on_close: true,
    };
  }

  // Takes the submission object from slack and returns poll parmaters 
  public static submissionToPollParams(submittedState: any): string[] {
    // This will hold the options for the poll
    const poll_options: string[] = [];
    let options_string = "";
    const checkboxes = submittedState.modal_actions.modal_checkboxes.selected_options;
    // Add the value of the checbkox to the poll options
    for (const check_option of checkboxes) {
        options_string += `${check_option.value} `;
    }
    options_string = options_string.trim();
    
    if (options_string.length > 0) poll_options.push(options_string);
    // We've taken care of the checkboxes so we now remove that key
    delete submittedState.modal_actions;

    poll_options.push(submittedState.bid_title.title.value);
    delete submittedState.bid_title;

    // The way slack structures data in blockkit we need a double for loop
    for (const section of submittedState.key().sort()) {
        for (const field in submittedState[section]) {
            poll_options.push(submittedState[section][field].value);
        }
    }

    return poll_options;
  }
}