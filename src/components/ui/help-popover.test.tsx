import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { HelpPopover } from "./help-popover";

it("offers named keyboard-accessible help without printing the hint in the panel", () => {
	const html = renderToStaticMarkup(<HelpPopover label="Overlay shortcuts">Press Tab to select the next overlay.</HelpPopover>);
	expect(html).toContain('type="button"');
	expect(html).toContain('aria-label="Overlay shortcuts"');
	expect(html).toContain('aria-haspopup="dialog"');
	expect(html).not.toContain("Press Tab to select the next overlay.");
});
