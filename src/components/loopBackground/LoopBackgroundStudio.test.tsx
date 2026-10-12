import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoopBackgroundStudio } from "./LoopBackgroundStudio";

vi.mock("@/contexts/I18nContext", () => ({
	useScopedT: () => (_key: string, fallback?: string) => fallback ?? _key,
}));

describe("LoopBackgroundStudio", () => {
	it("shows the three patterns and core loop settings", () => {
		const html = renderToStaticMarkup(<LoopBackgroundStudio onBack={() => {}} />);

		expect(html).toContain("Loop Background Studio");
		expect(html).toContain("Dot Noise");
		expect(html).toContain("Film Grain");
		expect(html).toContain("Orbit");
		expect(html).toContain('aria-label="Aspect ratio"');
		expect(html).toContain('aria-label="Duration in seconds"');
		expect(html).toContain('aria-label="Frame rate"');
		expect(html).toContain("Export GIF");
	});
});
