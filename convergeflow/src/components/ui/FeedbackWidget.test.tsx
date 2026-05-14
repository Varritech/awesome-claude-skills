import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FeedbackWidget } from "./FeedbackWidget";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("FeedbackWidget", () => {
  it("renders a floating trigger button", () => {
    render(<FeedbackWidget />);
    expect(screen.getByRole("button", { name: /feedback/i })).toBeInTheDocument();
  });

  it("does not show the modal by default", () => {
    render(<FeedbackWidget />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the modal when trigger is clicked", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows type selector options", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByText(/bug/i)).toBeInTheDocument();
    expect(screen.getByText(/feature/i)).toBeInTheDocument();
    expect(screen.getByText(/general/i)).toBeInTheDocument();
  });

  it("shows a textarea for the message", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("has a submit button", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("submits feedback and shows success message", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "abc" }) });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "This is a bug report" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/thank you/i)).toBeInTheDocument();
    });
  });

  it("calls POST /api/feedback with correct shape", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My message" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/feedback",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
          body: expect.stringContaining("My message"),
        })
      );
    });
  });

  it("closes modal when close button is clicked", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /feedback/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
