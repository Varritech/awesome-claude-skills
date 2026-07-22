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
});