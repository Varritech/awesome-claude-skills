// Tracer-bullet coverage for the exact switch this change flips: which Meta action
// family counts as "this ad worked" depends on config.offer.goal. The 8-21 agency
// pivot needed goal=lead (booked calls); reverting to the Skills Library needs
// goal=purchase (checkout). Getting this wrong silently ranks every ad at zero
// conversions, which reads as "no creative works" (see posthog.js's own history of
// that exact failure mode) rather than erroring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { conversionsOf } from "../src/stages/variants.js";

test("goal=purchase counts purchase + its pixel twin, ignores lead actions", () => {
  const row = {
    actions: [
      { action_type: "purchase", value: "3" },
      { action_type: "offsite_conversion.fb_pixel_purchase", value: "3" },
      { action_type: "lead", value: "40" },
    ],
    action_values: [{ action_type: "purchase", value: "141" }],
  };
  const { conversions, value } = conversionsOf(row, "purchase");
  assert.equal(conversions, 3, "purchase and its pixel twin are the same conversion, not summed");
  assert.equal(value, 141);
});

test("goal=lead ignores purchase actions entirely (why the agency offer used it)", () => {
  const row = {
    actions: [{ action_type: "purchase", value: "3" }],
    action_values: [],
  };
  const { conversions } = conversionsOf(row, "lead");
  assert.equal(conversions, 0);
});

test("goal=purchase on a lead-only row (the Skills checkout never fires `lead`) returns zero, not a false match", () => {
  const row = {
    actions: [{ action_type: "lead", value: "40" }],
    action_values: [],
  };
  const { conversions } = conversionsOf(row, "purchase");
  assert.equal(conversions, 0);
});
