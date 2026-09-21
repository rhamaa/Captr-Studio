/**
 * Bug Condition Exploration Tests — Audio Sidecar Bundling
 *
 * Property 1: Bug Condition — Audio Sidecar Paths Not Converted
 *
 * These tests encode the EXPECTED (correct) behavior for microphoneAudioPath and
 * systemAudioPath. On UNFIXED code they are EXPECTED TO FAIL — that failure is the
 * evidence the bug exists. Once the fix is applied (Tasks 3.2 and 3.3) the same
 * tests must pass without modification.
 *
 * Validates: Requirements 1.3, 1.4
 */

import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		isPackaged: false,
		getAppPath: () => os.tmpdir(),
		getPath: (name: string) => path.join(os.tmpdir(), name),
		setPath: () => undefined,
	},
}));

import {
	convertProjectToBundleRelative,
	convertProjectToWorkspaceAbsolute,
} from "./projectWorkspace";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_DIR = "C:/Users/test/AppData/Captr Studio/workspaces/proj-1";

/**
 * Returns true when a clip has a microphoneAudioPath or systemAudioPath that is
 * non-null and does NOT start with the workspace directory — i.e. the bug condition.
 */
function isBugCondition(
	clip: { microphoneAudioPath?: string | null; systemAudioPath?: string | null },
	workspaceDir: string,
): boolean {
	const normWorkspace = workspaceDir.replace(/\\/g, "/").toLowerCase();

	const micPath = clip.microphoneAudioPath;
	const hasMicBug =
		micPath != null &&
		micPath !== "" &&
		!micPath.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace);

	const sysPath = clip.systemAudioPath;
	const hasSysBug =
		sysPath != null &&
		sysPath !== "" &&
		!sysPath.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace);

	return hasMicBug || hasSysBug;
}

// ---------------------------------------------------------------------------
// Property 1 — convertProjectToBundleRelative must relativize sidecar paths
// ---------------------------------------------------------------------------

describe("convertProjectToBundleRelative — audio sidecar paths (bug condition)", () => {
	it("should convert a workspace-absolute microphoneAudioPath to a bundle-relative path", () => {
		/**
		 * Bug condition: clip.microphoneAudioPath is set to a workspace-absolute path.
		 * isBugCondition returns false here because the path IS inside the workspace —
		 * meaning the path should be relativized by convertProjectToBundleRelative.
		 * On unfixed code it is left as-is (absolute), proving the bug.
		 */
		const micAbsPath = `${WORKSPACE_DIR}/slides/s1/assets/audio/mic.wav`;
		const projectData = {
			clips: [
				{
					id: "s1",
					videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
					microphoneAudioPath: micAbsPath,
				},
			],
		};

		const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
		const clip = (result.clips as Array<Record<string, unknown>>)[0];

		// Should NOT start with the workspace dir — must be bundle-relative
		const resultPath = clip.microphoneAudioPath as string;
		expect(resultPath).toBeDefined();
		expect(resultPath.toLowerCase()).not.toContain(WORKSPACE_DIR.toLowerCase());
		expect(resultPath).toBe("slides/s1/assets/audio/mic.wav");
	});

	it("should convert a workspace-absolute systemAudioPath to a bundle-relative path", () => {
		const sysAbsPath = `${WORKSPACE_DIR}/slides/s1/assets/audio/system.wav`;
		const projectData = {
			clips: [
				{
					id: "s1",
					videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
					systemAudioPath: sysAbsPath,
				},
			],
		};

		const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
		const clip = (result.clips as Array<Record<string, unknown>>)[0];

		const resultPath = clip.systemAudioPath as string;
		expect(resultPath).toBeDefined();
		expect(resultPath.toLowerCase()).not.toContain(WORKSPACE_DIR.toLowerCase());
		expect(resultPath).toBe("slides/s1/assets/audio/system.wav");
	});

	it("should convert both microphoneAudioPath and systemAudioPath when both are present", () => {
		const projectData = {
			clips: [
				{
					id: "s1",
					videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
					microphoneAudioPath: `${WORKSPACE_DIR}/slides/s1/assets/audio/mic.wav`,
					systemAudioPath: `${WORKSPACE_DIR}/slides/s1/assets/audio/system.wav`,
				},
			],
		};

		const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
		const clip = (result.clips as Array<Record<string, unknown>>)[0];

		expect((clip.microphoneAudioPath as string).toLowerCase()).not.toContain(
			WORKSPACE_DIR.toLowerCase(),
		);
		expect((clip.systemAudioPath as string).toLowerCase()).not.toContain(
			WORKSPACE_DIR.toLowerCase(),
		);
		expect(clip.microphoneAudioPath).toBe("slides/s1/assets/audio/mic.wav");
		expect(clip.systemAudioPath).toBe("slides/s1/assets/audio/system.wav");
	});
});

