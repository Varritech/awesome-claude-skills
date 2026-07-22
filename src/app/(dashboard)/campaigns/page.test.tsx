import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/campaigns",
}));

import { apiGet, apiPost } from "@/lib/api-client";
import CampaignsPage from "./page";

beforeEach(() => {
  push.mockReset();
  (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
  (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
});

describe("CampaignsPage", () => {
  it("lists campaigns from GET /api/campaigns", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      data: [
        { id: "cmp_1", name: "Outbound A", status: "draft", persona: "closer" },
        { id: "cmp_2", name: "Nurture B", status: "running", persona: "neighbor" },
      ],
    });
    render(<CampaignsPage />);
    expect(await screen.findByText("Outbound A")).toBeInTheDocument();
    expect(screen.getByText("Nurture B")).toBeInTheDocument();
  });

  it("creates a campaign on 'New campaign' + navigates to its detail page", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ data: [] });
    (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      data: { id: "cmp_new", name: "New campaign", status: "draft", persona: "closer" },
    });
    render(<CampaignsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New campaign/i }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/api/campaigns", expect.objectContaining({ name: "New campaign" })));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/campaigns/cmp_new"));
  });
});