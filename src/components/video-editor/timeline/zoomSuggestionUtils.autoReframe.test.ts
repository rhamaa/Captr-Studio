import { describe, expect, it } from "vitest";
import type { CursorTelemetryPoint } from "../types";
import { buildAutoReframeSuggestions } from "./zoomSuggestionUtils";

describe("buildAutoReframeSuggestions", () => {
	const sampleTelemetry: CursorTelemetryPoint[] = [
		{ timeMs: 100, cx: 0.2, cy: 0.3, interactionType: "move" },
		{ timeMs: 500, cx: 0.2, cy: 0.3, interactionType: "click" },
		{ timeMs: 800, cx: 0.25, cy: 0.35, interactionType: "move" },
		{ timeMs: 4000, cx: 0.85, cy: 0.85, interactionType: "click" },
		{ timeMs: 4200, cx: 0.86, cy: 0.86, interactionType: "move" },
	];

	it("returns no-telemetry when telemetry is empty", () => {
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: [],
			totalMs: 5000,
			targetAspectRatio: "9:16",
		});
		expect(result.status).toBe("no-telemetry");
		expect(result.suggestions).toHaveLength(0);
	});

	it("returns no-slots when totalMs is 0", () => {
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: sampleTelemetry,
			totalMs: 0,
			targetAspectRatio: "9:16",
		});
		expect(result.status).toBe("no-slots");
	});

	it("generates 9:16 vertical auto-reframe suggestions with social safe zone biasing", () => {
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: sampleTelemetry,
			totalMs: 5000,
			targetAspectRatio: "9:16",
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions.length).toBeGreaterThan(0);

		for (const s of result.suggestions) {
			// Depth for vertical social video is at least 3 (1.75x)
			expect(s.depth).toBeGreaterThanOrEqual(3);
			// Focus must be clamped within valid bounds
			expect(s.focus.cx).toBeGreaterThanOrEqual(0.05);
			expect(s.focus.cx).toBeLessThanOrEqual(0.95);
			expect(s.focus.cy).toBeGreaterThanOrEqual(0.05);
			expect(s.focus.cy).toBeLessThanOrEqual(0.95);
		}

		// Check safe-zone bias for second click at cx: 0.85, cy: 0.85
		// Should be biased away from right edge (icons) and bottom edge (captions)
		const second = result.suggestions.find((s) => s.start >= 2000);
		if (second) {
			expect(second.focus.cy).toBeLessThan(0.85);
			expect(second.focus.cx).toBeLessThan(0.85);
		}
	});

	it("generates 1:1 square auto-reframe suggestions", () => {
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: sampleTelemetry,
			totalMs: 5000,
			targetAspectRatio: "1:1",
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions.length).toBeGreaterThan(0);
		for (const s of result.suggestions) {
			expect(s.depth).toBeGreaterThanOrEqual(2);
		}
	});

	it("generates 4:5 portrait auto-reframe suggestions", () => {
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: sampleTelemetry,
			totalMs: 5000,
			targetAspectRatio: "4:5",
		});

		expect(result.status).toBe("ok");
		expect(result.suggestions.length).toBeGreaterThan(0);
	});

	it("respects reservedSpans and does not overlap", () => {
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: sampleTelemetry,
			totalMs: 6000,
			targetAspectRatio: "9:16",
			reservedSpans: [{ start: 0, end: 1500 }],
		});

		expect(result.status).toBe("ok");
		for (const s of result.suggestions) {
			const overlapsReserved = s.end > 0 && s.start < 1500;
			expect(overlapsReserved).toBe(false);
		}
	});
});