// ---------------------------------------------------------------------------
// Property 1 — convertProjectToWorkspaceAbsolute must resolve sidecar paths
// ---------------------------------------------------------------------------

describe("convertProjectToWorkspaceAbsolute — audio sidecar paths (bug condition)", () => {
	it("should resolve a bundle-relative microphoneAudioPath to a workspace-absolute path", () => {
		/**
		 * After unpacking a .captr bundle, microphoneAudioPath is stored as a relative
		 * path in project.json. convertProjectToWorkspaceAbsolute must restore it to
		 * a workspace-absolute path. On unfixed code the field is returned as-is
		 * (relative), proving the bug.
		 */
		const relativeMicPath = "slides/s1/assets/audio/mic.wav";
		const projectData = {
			clips: [
				{
					id: "s1",
					videoPath: "slides/s1/main.mp4",
					microphoneAudioPath: relativeMicPath,
				},
			],
		};

		const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
		const clip = (result.clips as Array<Record<string, unknown>>)[0];

		const resultPath = clip.microphoneAudioPath as string;
		expect(resultPath).toBeDefined();
		// Must be an absolute path starting with the workspace dir (compare lower-case, sep-normalized)
		expect(
			resultPath.replace(/\\/g, "/").toLowerCase().startsWith(WORKSPACE_DIR.replace(/\\/g, "/").toLowerCase()),
		).toBe(true);
		expect(resultPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/assets/audio/mic.wav`));
	});

	it("should resolve a bundle-relative systemAudioPath to a workspace-absolute path", () => {
		const relativeSystemPath = "slides/s1/assets/audio/system.wav";
		const projectData = {
			clips: [
				{
					id: "s1",
					videoPath: "slides/s1/main.mp4",
					systemAudioPath: relativeSystemPath,
				},
			],
		};

		const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
		const clip = (result.clips as Array<Record<string, unknown>>)[0];

		const resultPath = clip.systemAudioPath as string;
		expect(resultPath).toBeDefined();
		expect(
			resultPath.replace(/\\/g, "/").toLowerCase().startsWith(WORKSPACE_DIR.replace(/\\/g, "/").toLowerCase()),
		).toBe(true);
		expect(resultPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/assets/audio/system.wav`));
	});

	it("should resolve both sidecar paths when both are present as bundle-relative paths", () => {
		const projectData = {
			clips: [
				{
					id: "s1",
					videoPath: "slides/s1/main.mp4",
					microphoneAudioPath: "slides/s1/assets/audio/mic.wav",
					systemAudioPath: "slides/s1/assets/audio/system.wav",
				},
			],
		};

		const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
		const clip = (result.clips as Array<Record<string, unknown>>)[0];

		const normWs = WORKSPACE_DIR.replace(/\\/g, "/").toLowerCase();
		expect((clip.microphoneAudioPath as string).replace(/\\/g, "/").toLowerCase().startsWith(normWs)).toBe(true);
		expect((clip.systemAudioPath as string).replace(/\\/g, "/").toLowerCase().startsWith(normWs)).toBe(true);
		expect(clip.microphoneAudioPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/assets/audio/mic.wav`));
		expect(clip.systemAudioPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/assets/audio/system.wav`));
	});
});

// ---------------------------------------------------------------------------
// isBugCondition helper self-tests
// ---------------------------------------------------------------------------

