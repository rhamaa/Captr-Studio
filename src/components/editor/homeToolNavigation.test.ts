import { describe, expect, it } from "vitest";
import { getApplicationSurface, homeToolNavigationReducer } from "./homeToolNavigation";

describe("Home mini-app navigation", () => {
	it("opens and returns from Loop Background Studio", () => {
		const studio = homeToolNavigationReducer(null, { type: "open-loop-background-studio" });

		expect(studio).toBe("loop-background-studio");
		expect(homeToolNavigationReducer(studio, { type: "back-to-home" })).toBeNull();
	});

	it("keeps the active project surface above any Home tool selection", () => {
		expect(getApplicationSurface(true, "loop-background-studio")).toBe("project");
		expect(getApplicationSurface(false, null)).toBe("home");
		expect(getApplicationSurface(false, "loop-background-studio")).toBe(
			"loop-background-studio",
		);
	});
});
