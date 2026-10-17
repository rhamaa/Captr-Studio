import { describe, expect, it } from "vitest";
import { getBackgroundTabForWallpaper } from "./wallpaperUtils";

describe("getBackgroundTabForWallpaper", () => {
	it("selects the dynamic tab for a generated background", () => {
		expect(getBackgroundTabForWallpaper("captr-dynamic-bg:v1:dot-noise")).toBe("dynamic");
	});
});
