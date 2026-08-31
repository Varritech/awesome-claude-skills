import { describe, it, expect } from "vitest";
import { resolveMergeTags, extractMergeTags, previewMergeTags } from "./merge-tags";

const SENDER = { name: "Christian", company: "Varritech" };

describe("resolveMergeTags", () => {
  it("replaces {{firstName}} with lead firstName", () => {
    const result = resolveMergeTags("Hi {{firstName}},", { firstName: "Jane" }, SENDER);
    expect(result).toBe("Hi Jane,");
  });

  it("replaces {{lastName}} with lead lastName", () => {
    const result = resolveMergeTags("Hi {{lastName}},", { lastName: "Smith" }, SENDER);
    expect(result).toBe("Hi Smith,");
  });

  it("replaces {{company}} with lead company", () => {
    const result = resolveMergeTags("at {{company}}", { company: "Acme" }, SENDER);
    expect(result).toBe("at Acme");
  });

  it("replaces {{title}} with lead title", () => {
    const result = resolveMergeTags("as {{title}}", { title: "CTO" }, SENDER);
    expect(result).toBe("as CTO");
  });

  it("replaces {{industry}} with lead industry", () => {
    const result = resolveMergeTags("in {{industry}}", { industry: "FinTech" }, SENDER);
    expect(result).toBe("in FinTech");
  });

  it("replaces {{location}} with lead location", () => {
    const result = resolveMergeTags("based in {{location}}", { location: "Austin, TX" }, SENDER);
    expect(result).toBe("based in Austin, TX");
  });

  it("replaces {{senderName}} with sender name", () => {
    const result = resolveMergeTags("From {{senderName}}", {}, SENDER);
    expect(result).toBe("From Christian");
  });

  it("replaces {{senderCompany}} with sender company", () => {
    const result = resolveMergeTags("at {{senderCompany}}", {}, SENDER);
    expect(result).toBe("at Varritech");
  });

  it("replaces {{currentDate}} with a non-empty date string", () => {
    const result = resolveMergeTags("Today is {{currentDate}}", {}, SENDER);
    expect(result).not.toContain("{{currentDate}}");
    expect(result.length).toBeGreaterThan("Today is ".length);
  });

  it("replaces {{customSubdomain}} with the extra value", () => {
    const result = resolveMergeTags("app.{{customSubdomain}}.io", {}, SENDER, {
      customSubdomain: "acme",
    });
    expect(result).toBe("app.acme.io");
  });

  it("leaves unresolved tags as empty string when lead field is absent", () => {
    const result = resolveMergeTags("Hi {{firstName}} at {{company}}", {}, SENDER);
    expect(result).toBe("Hi  at ");
  });

  it("resolves multiple occurrences of the same tag", () => {
    const result = resolveMergeTags(
      "{{firstName}} ... {{firstName}}",
      { firstName: "Jane" },
      SENDER
    );
    expect(result).toBe("Jane ... Jane");
  });

  it("resolves all tags in a realistic email body", () => {
    const template = `Hi {{firstName}},\n\nI noticed you work at {{company}} as {{title}}.\n\nBest,\n{{senderName}}\n{{senderCompany}}`;
    const result = resolveMergeTags(
      template,
      { firstName: "Jane", company: "Acme", title: "VP" },
      SENDER
    );
    expect(result).toContain("Hi Jane,");
    expect(result).toContain("Acme");
    expect(result).toContain("VP");
    expect(result).toContain("Christian");
    expect(result).toContain("Varritech");
  });
});

describe("extractMergeTags", () => {
  it("returns all merge tags found in a template", () => {
    const tags = extractMergeTags("Hi {{firstName}} at {{company}}");
    expect(tags).toContain("{{firstName}}");
    expect(tags).toContain("{{company}}");
    expect(tags).not.toContain("{{lastName}}");
  });

  it("returns empty array when no tags found", () => {
    expect(extractMergeTags("No tags here")).toEqual([]);
  });
});

describe("previewMergeTags", () => {
  it("returns a string with no unresolved {{tags}}", () => {
    const template = "Hi {{firstName}} from {{company}}, {{senderName}} here.";
    const preview = previewMergeTags(template);
    expect(preview).not.toContain("{{");
    expect(preview).not.toContain("}}");
    expect(preview).toContain("Jane");
  });
});
