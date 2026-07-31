import { Poll } from "../src/Poll";
import { PollHelpers } from "../src/PollHelpers";

// Helper: does the rendered poll contain a section with this exact text?
function hasSectionText(poll: Poll, text: string): boolean {
    return JSON.stringify(poll.getBlocks()).includes(text);
}

describe("Poll voting", () => {
    test("a vote is tallied and shows the voter's mention", () => {
        const poll = Poll.slashCreate("<@U1>", ["Question?", "Yes", "No"]);
        poll.vote("Yes", "U2");
        expect(hasSectionText(poll, "*1* Yes » <@U2>")).toBe(true);
    });

    test("resetVote removes the user's vote", () => {
        const poll = Poll.slashCreate("<@U1>", ["Question?", "Yes", "No"]);
        poll.vote("Yes", "U2");
        expect(hasSectionText(poll, "<@U2>")).toBe(true);
        poll.resetVote("U2");
        expect(hasSectionText(poll, "<@U2>")).toBe(false);
    });

    test("single-answer poll moves a vote when the user picks a different option", () => {
        const poll = Poll.slashCreate("<@U1>", ["Question?", "Yes", "No"]);
        poll.vote("Yes", "U2");
        poll.vote("No", "U2");
        expect(hasSectionText(poll, "*1* No » <@U2>")).toBe(true);
        expect(hasSectionText(poll, "*1* Yes")).toBe(false);
    });

    test("anonymous poll hides voter names", () => {
        const poll = Poll.slashCreate("<@U1>", ["anon", "Question?", "Yes", "No"]);
        poll.vote("Yes", "U2");
        expect(hasSectionText(poll, "~HIDDEN~")).toBe(true);
        expect(hasSectionText(poll, "<@U2>")).toBe(false);
    });

    test("author is parsed back out of the poll blocks", () => {
        const poll = Poll.slashCreate("<@U1>", ["Question?", "Yes", "No"]);
        expect(poll.getAuthor()).toBe("<@U1>");
    });

    test("multiple-answer poll keeps votes on more than one option", () => {
        const poll = Poll.slashCreate("<@U1>", ["multiple", "Question?", "Yes", "No"]);
        poll.vote("Yes", "U2");
        poll.vote("No", "U2");
        expect(hasSectionText(poll, "*1* Yes » <@U2>")).toBe(true);
        expect(hasSectionText(poll, "*1* No » <@U2>")).toBe(true);
    });
});

describe("PollHelpers.appendIfMatching", () => {
    test("returns the append text when a keyword matches", () => {
        expect(PollHelpers.appendIfMatching(["multiple", " "], "multiple", " *(M)* ")).toBe(" *(M)* ");
    });
    test("returns empty string when no keyword matches", () => {
        expect(PollHelpers.appendIfMatching(["foo", "bar"], "multiple", " *(M)* ")).toBe("");
    });
});
