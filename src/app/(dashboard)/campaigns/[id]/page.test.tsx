import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/api-client", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cmp_1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import CampaignDetailPage from "./page";

beforeEach(() => {
  (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
  (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
  (apiPatch as unknown as { mockResolvedValue: (v: unknown) => void }).mockReset();
});

const campaignPayload = {
  id: "cmp_1",
  name: "Outbound A",
  status: "draft",
  persona: "closer",
  sequenceId: undefined,
  emails: [],
};

describe("CampaignDetailPage", () => {
  it("renders the campaign name + sequence editor", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ data: campaignPayload });
    render(<CampaignDetailPage />);
    expect(await screen.findByText("Outbound A")).toBeInTheDocument();
    expect(await screen.findByPlaceholderText(/Sequence name/i)).toBeInTheDocument();
  });

  it("starts the campaign via POST /api/campaigns/[id]/start", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ data: campaignPayload });
    (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ data: { started: true } });
    render(<CampaignDetailPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Start campaign/i }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/campaigns/cmp_1/start", expect.anything()),
    );
  });

  it("links the saved sequence to the campaign via PATCH", async () => {
    (apiGet as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({ data: campaignPayload });
    // POST /api/sequences returns a new sequence id → onSaved → PATCH campaign
    (apiPost as unknown as { mockImplementation: (f: (path: string, b: unknown) => unknown) => void }).mockImplementation(
      (path: string) => (path === "/api/sequences" ? { id: "seq_new" } : null),
    );
    render(<CampaignDetailPage />);
    fireEvent.change(await screen.findByPlaceholderText(/Sequence name/i), {
      target: { value: "My sequence" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save sequence/i }));
    await waitFor(() =>
      expect(apiPatch).toHaveBeenCalledWith("/api/campaigns/cmp_1", { sequenceId: "seq_new" }),
    );
  });

  it("attaches leads to the campaign via POST /api/campaigns/[id]/leads", async () => {
    (apiGet as unknown as { mockImplementation: (f: (path: string) => unknown) => void }).mockImplementation(
      (path: string) => {
        if (path === "/api/campaigns/cmp_1") return Promise.resolve({ data: campaignPayload });
        if (path === "/api/campaigns/cmp_1/leads") return Promise.resolve({ data: [] });
        if (path.startsWith("/api/leads")) {
          return Promise.resolve({ data: [{ id: "ld_1", firstName: "Jane", company: "Acme" }] });
        }
        return Promise.resolve(null);
      },
    );
    (apiPost as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      data: { attached: 1 },
    });
    render(<CampaignDetailPage />);
    // wait for the lead to appear in the "Add leads" picker
    const checkbox = await screen.findByLabelText(/Jane.*Acme/i);
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: /Add to campaign/i }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith("/api/campaigns/cmp_1/leads", {
        leadIds: ["ld_1"],
      }),
    );
  });
});