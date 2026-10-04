import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StandardTimelineItem } from "./StandardTimelineItem";

describe("StandardTimelineItem cut controls", () => {
	it("exposes cut removal directly on the timeline block", () => {
		const html = renderToStaticMarkup(
			createElement(StandardTimelineItem, {
				variant: "trim",
				span: { start: 1000, end: 2000 },
				timeLabel: "0:01.000 – 0:02.000",
				onDelete: () => {},
			}),
		);

		expect(html).toContain('aria-label="Remove cut 0:01.000 – 0:02.000"');
	});
});