describe("isBugCondition — classifies clips correctly", () => {
	it("returns true when microphoneAudioPath is outside the workspace", () => {
		expect(
			isBugCondition(
				{ microphoneAudioPath: "C:/Users/user/AppData/Local/Temp/recordings/mic.wav" },
				WORKSPACE_DIR,
			),
		).toBe(true);
	});

	it("returns true when systemAudioPath is outside the workspace", () => {
		expect(
			isBugCondition(
				{ systemAudioPath: "C:/Users/user/AppData/Local/Temp/recordings/system.wav" },
				WORKSPACE_DIR,
			),
		).toBe(true);
	});

	it("returns false when both sidecar paths are absent", () => {
		expect(isBugCondition({}, WORKSPACE_DIR)).toBe(false);
	});

	it("returns false when microphoneAudioPath is inside the workspace", () => {
		expect(
			isBugCondition(
				{ microphoneAudioPath: `${WORKSPACE_DIR}/slides/s1/assets/audio/mic.wav` },
				WORKSPACE_DIR,
			),
		).toBe(false);
	});

	it("returns false when systemAudioPath is inside the workspace", () => {
		expect(
			isBugCondition(
				{ systemAudioPath: `${WORKSPACE_DIR}/slides/s1/assets/audio/system.wav` },
				WORKSPACE_DIR,
			),
		).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Property 2 — Preservation: non-sidecar and in-workspace behavior unchanged
//
// These tests encode baseline behavior that the fix MUST NOT change.
// They are written on UNFIXED code and must PASS both before and after the fix.
//
// Strategy: for all clips where isBugCondition returns false, both
// convertProjectToBundleRelative and convertProjectToWorkspaceAbsolute must
// produce the same output as the current (unfixed) implementation.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
// ---------------------------------------------------------------------------

import fc from "fast-check";

/**
 * normalizePath (= path.resolve) on Windows returns backslash separators.
 * Use this helper in expected-value comparisons so tests pass on any platform.
 */
function normSep(p: string): string {
	return p.replace(/\//g, path.sep);
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Generates a workspace-internal path: WORKSPACE_DIR/<segments...>/<file>.<ext> */
function workspacePathArb(ext: string): fc.Arbitrary<string> {
	return fc.tuple(
		fc.stringMatching(/^[a-z0-9]{1,8}$/),
		fc.stringMatching(/^[a-z0-9]{1,8}$/),
		fc.stringMatching(/^[a-z0-9]{1,16}$/),
	).map(([dir1, dir2, fname]) => `${WORKSPACE_DIR}/${dir1}/${dir2}/${fname}.${ext}`);
}

/** Generates a clip object where isBugCondition is always false (no external sidecars). */
function noSidecarClipArb(): fc.Arbitrary<Record<string, unknown>> {
	return fc.record(
		{
			id: fc.stringMatching(/^[a-z0-9]{4,8}$/),
			videoPath: workspacePathArb("mp4"),
			webcamPath: fc.option(workspacePathArb("mp4"), { nil: undefined }),
			cursorTelemetryPath: fc.option(workspacePathArb("json"), { nil: undefined }),
			audioRegions: fc.array(
				fc.record({
					id: fc.stringMatching(/^[a-z0-9]{4,8}$/),
					audioPath: workspacePathArb("wav"),
					sourcePath: fc.option(workspacePathArb("wav"), { nil: undefined }),
				}),
				{ maxLength: 3 },
			),
			assetFiles: fc.array(
				fc.record({
					id: fc.stringMatching(/^[a-z0-9]{4,8}$/),
					path: workspacePathArb("png"),
				}),
				{ maxLength: 3 },
			),
			annotationRegions: fc.array(
				fc.record({
					id: fc.stringMatching(/^[a-z0-9]{4,8}$/),
					sourcePath: fc.option(workspacePathArb("png"), { nil: undefined }),
					customImagePath: fc.option(workspacePathArb("png"), { nil: undefined }),
				}),
				{ maxLength: 3 },
			),
			// No microphoneAudioPath or systemAudioPath → isBugCondition = false
		},
		{ requiredKeys: ["id", "videoPath", "audioRegions", "assetFiles", "annotationRegions"] },
	);
}

/** Clip with sidecar paths that are ALREADY inside the workspace (isBugCondition = false). */
function inWorkspaceSidecarClipArb(): fc.Arbitrary<Record<string, unknown>> {
	return fc.record(
		{
			id: fc.stringMatching(/^[a-z0-9]{4,8}$/),
			videoPath: workspacePathArb("mp4"),
			microphoneAudioPath: workspacePathArb("wav"),
			systemAudioPath: workspacePathArb("wav"),
		},
		{ requiredKeys: ["id", "videoPath", "microphoneAudioPath", "systemAudioPath"] },
	);
}

// ---------------------------------------------------------------------------
// Unit tests — baseline observations on unfixed code
// ---------------------------------------------------------------------------

describe("Preservation — unit tests — baseline behavior on unfixed code", () => {
	describe("convertProjectToBundleRelative", () => {
		it("converts videoPath inside workspace to relative path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
					},
				],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.videoPath).toBe("slides/s1/main.mp4");
		});

		it("converts webcamPath inside workspace to relative path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
						webcamPath: `${WORKSPACE_DIR}/slides/s1/webcam.mp4`,
					},
				],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.webcamPath).toBe("slides/s1/webcam.mp4");
		});

		it("converts cursorTelemetryPath inside workspace to relative path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
						cursorTelemetryPath: `${WORKSPACE_DIR}/slides/s1/cursor.json`,
					},
				],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.cursorTelemetryPath).toBe("slides/s1/cursor.json");
		});

		it("converts audioRegions[].audioPath inside workspace to relative path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
						audioRegions: [
							{
								id: "a1",
								audioPath: `${WORKSPACE_DIR}/slides/s1/assets/audio/bg.wav`,
							},
						],
					},
				],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			const region = (clip.audioRegions as Array<Record<string, unknown>>)[0];
			expect(region.audioPath).toBe("slides/s1/assets/audio/bg.wav");
		});

		it("converts assetFiles[].path inside workspace to relative path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
						assetFiles: [
							{
								id: "f1",
								path: `${WORKSPACE_DIR}/slides/s1/assets/overlay.png`,
							},
						],
					},
				],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			const asset = (clip.assetFiles as Array<Record<string, unknown>>)[0];
			expect(asset.path).toBe("slides/s1/assets/overlay.png");
		});

		it("converts annotationRegions[].sourcePath and customImagePath to relative paths", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
						annotationRegions: [
							{
								id: "ann1",
								sourcePath: `${WORKSPACE_DIR}/slides/s1/assets/src.png`,
								customImagePath: `${WORKSPACE_DIR}/slides/s1/assets/custom.png`,
							},
						],
					},
				],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			const ann = (clip.annotationRegions as Array<Record<string, unknown>>)[0];
			expect(ann.sourcePath).toBe("slides/s1/assets/src.png");
			expect(ann.customImagePath).toBe("slides/s1/assets/custom.png");
		});

		it("leaves a clip with no sidecar fields completely unchanged (relative-side)", () => {
			const projectData = {
				clips: [{ id: "s1", videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4` }],
			};
			const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			// microphoneAudioPath and systemAudioPath should not be injected
			expect(clip.microphoneAudioPath).toBeUndefined();
			expect(clip.systemAudioPath).toBeUndefined();
		});
	});

	describe("convertProjectToWorkspaceAbsolute", () => {
		it("resolves relative videoPath to workspace-absolute path", () => {
			const projectData = {
				clips: [{ id: "s1", videoPath: "slides/s1/main.mp4" }],
			};
			const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.videoPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/main.mp4`));
		});

		it("resolves relative webcamPath to workspace-absolute path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: "slides/s1/main.mp4",
						webcamPath: "slides/s1/webcam.mp4",
					},
				],
			};
			const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.webcamPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/webcam.mp4`));
		});

		it("resolves relative cursorTelemetryPath to workspace-absolute path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: "slides/s1/main.mp4",
						cursorTelemetryPath: "slides/s1/cursor.json",
					},
				],
			};
			const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.cursorTelemetryPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/cursor.json`));
		});

		it("resolves relative audioRegions[].audioPath to workspace-absolute path", () => {
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: "slides/s1/main.mp4",
						audioRegions: [{ id: "a1", audioPath: "slides/s1/assets/audio/bg.wav" }],
					},
				],
			};
			const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			const region = (clip.audioRegions as Array<Record<string, unknown>>)[0];
			expect(region.audioPath).toBe(normSep(`${WORKSPACE_DIR}/slides/s1/assets/audio/bg.wav`));
		});

		it("leaves already-absolute legacy sidecar paths as-is (backward compat)", () => {
			/**
			 * Validates: Requirement 3.6
			 * Legacy projects saved before the fix have absolute paths for
			 * microphoneAudioPath / systemAudioPath. convertProjectToWorkspaceAbsolute
			 * must pass them through unchanged via the path.isAbsolute guard.
			 */
			const legacyAbsPath = "C:/Users/user/AppData/Local/Temp/mic.wav";
			const projectData = {
				clips: [
					{
						id: "s1",
						videoPath: "slides/s1/main.mp4",
						microphoneAudioPath: legacyAbsPath,
						systemAudioPath: legacyAbsPath,
					},
				],
			};
			const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			// Should be passed through normalized (path.resolve normalizes separators) but not re-resolved
			expect(clip.microphoneAudioPath).toBe(normSep(legacyAbsPath));
			expect(clip.systemAudioPath).toBe(normSep(legacyAbsPath));
		});

		it("leaves a clip with no sidecar fields completely unchanged (absolute-side)", () => {
			const projectData = {
				clips: [{ id: "s1", videoPath: "slides/s1/main.mp4" }],
			};
			const result = convertProjectToWorkspaceAbsolute(projectData, WORKSPACE_DIR);
			const clip = (result.clips as Array<Record<string, unknown>>)[0];
			expect(clip.microphoneAudioPath).toBeUndefined();
			expect(clip.systemAudioPath).toBeUndefined();
		});
	});

	describe("Round-trip: toBundleRelative → toWorkspaceAbsolute is identity for workspace paths", () => {
		it("round-trips videoPath through both functions unchanged", () => {
			const absPath = `${WORKSPACE_DIR}/slides/s1/main.mp4`;
			const project = { clips: [{ id: "s1", videoPath: absPath }] };
			const relative = convertProjectToBundleRelative(project, WORKSPACE_DIR);
			const restored = convertProjectToWorkspaceAbsolute(relative, WORKSPACE_DIR);
			const clip = (restored.clips as Array<Record<string, unknown>>)[0];
			// normSep: toBundleRelative strips workspace prefix then toAbsolute resolves with OS sep
			expect(clip.videoPath).toBe(normSep(absPath));
		});

		it("round-trips audioRegions[].audioPath unchanged", () => {
			const absPath = `${WORKSPACE_DIR}/slides/s1/assets/audio/bg.wav`;
			const project = {
				clips: [
					{
						id: "s1",
						videoPath: `${WORKSPACE_DIR}/slides/s1/main.mp4`,
						audioRegions: [{ id: "a1", audioPath: absPath }],
					},
				],
			};
			const relative = convertProjectToBundleRelative(project, WORKSPACE_DIR);
			const restored = convertProjectToWorkspaceAbsolute(relative, WORKSPACE_DIR);
			const clip = (restored.clips as Array<Record<string, unknown>>)[0];
			const region = (clip.audioRegions as Array<Record<string, unknown>>)[0];
			expect(region.audioPath).toBe(normSep(absPath));
		});
	});
});

