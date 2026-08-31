/**
 * Tests for new lead schema additions:
 * - leadStatusSchema (includes 'flagged')
 * - tags field on leadSchema
 * - updateLeadStatusSchema
 * - updateLeadTagsSchema
 * - enrichLeadSchema
 * - bulkLeadActionSchema
 * - suppressionSchema / createSuppressionSchema
 * - dncSchema / createDncSchema
 * - leadSourceSchema (includes 'leadsgorilla')
 */

import { describe, it, expect } from "vitest";
import {
  leadStatusSchema,
  leadSourceSchema,
  leadSchema,
  updateLeadStatusSchema,
  updateLeadTagsSchema,
  enrichLeadSchema,
  bulkLeadActionSchema,
  createSuppressionSchema,
  createDncSchema,
} from "./lead";

const NOW = new Date().toISOString();

describe("leadStatusSchema", () => {
  it("accepts all valid statuses including flagged", () => {
    const statuses = [
      "new",
      "contacted",
      "replied",
      "booked",
      "unsubscribed",
      "bounced",
      "flagged",
    ];
    for (const s of statuses) {
      expect(() => leadStatusSchema.parse(s)).not.toThrow();
    }
  });

  it("rejects unknown status", () => {
    expect(() => leadStatusSchema.parse("invalid")).toThrow();
  });
});

describe("leadSourceSchema", () => {
  it("accepts leadsgorilla as a valid source", () => {
    expect(() => leadSourceSchema.parse("leadsgorilla")).not.toThrow();
  });

  it("rejects unknown source", () => {
    expect(() => leadSourceSchema.parse("randomsource")).toThrow();
  });
});

describe("leadSchema tags field", () => {
  const baseLead = {
    id: "ld_1",
    userId: "user_1",
    status: "new",
    source: "manual",
    createdAt: NOW,
    updatedAt: NOW,
  };

  it("defaults tags to empty array", () => {
    const parsed = leadSchema.parse(baseLead);
    expect(parsed.tags).toEqual([]);
  });

  it("accepts a tags array", () => {
    const parsed = leadSchema.parse({ ...baseLead, tags: ["vip", "hot"] });
    expect(parsed.tags).toEqual(["vip", "hot"]);
  });
});

describe("updateLeadStatusSchema", () => {
  it("accepts a valid status", () => {
    const result = updateLeadStatusSchema.parse({ status: "contacted" });
    expect(result.status).toBe("contacted");
  });

  it("rejects missing status", () => {
    expect(() => updateLeadStatusSchema.parse({})).toThrow();
  });
});

describe("updateLeadTagsSchema", () => {
  it("accepts a valid tags array", () => {
    const result = updateLeadTagsSchema.parse({ tags: ["cold", "outreach"] });
    expect(result.tags).toEqual(["cold", "outreach"]);
  });

  it("rejects empty tags array", () => {
    expect(() => updateLeadTagsSchema.parse({ tags: [] })).toThrow();
  });

  it("rejects tags with empty string values", () => {
    expect(() => updateLeadTagsSchema.parse({ tags: [""] })).toThrow();
  });
});

describe("enrichLeadSchema", () => {
  it("accepts valid provider and fields", () => {
    const input = { provider: "apollo", fields: { revenue: 1_000_000 } };
    const result = enrichLeadSchema.parse(input);
    expect(result.provider).toBe("apollo");
    expect(result.fields.revenue).toBe(1_000_000);
  });

  it("rejects unknown provider", () => {
    expect(() => enrichLeadSchema.parse({ provider: "unknown", fields: {} })).toThrow();
  });

  it("accepts all valid providers", () => {
    for (const p of ["apollo", "aleads", "snov"]) {
      expect(() => enrichLeadSchema.parse({ provider: p, fields: { x: 1 } })).not.toThrow();
    }
  });
});

describe("bulkLeadActionSchema", () => {
  it("accepts delete action with leadIds", () => {
    const result = bulkLeadActionSchema.parse({ action: "delete", leadIds: ["ld_1", "ld_2"] });
    expect(result.action).toBe("delete");
  });

  it("accepts tag action with value", () => {
    const result = bulkLeadActionSchema.parse({ action: "tag", leadIds: ["ld_1"], value: "hot" });
    expect(result.value).toBe("hot");
  });

  it("rejects empty leadIds array", () => {
    expect(() => bulkLeadActionSchema.parse({ action: "delete", leadIds: [] })).toThrow();
  });

  it("rejects unknown action", () => {
    expect(() => bulkLeadActionSchema.parse({ action: "archive", leadIds: ["ld_1"] })).toThrow();
  });
});

describe("createSuppressionSchema", () => {
  it("accepts valid email and reason", () => {
    const result = createSuppressionSchema.parse({ email: "test@example.com", reason: "bounced" });
    expect(result.email).toBe("test@example.com");
    expect(result.reason).toBe("bounced");
  });

  it("defaults reason to manual", () => {
    const result = createSuppressionSchema.parse({ email: "test@example.com" });
    expect(result.reason).toBe("manual");
  });

  it("rejects invalid email", () => {
    expect(() => createSuppressionSchema.parse({ email: "not-email" })).toThrow();
  });
});

describe("createDncSchema", () => {
  it("accepts valid email", () => {
    const result = createDncSchema.parse({ email: "dnc@example.com" });
    expect(result.email).toBe("dnc@example.com");
  });

  it("defaults source to admin", () => {
    const result = createDncSchema.parse({ email: "dnc@example.com" });
    expect(result.source).toBe("admin");
  });
});
