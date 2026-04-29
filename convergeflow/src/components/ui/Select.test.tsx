import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Select } from "./Select";

const testOptions = [
  { label: "Option A", value: "a" },
  { label: "Option B", value: "b" },
  { label: "Option C", value: "c" },
];

describe("Select", () => {
  it("renders with first option selected by default", () => {
    render(<Select options={testOptions} />);
    expect(screen.getByText("Option A")).toBeInTheDocument();
  });

  it("renders with controlled value", () => {
    render(<Select options={testOptions} value="b" />);
    expect(screen.getByText("Option B")).toBeInTheDocument();
  });

  it("shows Select... placeholder when no options match", () => {
    render(<Select options={testOptions} value="nonexistent" />);
    expect(screen.getByText("Select...")).toBeInTheDocument();
  });

  it("does not show dropdown by default", () => {
    render(<Select options={testOptions} />);
    // Only the trigger button text should be visible, not all options
    expect(screen.queryByText("Option B")).not.toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    render(<Select options={testOptions} />);
    fireEvent.click(screen.getByRole("button"));
    // All options visible
    expect(screen.getByText("Option B")).toBeInTheDocument();
    expect(screen.getByText("Option C")).toBeInTheDocument();
  });

  it("calls onChange and closes dropdown on option select", () => {
    const handleChange = vi.fn();
    render(<Select options={testOptions} onChange={handleChange} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Option B"));
    expect(handleChange).toHaveBeenCalledWith("b");
    // Dropdown closes - Option C should no longer be visible
    expect(screen.queryByText("Option C")).not.toBeInTheDocument();
  });

  it("updates displayed value in uncontrolled mode", () => {
    render(<Select options={testOptions} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Option C"));
    // Now the trigger shows Option C
    expect(screen.getByText("Option C")).toBeInTheDocument();
  });

  it("highlights the selected option with text-cf-orange", () => {
    render(<Select options={testOptions} value="a" />);
    fireEvent.click(screen.getByRole("button"));
    // Find all option buttons in dropdown (they are type="button" inside the dropdown)
    const optionButtons = screen.getAllByRole("button");
    // First button is the trigger, subsequent ones are dropdown options
    const optionAInDropdown = optionButtons.find(
      (btn) => btn.textContent === "Option A" && btn !== optionButtons[0]
    );
    expect(optionAInDropdown?.className).toContain("text-cf-orange");
  });

  it("applies non-selected styling to other options", () => {
    render(<Select options={testOptions} value="a" />);
    fireEvent.click(screen.getByRole("button"));
    const optionButtons = screen.getAllByRole("button");
    const optionBInDropdown = optionButtons.find(
      (btn) => btn.textContent === "Option B"
    );
    expect(optionBInDropdown?.className).toContain("text-white/50");
  });

  it("renders the chevron SVG in the trigger", () => {
    const { container } = render(<Select options={testOptions} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("merges custom className on the trigger button", () => {
    render(<Select options={testOptions} className="extra-select" />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("extra-select");
  });

  it("trigger button has type=button to prevent form submission", () => {
    render(<Select options={testOptions} />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
