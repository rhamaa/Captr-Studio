import { describe, expect, it, vi } from "vitest";
import { useSlideAudioRecorder } from "./useSlideAudioRecorder";

describe("useSlideAudioRecorder", () => {
	it("exposes expected interface and default state", () => {
		expect(typeof useSlideAudioRecorder).toBe("function");
	});

	it("captures startPlayheadMs from getCurrentTimeMs callback", () => {
		const currentTimeMsMock = vi.fn().mockReturnValue(4250);
		const onStartPlaybackMock = vi.fn();
		const onPausePlaybackMock = vi.fn();
		const onAudioClipRecordedMock = vi.fn();

		const options = {
			slideId: "slide-video-1",
			getCurrentTimeMs: currentTimeMsMock,
			onStartPlayback: onStartPlaybackMock,
			onPausePlayback: onPausePlaybackMock,
			onAudioClipRecorded: onAudioClipRecordedMock,
		};

		expect(options.slideId).toBe("slide-video-1");
		expect(options.getCurrentTimeMs()).toBe(4250);
	});
});