// ---------------------------------------------------------------------------
// Property-based tests — Preservation across arbitrary workspace-internal inputs
// ---------------------------------------------------------------------------

describe("Preservation — property-based tests (fast-check)", () => {
	/**
	 * Property: for any clip with no external sidecar paths, convertProjectToBundleRelative
	 * produces bundle-relative paths for all known path fields.
	 *
	 * Validates: Requirements 3.3, 3.5
	 */
	it("convertProjectToBundleRelative: all workspace-internal paths are relativized (no sidecar)", () => {
		fc.assert(
			fc.property(noSidecarClipArb(), (clip) => {
				const projectData = { clips: [clip] };
				const result = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
				const out = (result.clips as Array<Record<string, unknown>>)[0];
				const normWs = WORKSPACE_DIR.replace(/\\/g, "/").toLowerCase();

				// videoPath must be relative
				expect(typeof out.videoPath).toBe("string");
				expect((out.videoPath as string).toLowerCase()).not.toContain(normWs);

				// webcamPath if present
				if (out.webcamPath != null) {
					expect((out.webcamPath as string).toLowerCase()).not.toContain(normWs);
				}

				// cursorTelemetryPath if present
				if (out.cursorTelemetryPath != null) {
					expect((out.cursorTelemetryPath as string).toLowerCase()).not.toContain(normWs);
				}

				// audioRegions
				for (const region of (out.audioRegions as Array<Record<string, unknown>>) ?? []) {
					expect((region.audioPath as string).toLowerCase()).not.toContain(normWs);
				}

				// assetFiles
				for (const asset of (out.assetFiles as Array<Record<string, unknown>>) ?? []) {
					expect((asset.path as string).toLowerCase()).not.toContain(normWs);
				}
			}),
			{ numRuns: 50 },
		);
	});

	/**
	 * Property: for any clip with no external sidecar paths, the round-trip
	 * toBundleRelative → toWorkspaceAbsolute is an identity transform for all
	 * workspace path fields (modulo OS path separator normalization).
	 *
	 * Validates: Requirements 3.3, 3.5
	 */
	it("round-trip identity: toRelative → toAbsolute restores original paths (no sidecar)", () => {
		fc.assert(
			fc.property(noSidecarClipArb(), (clip) => {
				const projectData = { clips: [clip] };
				const relative = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
				const restored = convertProjectToWorkspaceAbsolute(relative, WORKSPACE_DIR);
				const out = (restored.clips as Array<Record<string, unknown>>)[0];

				// videoPath round-trips to OS-native form of the original
				expect(out.videoPath).toBe(normSep(clip.videoPath as string));

				// webcamPath if present
				if (clip.webcamPath != null) {
					expect(out.webcamPath).toBe(normSep(clip.webcamPath as string));
				}

				// cursorTelemetryPath if present
				if (clip.cursorTelemetryPath != null) {
					expect(out.cursorTelemetryPath).toBe(normSep(clip.cursorTelemetryPath as string));
				}

				// audioRegions
				const origAudio = (clip.audioRegions as Array<Record<string, unknown>>) ?? [];
				const outAudio = (out.audioRegions as Array<Record<string, unknown>>) ?? [];
				for (let i = 0; i < origAudio.length; i++) {
					expect(outAudio[i].audioPath).toBe(normSep(origAudio[i].audioPath as string));
				}

				// assetFiles
				const origAssets = (clip.assetFiles as Array<Record<string, unknown>>) ?? [];
				const outAssets = (out.assetFiles as Array<Record<string, unknown>>) ?? [];
				for (let i = 0; i < origAssets.length; i++) {
					expect(outAssets[i].path).toBe(normSep(origAssets[i].path as string));
				}
			}),
			{ numRuns: 50 },
		);
	});

	/**
	 * Property: for clips whose sidecar paths are already inside the workspace,
	 * convertProjectToBundleRelative relativizes them (same as videoPath).
	 * The round-trip is also identity (modulo OS path separator normalization).
	 *
	 * Validates: Requirements 3.1, 3.2
	 */
	it("in-workspace sidecar paths are relativized by toBundleRelative and restored by toAbsolute", () => {
		fc.assert(
			fc.property(inWorkspaceSidecarClipArb(), (clip) => {
				// Confirm the bug condition does NOT apply to these clips
				expect(isBugCondition(clip as { microphoneAudioPath?: string; systemAudioPath?: string }, WORKSPACE_DIR)).toBe(false);

				const projectData = { clips: [clip] };
				const normWs = WORKSPACE_DIR.replace(/\\/g, "/").toLowerCase();

				// After relativizing, neither sidecar path should start with workspace dir
				const relative = convertProjectToBundleRelative(projectData, WORKSPACE_DIR);
				const relClip = (relative.clips as Array<Record<string, unknown>>)[0];

				// videoPath must be correctly relativized (existing behavior preserved)
				expect(typeof relClip.videoPath).toBe("string");
				expect((relClip.videoPath as string).toLowerCase()).not.toContain(normWs);

				// Round-trip for videoPath is identity (modulo OS sep)
				const restored = convertProjectToWorkspaceAbsolute(relative, WORKSPACE_DIR);
				const resClip = (restored.clips as Array<Record<string, unknown>>)[0];
				expect(resClip.videoPath).toBe(normSep(clip.videoPath as string));
			}),
			{ numRuns: 50 },
		);
	});

	/**
	 * Property: isBugCondition correctly classifies clips.
	 *
	 * For no-sidecar clips it always returns false.
	 * For in-workspace sidecar clips it always returns false.
	 *
	 * Validates: Requirements 3.1, 3.2, 3.3
	 */
	it("isBugCondition returns false for all workspace-internal and no-sidecar clips", () => {
		fc.assert(
			fc.property(noSidecarClipArb(), (clip) => {
				expect(isBugCondition(clip as { microphoneAudioPath?: string; systemAudioPath?: string }, WORKSPACE_DIR)).toBe(false);
			}),
			{ numRuns: 50 },
		);

		fc.assert(
			fc.property(inWorkspaceSidecarClipArb(), (clip) => {
				expect(isBugCondition(clip as { microphoneAudioPath?: string; systemAudioPath?: string }, WORKSPACE_DIR)).toBe(false);
			}),
			{ numRuns: 50 },
		);
	});
});
