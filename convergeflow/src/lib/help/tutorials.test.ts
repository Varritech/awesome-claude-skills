import { describe, it, expect } from "vitest";
import { tutorials } from "./tutorials";

describe("tutorials data", () => {
  it("contains at least 6 tutorials", () => {
    expect(tutorials.length).toBeGreaterThanOrEqual(6);
  });

  it("each tutorial has required fields", () => {
    for (const tutorial of tutorials) {
      expect(tutorial.id).toBeTruthy();
      expect(tutorial.title).toBeTruthy();
      expect(tutorial.description).toBeTruthy();
      expect(tutorial.duration).toBeTruthy();
      expect(tutorial.thumbnail).toBeTruthy();
      expect(tutorial.videoUrl).toBeTruthy();
      expect(tutorial.category).toBeTruthy();
      expect(typeof tutorial.order).toBe("number");
    }
  });

  it("covers the 6 required tutorial categories", () => {
    const ids = tutorials.map((t) => t.id);
    const required = [
      "account-setup",
      "domain-connection",
      "inbox-warmup",
      "first-campaign",
      "reading-analytics",
      "reply-management",
    ];
    for (const id of required) {
      expect(ids).toContain(id);
    }
  });

  it("ids are unique", () => {
    const ids = tutorials.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tutorials are sorted by order field", () => {
    const sorted = [...tutorials].sort((a, b) => a.order - b.order);
    expect(tutorials.map((t) => t.id)).toEqual(sorted.map((t) => t.id));
  });

  it("duration is a non-empty string", () => {
    for (const t of tutorials) {
      expect(t.duration.trim().length).toBeGreaterThan(0);
    }
  });
});
