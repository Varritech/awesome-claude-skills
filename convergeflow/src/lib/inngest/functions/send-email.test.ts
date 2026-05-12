import { describe, it, expect } from "vitest";
import { personalize, bodyToHtml } from "./send-email";

type Lead = Parameters<typeof personalize>[1];

describe("personalize", () => {
  const lead: Lead = {
    id: "ld_1",
    firstName: "Alice",
    lastName: "Smith",
    company: "Acme Corp",
    title: "CEO",
    industry: "SaaS",
    location: "New York",
  };

  it("replaces {{firstName}}", () => {
    expect(personalize("Hi {{firstName}}", lead)).toBe("Hi Alice");
  });

  it("replaces {{lastName}}", () => {
    expect(personalize("Hello {{lastName}}", lead)).toBe("Hello Smith");
  });

  it("replaces {{fullName}}", () => {
    expect(personalize("Dear {{fullName}}", lead)).toBe("Dear Alice Smith");
  });

  it("replaces {{company}}", () => {
    expect(personalize("from {{company}}", lead)).toBe("from Acme Corp");
  });

  it("replaces {{title}}", () => {
    expect(personalize("as {{title}}", lead)).toBe("as CEO");
  });

  it("replaces {{industry}}", () => {
    expect(personalize("in {{industry}}", lead)).toBe("in SaaS");
  });

  it("replaces {{location}}", () => {
    expect(personalize("based in {{location}}", lead)).toBe("based in New York");
  });

  it("replaces multiple tokens in one pass", () => {
    expect(personalize("Hi {{firstName}} from {{company}}", lead)).toBe("Hi Alice from Acme Corp");
  });

  it("replaces all occurrences of the same token", () => {
    expect(personalize("{{firstName}} {{firstName}}", lead)).toBe("Alice Alice");
  });

  it("returns empty string for missing field (e.g. no firstName)", () => {
    const partial: Lead = { id: "ld_2", lastName: "Jones" };
    expect(personalize("Hi {{firstName}}", partial)).toBe("Hi ");
  });

  it("returns template unchanged when lead is null", () => {
    expect(personalize("Hi {{firstName}}", null)).toBe("Hi {{firstName}}");
  });

  it("fullName omits empty parts when only firstName present", () => {
    const partial: Lead = { id: "ld_3", firstName: "Bob" };
    expect(personalize("{{fullName}}", partial)).toBe("Bob");
  });

  it("fullName omits empty parts when only lastName present", () => {
    const partial: Lead = { id: "ld_4", lastName: "Brown" };
    expect(personalize("{{fullName}}", partial)).toBe("Brown");
  });
});

describe("bodyToHtml", () => {
  it("wraps text in a div with inline styles", () => {
    const html = bodyToHtml("Hello");
    expect(html).toContain("font-family:sans-serif");
    expect(html).toContain("<p style=");
    expect(html).toContain("Hello");
  });

  it("splits on newlines into separate <p> tags", () => {
    const html = bodyToHtml("line1\nline2");
    const paragraphs = html.match(/<p style="[^"]+">.*?<\/p>/g) ?? [];
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain("line1");
    expect(paragraphs[1]).toContain("line2");
  });

  it("handles empty string", () => {
    const html = bodyToHtml("");
    expect(html).toContain("<div");
    expect(html).toContain("</div>");
  });

  it("handles text with no newlines as single paragraph", () => {
    const html = bodyToHtml("single line");
    const paragraphs = html.match(/<p/g) ?? [];
    expect(paragraphs).toHaveLength(1);
  });
});
