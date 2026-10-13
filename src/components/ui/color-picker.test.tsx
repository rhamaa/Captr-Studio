import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ColorPicker, hexToHsv, hsvToHex, normalizeHexColor } from "./color-picker";

describe("ColorPicker", () => {
	it("shows a themed HEX editor instead of RGB channels", () => {
		const html = renderToStaticMarkup(
			<ColorPicker
				label="Window tint"
				value="#4a80ff"
				onChange={vi.fn()}
				defaultOpen
				usePortal={false}
			/>,
		);

		expect(html).toContain('data-color-picker-card="true"');
		expect(html).toContain('aria-label="Window tint HEX value"');
		expect(html).toContain('value="#4A80FF"');
		expect(html).toContain('type="text"');
		expect(html).not.toContain('type="color"');
		expect(html).not.toContain("RGB");
	});

	it("normalizes short HEX values and converts HSV without losing the color", () => {
		expect(normalizeHexColor("#abc")).toBe("#AABBCC");
		expect(normalizeHexColor("rgb(255, 0, 0)", "#ffffff")).toBe("#FFFFFF");
		expect(hexToHsv("#FF0000")).toEqual({ hue: 0, saturation: 1, value: 1 });
		expect(hsvToHex({ hue: 120, saturation: 1, value: 1 })).toBe("#00FF00");
	});
});
