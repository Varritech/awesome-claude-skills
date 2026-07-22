import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariableGuide } from "./VariableGuide";
import { MERGE_TAG_DOCS } from "@/lib/emails/merge-tags";

describe("VariableGuide", () => {
  it("renders every documented merge tag", () => {
    render(<VariableGuide onInsert={() => {}} />);
    for (const doc of MERGE_TAG_DOCS) {
      expect(screen.getByText(doc.tag)).toBeInTheDocument();
    }
  });

  it("calls onInsert with the tag when a tag chip is clicked", () => {
    const onInsert = vi.fn();
    render(<VariableGuide onInsert={onInsert} />);
    const first = MERGE_TAG_DOCS[0]!;
    fireEvent.click(screen.getByText(first.tag));
    expect(onInsert).toHaveBeenCalledWith(first.tag);
  });

  it("calls onInsert for each tag clicked", () => {
    const onInsert = vi.fn();
    render(<VariableGuide onInsert={onInsert} />);
    fireEvent.click(screen.getByText("{{company}}"));
    fireEvent.click(screen.getByText("{{firstName}}"));
    expect(onInsert).toHaveBeenNthCalledWith(1, "{{company}}");
    expect(onInsert).toHaveBeenNthCalledWith(2, "{{firstName}}");
  });
});