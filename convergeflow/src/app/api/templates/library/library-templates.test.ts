import { describe, it, expect } from "vitest";
import { LIBRARY_TEMPLATES } from "./route";

describe("LIBRARY_TEMPLATES", () => {
  it("contains exactly 10 templates", () => {
    expect(LIBRARY_TEMPLATES).toHaveLength(10);
  });

  it("all templates have isLibrary: true", () => {
    for (const t of LIBRARY_TEMPLATES) {
      expect(t.isLibrary).toBe(true);
    }
  });

  it("all templates have required fields", () => {
    for (const t of LIBRARY_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(["closer", "neighbor", "expert", "helper"]).toContain(t.persona);
      expect(t.subject).toBeTruthy();
      expect(t.body).toBeTruthy();
      expect(Array.isArray(t.tags)).toBe(true);
    }
  });

  it("has at least 2 templates per persona", () => {
    const personas = ["closer", "neighbor", "expert", "helper"] as const;
    for (const persona of personas) {
      const count = LIBRARY_TEMPLATES.filter((t) => t.persona === persona).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it("all template bodies contain an unsubscribe mention", () => {
    for (const t of LIBRARY_TEMPLATES) {
      expect(t.body.toLowerCase()).toMatch(/unsubscribe/);
    }
  });

  it("all template IDs are unique", () => {
    const ids = LIBRARY_TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
