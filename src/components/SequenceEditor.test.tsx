import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
}));

import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { SequenceEditor } from "./SequenceEditor";

beforeEach(() => {
  (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
  (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
  (apiPut as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
});

describe("SequenceEditor", () => {
  it("loads + renders an existing sequence's steps", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: "seq_1",
      name: "Outbound A",
      steps: [
        { order: 0, subject: "Hello", body: "Hi {{firstName}}", delayDays: 0, condition: { type: "always", afterDays: 0 } },
        { order: 1, subject: "Follow-up", body: "Did you see this?", delayDays: 2, condition: { type: "no_reply", afterDays: 2 } },
      ],
    });
    render(<SequenceEditor sequenceId="seq_1" />);

    expect(await screen.findByDisplayValue("Hello")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Follow-up")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hi {{firstName}}")).toBeInTheDocument();
  });

  it("starts with one blank step when there is no existing sequence", async () => {
    render(<SequenceEditor />);
    expect(await screen.findByPlaceholderText(/Subject/i)).toBeInTheDocument();
  });

  it("adds a step on 'Add step'", async () => {
    render(<SequenceEditor />);
    const before = (await screen.findAllByPlaceholderText(/Subject/i)).length;
    fireEvent.click(screen.getByRole("button", { name: /Add step/i }));
    expect((await screen.findAllByPlaceholderText(/Subject/i)).length).toBe(before + 1);
  });

  it("creates a new sequence via POST on save", async () => {
    (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: "seq_new",
      name: "My sequence",
      steps: [],
    });
    render(<SequenceEditor />);
    fireEvent.change(await screen.findByPlaceholderText(/Sequence name/i), {
      target: { value: "My sequence" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save sequence/i }));
    expect(apiPost).toHaveBeenCalledWith(
      "/api/sequences",
      expect.objectContaining({ name: "My sequence" }),
    );
  });

  it("saves an existing sequence via PUT", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: "seq_1",
      name: "Outbound A",
      steps: [
        { order: 0, subject: "Hello", body: "Hi", delayDays: 0, condition: { type: "always", afterDays: 0 } },
      ],
    });
    (apiPut as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: "seq_1",
      name: "Outbound A",
      steps: [],
    });
    render(<SequenceEditor sequenceId="seq_1" />);
    await screen.findByDisplayValue("Hello");
    fireEvent.click(screen.getByRole("button", { name: /Save sequence/i }));
    expect(apiPut).toHaveBeenCalledWith(
      "/api/sequences/seq_1",
      expect.objectContaining({ name: "Outbound A" }),
    );
  });

  it("fires onSaved with the new sequence id when a new sequence is created", async () => {
    (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: "seq_new",
      name: "My sequence",
      steps: [],
    });
    const onSaved = vi.fn();
    render(<SequenceEditor onSaved={onSaved} />);
    fireEvent.change(await screen.findByPlaceholderText(/Sequence name/i), {
      target: { value: "My sequence" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save sequence/i }));
    await screen.findByText(/Saving…|Save sequence/i);
    // wait for the post to resolve + onSaved to fire
    await new Promise((r) => setTimeout(r, 0));
    expect(onSaved).toHaveBeenCalledWith("seq_new");
  });

  it("AI-generates a sequence from a picked lead when campaignId is provided", async () => {
    (apiGet as unknown as { mockImplementation: (f: (path: string) => unknown) => void }).mockImplementation(
      (path: string) => {
        if (path.startsWith("/api/leads")) {
          return { data: [{ id: "ld_1", firstName: "Jane", company: "Acme" }] };
        }
        return null;
      },
    );
    (apiPost as unknown as { mockImplementation: (f: (path: string, body: unknown) => unknown) => void }).mockImplementation(
      (path: string) => {
        if (path.endsWith("/generate-sequence")) {
          return {
            emails: [
              { emailNumber: 1, dayOffset: 0, subject: "Intro", body: "Hi {{firstName}}", variant: "A", plainText: true },
              { emailNumber: 2, dayOffset: 2, subject: "Follow", body: "Did you see this?", variant: "A", plainText: true },
            ],
          };
        }
        return null;
      },
    );
    render(<SequenceEditor campaignId="cmp_1" />);
    // open the AI-generate picker + pick the lead
    fireEvent.click(await screen.findByRole("button", { name: /AI-generate/i }));
    const leadSelect = await screen.findByLabelText(/Pick a lead/i);
    fireEvent.change(leadSelect, { target: { value: "ld_1" } });
    fireEvent.click(screen.getByRole("button", { name: /^Generate$/i }));
    // the two generated subjects should populate the step inputs
    expect(await screen.findByDisplayValue("Intro")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Follow")).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith(
      "/api/campaigns/cmp_1/generate-sequence",
      expect.objectContaining({ prospectId: "ld_1" }),
    );
  });
});