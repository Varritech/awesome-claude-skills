import { describe, it, expect, vi } from "vitest";
import { classifyReplyWithAI } from "./ai-classifier";
import type { OllamaClientForClassifier } from "./ai-classifier";

function makeClient(response: string): OllamaClientForClassifier {
  return {
    chat: vi.fn().mockResolvedValue(response),
  };
}

function makeFailingClient(): OllamaClientForClassifier {
  return {
    chat: vi.fn().mockRejectedValue(new Error("Ollama unavailable")),
  };
}

describe("classifyReplyWithAI", () => {
  it("returns the AI category when Ollama returns a valid category", async () => {
    const client = makeClient("booked");
    const result = await classifyReplyWithAI("Looking forward to our call!", client);
    expect(result).toBe("booked");
  });

  it("handles AI response with extra whitespace or newlines", async () => {
    const client = makeClient("  not_interested\n");
    const result = await classifyReplyWithAI("No thanks.", client);
    expect(result).toBe("not_interested");
  });

  it("falls back to keyword classifier when Ollama returns an unrecognised value", async () => {
    const client = makeClient("unknown_category");
    // Body has strong out_of_office signals
    const result = await classifyReplyWithAI("I'm out of office and will return Monday.", client);
    expect(result).toBe("out_of_office");
  });

  it("falls back to keyword classifier when Ollama throws", async () => {
    const client = makeFailingClient();
    const result = await classifyReplyWithAI(
      "Do not contact me again. Please stop emailing and unsubscribe me. Do not email me ever.",
      client
    );
    expect(result).toBe("do_not_contact");
  });

  it("falls back to interested when Ollama throws and no keywords match", async () => {
    const client = makeFailingClient();
    const result = await classifyReplyWithAI("Hello.", client);
    expect(result).toBe("interested");
  });

  it("accepts all valid category names from AI", async () => {
    const categories = [
      "interested",
      "not_interested",
      "do_not_contact",
      "auto_reply",
      "out_of_office",
      "referral",
      "question",
      "booked",
    ] as const;

    for (const cat of categories) {
      const client = makeClient(cat);
      const result = await classifyReplyWithAI("some body", client);
      expect(result).toBe(cat);
    }
  });
});
