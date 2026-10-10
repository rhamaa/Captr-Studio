import { describe, expect, it } from "vitest";
import { getStoryProject } from "@/core/timeline/storyOwnership";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { applyClipGesture, applyTimelineDrop } from "./timelineInteractions";

describe("inline and private timeline interactions", () => {
	it("trims inline sources within their logical extent and drops only owner-private media", () => {
		const a = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
		const trimmed = applyClipGesture(a, "text-A", { kind: "trim-out", deltaUs: -1_000_000 });
		expect(trimmed.tracks.flatMap((t) => t.clips).find((c) => c.id === "text-A")).toMatchObject(
			{ sourceOutUs: 4_000_000, content: { durationUs: 5_000_000 } },
		);
		const placed = applyTimelineDrop(
			a,
			{
				type: "asset",
				id: "voice-A",
				preferredTrackId: "audio-A",
				startUs: 5_000_000,
				durationUs: 5_000_000,
			},
			{ clipId: "drop-voice", trackId: "new-track" },
		);
		expect(
			placed.tracks.flatMap((t) => t.clips).find((c) => c.id === "drop-voice")?.assetId,
		).toBe("voice-A");
		const b = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "B" });
		expect(() =>
			applyTimelineDrop(
				b,
				{
					type: "asset",
					id: "voice-A",
					preferredTrackId: "visual-B",
					startUs: 5_000_000,
					durationUs: 5_000_000,
				},
				{ clipId: "wrong-owner", trackId: "new-track" },
			),
		).toThrow();
	});
});
