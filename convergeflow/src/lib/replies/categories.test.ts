import { describe, it, expect } from "vitest";
import { classifyByKeywords, CATEGORY_KEYWORDS } from "./categories";
import type { ReplyCategory } from "./categories";

describe("classifyByKeywords", () => {
  it("classifies an interested reply", () => {
    const body = "Hi, this sounds interesting! Could you tell me more about your solution?";
    expect(classifyByKeywords(body)).toBe("interested");
  });

  it("classifies a not_interested reply", () => {
    const body =
      "Thanks but we're not interested at this time. Not the right fit for us. Not looking right now.";
    expect(classifyByKeywords(body)).toBe("not_interested");
  });

  it("classifies a do_not_contact reply", () => {
    const body = "Please stop emailing me and remove me from your list. Do not contact me again.";
    expect(classifyByKeywords(body)).toBe("do_not_contact");
  });

  it("classifies an auto_reply", () => {
    const body = "This is an automated message. Do not reply to this email. Auto-reply configured.";
    expect(classifyByKeywords(body)).toBe("auto_reply");
  });

  it("classifies an out_of_office reply", () => {
    const body = "I'm out of office and will return on Monday. Limited access to email until then.";
    expect(classifyByKeywords(body)).toBe("out_of_office");
  });

  it("classifies a referral reply", () => {
    const body =
      "You should talk to our head of marketing. I can put you in touch with the right person.";
    expect(classifyByKeywords(body)).toBe("referral");
  });

  it("classifies a question reply", () => {
    const body = "Interesting. Question: how much does it cost? What does pricing look like?";
    expect(classifyByKeywords(body)).toBe("question");
  });

  it("classifies a booked reply", () => {
    const body =
      "Meeting confirmed! Looking forward to our call. See you on Thursday - I sent a calendar invite.";
    expect(classifyByKeywords(body)).toBe("booked");
  });

  it("defaults to interested when no keywords match", () => {
    const body = "Hey.";
    expect(classifyByKeywords(body)).toBe("interested");
  });

  it("is case-insensitive", () => {
    const body = "OUT OF OFFICE - AWAY UNTIL NEXT WEEK";
    expect(classifyByKeywords(body)).toBe("out_of_office");
  });

  it("handles empty body", () => {
    expect(classifyByKeywords("")).toBe("interested");
  });

  it("all categories have keyword lists defined", () => {
    const categories: ReplyCategory[] = [
      "interested",
      "not_interested",
      "do_not_contact",
      "auto_reply",
      "out_of_office",
      "referral",
      "question",
      "booked",
    ];
    for (const cat of categories) {
      expect(CATEGORY_KEYWORDS[cat].length).toBeGreaterThan(0);
    }
  });
});
