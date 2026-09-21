/**
 * Tests — Self-Contained .captr Bundle Validation
 *
 * Guarantee under test: a .captr file must carry the ENTIRE project (media +
 * editing state) so moving the single file to another device opens and resumes
 * without issues.
 *
 * `assertProjectMediaInsideBundle` throws `ProjectBundleValidationError` when a
 * referenced media file is missing from the workspace (unpacked bundle) or
 * points outside it — the "exception" for non-conforming .captr files.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		isPackaged: false,
		getAppPath: () => os.tmpdir(),
		getPath: (name: string) => path.join(os.tmpdir(), name),
		setPath: () => undefined,
	},
}));

import {
	assertProjectMediaInsideBundle,
	findProjectMediaIssues,
	ProjectBundleValidationError,
} from "./mediaReferences";
import {
	convertProjectToBundleRelative,
	convertProjectToWorkspaceAbsolute,
} from "./projectWorkspace";

let workspaceDir: string;

async function writeWorkspaceFile(name: string, contents = "media") {
	const filePath = path.join(workspaceDir, name);
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, contents);
	return filePath;
}

beforeEach(async () => {
	const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "captr-media-validation-"));
	workspaceDir = path.join(tempRoot, "workspaces", "proj-1");
	await fs.mkdir(workspaceDir, { recursive: true });
});

afterEach(async () => {
	await fs.rm(path.dirname(workspaceDir), { recursive: true, force: true }).catch(
		() => undefined,
	);
});

describe("findProjectMediaIssues / assertProjectMediaInsideBundle", () => {
	it("passes when every referenced media file lives inside the workspace", async () => {
		await writeWorkspaceFile("slides/clip-1/main.mp4");
		await writeWorkspaceFile("slides/clip-1/webcam.mp4");
		await writeWorkspaceFile("slides/clip-1/main.mic.wav");

		const project = {
			videoPath: "slides/clip-1/main.mp4",
			clips: [
				{
					id: "clip-1",
					videoPath: "slides/clip-1/main.mp4",
					webcamPath: "slides/clip-1/webcam.mp4",
					microphoneAudioPath: "slides/clip-1/main.mic.wav",
				},
			],
		};

		await expect(findProjectMediaIssues(project, workspaceDir)).resolves.toEqual([]);
		await expect(assertProjectMediaInsideBundle(project, workspaceDir)).resolves.toBeUndefined();
	});

	it("reports a missing bundle file with its exact location", async () => {
		const project = {
			clips: [
				{
					id: "clip-1",
					videoPath: "slides/clip-1/main.mp4",
					microphoneAudioPath: "slides/clip-1/main.mic.wav",
				},
			],
		};
		await writeWorkspaceFile("slides/clip-1/main.mp4");

		const issues = await findProjectMediaIssues(project, workspaceDir);
		expect(issues).toEqual([
			{
				location: "clips[0].microphoneAudioPath",
				path: "slides/clip-1/main.mic.wav",
				reason: "missing",
			},
		]);

		await expect(assertProjectMediaInsideBundle(project, workspaceDir)).rejects.toThrow(
			ProjectBundleValidationError,
		);
		await expect(assertProjectMediaInsideBundle(project, workspaceDir)).rejects.toThrow(
			/clips\[0\]\.microphoneAudioPath/,
		);
		await expect(assertProjectMediaInsideBundle(project, workspaceDir)).rejects.toThrow(
			/missing from bundle/,
		);
	});

	it("flags absolute paths that point outside the workspace (not portable)", async () => {
		const externalVideo = path.join(
			await fs.mkdtemp(path.join(os.tmpdir(), "captr-external-")),
			"clip.mp4",
		);
		await fs.writeFile(externalVideo, "video");

		const project = { clips: [{ id: "clip-1", videoPath: externalVideo }] };

		const issues = await findProjectMediaIssues(project, workspaceDir);
		expect(issues).toEqual([
			{
				location: "clips[0].videoPath",
				path: externalVideo,
				reason: "outside-bundle",
			},
		]);

		await fs.rm(path.dirname(externalVideo), { recursive: true, force: true }).catch(
			() => undefined,
		);
	});

	it("ignores data and http URLs (not filesystem media)", async () => {
		const project = {
			clips: [
				{
					id: "clip-1",
					videoPath: "https://example.com/movie.mp4",
					webcam: { sourcePath: "data:image/png;base64,AAAA" },
				},
			],
		};

		await expect(findProjectMediaIssues(project, workspaceDir)).resolves.toEqual([]);
	});
});


describe("extended media field coverage", () => {
	it("validates webcam.sourcePath, mediaTrackLayers, audioTracks and annotation media", async () => {
		await writeWorkspaceFile("slides/clip-1/webcam/custom.mp4");
		await writeWorkspaceFile("slides/clip-1/layers/overlay.png");
		await writeWorkspaceFile("slides/clip-1/audio/track.wav");
		await writeWorkspaceFile("slides/clip-1/assets/arrow.gif");

		const project = {
			editor: {
				webcam: { sourcePath: "slides/clip-1/webcam/custom.mp4" },
			},
			clips: [
				{
					id: "clip-1",
					webcam: { sourcePath: "slides/clip-1/webcam/custom.mp4" },
					mediaTrackLayers: [{ id: "l1", sourcePath: "slides/clip-1/layers/overlay.png" }],
					audioTracks: [{ id: "t1", sourcePath: "slides/clip-1/audio/track.wav" }],
					annotationRegions: [
						{
							id: "a1",
							gifPath: "slides/clip-1/assets/arrow.gif",
							imageFilePath: "slides/clip-1/layers/missing-image.png",
						},
					],
				},
			],
		};

		const issues = await findProjectMediaIssues(project, workspaceDir);
		expect(issues).toEqual([
			{
				location: "clips[0].annotationRegions[].imageFilePath",
				path: "slides/clip-1/layers/missing-image.png",
				reason: "missing",
			},
		]);
	});

	it("round-trips the newly covered fields through bundle-relative serialization", () => {
		const absoluteWebcam = path.join(workspaceDir, "slides", "clip-1", "webcam", "custom.mp4");
		const absoluteLayer = path.join(workspaceDir, "slides", "clip-1", "layers", "overlay.png");
		const absoluteTrack = path.join(workspaceDir, "slides", "clip-1", "audio", "track.wav");

		const project = {
			editor: { webcam: { sourcePath: absoluteWebcam } },
			clips: [
				{
					id: "clip-1",
					webcam: { sourcePath: absoluteWebcam },
					mediaTrackLayers: [{ id: "l1", sourcePath: absoluteLayer }],
					audioTracks: [{ id: "t1", sourcePath: absoluteTrack }],
				},
			],
		};

		const relative = convertProjectToBundleRelative(project, workspaceDir);
		expect(relative.editor.webcam.sourcePath).toBe("slides/clip-1/webcam/custom.mp4");
		expect(relative.clips[0].webcam.sourcePath).toBe("slides/clip-1/webcam/custom.mp4");
		expect(relative.clips[0].mediaTrackLayers[0].sourcePath).toBe(
			"slides/clip-1/layers/overlay.png",
		);
		expect(relative.clips[0].audioTracks[0].sourcePath).toBe("slides/clip-1/audio/track.wav");

		const restored = convertProjectToWorkspaceAbsolute(relative, workspaceDir);
		expect(restored.editor.webcam.sourcePath).toBe(path.resolve(absoluteWebcam));
		expect(restored.clips[0].webcam.sourcePath).toBe(path.resolve(absoluteWebcam));
		expect(restored.clips[0].mediaTrackLayers[0].sourcePath).toBe(path.resolve(absoluteLayer));
		expect(restored.clips[0].audioTracks[0].sourcePath).toBe(path.resolve(absoluteTrack));
	});
});
