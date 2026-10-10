import type { TimelineClip, TimelineProject, TimelineTrack } from "./types";

export const fixtureText = {
	content: "Local title",
	fontFamily: "Arial",
	fontSizePx: 48,
	fontWeight: 400,
	color: "#ffffff",
	align: "center" as const,
};
export function fixtureClip(id: string, source: object = { assetId: "shared" }): TimelineClip {
	return {
		id,
		startUs: 0,
		sourceInUs: 0,
		sourceOutUs: 5_000_000,
		rate: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		gain: 1,
		enabled: true,
		...source,
	} as TimelineClip;
}
export function fixtureTrack(
	id: string,
	clips: TimelineClip[] = [],
	kind: "visual" | "audio" = "visual",
): TimelineTrack {
	return { id, name: id, kind, locked: false, muted: false, hidden: false, clips };
}
export function ownershipFixture(): TimelineProject {
	const inlineText = fixtureClip("text-A", {
		content: { kind: "text", text: { ...fixtureText }, durationUs: 5_000_000 },
	});
	const inlineShape = fixtureClip("shape-A", {
		content: {
			kind: "shape",
			durationUs: 5_000_000,
			shapeDefinition: {
				kind: "rectangle",
				width: 100,
				height: 50,
				style: { fill: "#ffffff", stroke: null },
			},
		},
	});
	const artboard = (id: string) => ({
		id,
		name: id,
		aspectRatio: "16:9" as const,
		width: 1920,
		height: 1080,
		framing: { scale: 1, offsetX: 0, offsetY: 0, fitMode: "contain" as const },
		tracks: [
			fixtureTrack(`visual-${id}`, [
				fixtureClip(`record-${id}`, {
					assetId: "record",
					compositionId: `composition-${id}`,
				}),
			]),
		],
	});
	return {
		version: 3,
		projectId: "ownership",
		title: "Ownership",
		canvas: { width: 1920, height: 1080, fps: 30 },
		assets: [
			{
				id: "shared",
				kind: "video",
				name: "Shared video",
				width: 1920,
				height: 1080,
				durationUs: 10_000_000,
				source: { path: "shared.mp4", durationUs: 10_000_000, offsetUs: 0 },
			},
			{
				id: "record",
				kind: "recording",
				name: "Record",
				width: 1920,
				height: 1080,
				durationUs: 5_000_000,
				packageId: "package",
			},
		],
		packages: [
			{
				id: "package",
				captureId: "capture",
				schemaVersion: 1,
				width: 1920,
				height: 1080,
				durationUs: 5_000_000,
				screen: { path: "screen.mp4", durationUs: 5_000_000, offsetUs: 0 },
				settings: {},
			},
		],
		compositions: ["A", "B"].map((id) => ({
			id: `composition-${id}`,
			packageId: "package",
			revision: 0,
			durationUs: 5_000_000,
			settings: {},
			timeMap: [{ outputStartUs: 0, outputEndUs: 5_000_000, sourceStartUs: 0, rate: 1 }],
		})),
		tracks: [fixtureTrack("root", [fixtureClip("root-video")])],
		repurposeBoard: {
			activeSliceId: null,
			slices: [],
			artboards: [
				{
					...artboard("A"),
					localAssets: [
						{
							id: "voice-A",
							name: "Voice A",
							kind: "audio",
							width: 0,
							height: 0,
							durationUs: 5_000_000,
							source: { path: "voice.wav", durationUs: 5_000_000, offsetUs: 0 },
						},
					],
					tracks: [
						...artboard("A").tracks,
						fixtureTrack("design-text", [inlineText]),
						fixtureTrack("design-shape", [inlineShape]),
						fixtureTrack(
							"audio-A",
							[fixtureClip("voice-clip", { assetId: "voice-A" })],
							"audio",
						),
					],
				},
				artboard("B"),
			],
		},
		createdAt: "2026-10-10",
		updatedAt: "2026-10-10",
	} as TimelineProject;
}
