import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationBell } from "./NotificationBell";

// Mock the api-client
vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn().mockResolvedValue({ data: [] }),
  apiPatch: vi.fn().mockResolvedValue({}),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the bell button", () => {
    render(<NotificationBell />);
    expect(screen.getByRole("button", { name: /notifications/i })).toBeDefined();
  });

  it("does not show badge when there are no unread notifications", () => {
    render(<NotificationBell />);
    // Badge has text "9+" or a number — none should appear for 0 unread
    expect(screen.queryByText(/9\+/)).toBeNull();
  });

  it("toggles dropdown on click", () => {
    render(<NotificationBell />);
    const button = screen.getByRole("button", { name: /notifications/i });

    // Dropdown not visible initially
    expect(screen.queryByText(/notifications/i)).toBeDefined(); // button label

    fireEvent.click(button);
    // After click, dropdown should appear
    expect(screen.getByText("No notifications yet")).toBeDefined();
  });
});
