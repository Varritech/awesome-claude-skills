import { describe, it, expect } from "vitest";

/**
 * Tests for Calendly webhook payload shapes.
 * We verify the payload parsing logic without invoking Firestore.
 */

interface CalendlyPayload {
  event: string;
  payload: {
    email: string;
    name: string;
    event_type?: { name?: string };
  };
}

function isBookingEvent(payload: CalendlyPayload): boolean {
  return payload.event === "invitee.created" && !!payload.payload.email;
}

describe("Calendly webhook payload", () => {
  it("recognises an invitee.created event", () => {
    const payload: CalendlyPayload = {
      event: "invitee.created",
      payload: { email: "jane@acme.com", name: "Jane Smith" },
    };
    expect(isBookingEvent(payload)).toBe(true);
  });

  it("ignores other event types", () => {
    const payload: CalendlyPayload = {
      event: "invitee.canceled",
      payload: { email: "jane@acme.com", name: "Jane Smith" },
    };
    expect(isBookingEvent(payload)).toBe(false);
  });

  it("rejects when email is missing", () => {
    const payload = {
      event: "invitee.created",
      payload: { email: "", name: "Jane Smith" },
    };
    expect(isBookingEvent(payload)).toBe(false);
  });
});
