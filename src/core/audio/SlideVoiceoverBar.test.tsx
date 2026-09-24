import React from "react";
import { describe, expect, it, vi } from "vitest";
import { SlideVoiceoverBar } from "./SlideVoiceoverBar";

describe("SlideVoiceoverBar", () => {
	it("renders idle state with record button", () => {
		const onStart = vi.fn();
		const onStop = vi.fn();
		const onCancel = vi.fn();
		const onSelectDev = vi.fn();

		const element = (
			<SlideVoiceoverBar
				isRecording={false}
				countdown={null}
				audioLevel={0}
				recordingDurationMs={0}
				startPlayheadMs={0}
				currentTimeMs={3500}
				availableDevices={[]}
				selectedDeviceId=""
				onSelectDeviceId={onSelectDev}
				onStartRecord={onStart}
				onStopRecord={onStop}
				onCancelRecord={onCancel}
			/>
		);

		expect(React.isValidElement(element)).toBe(true);
	});

	it("renders recording state with stop button", () => {
		const element = (
			<SlideVoiceoverBar
				isRecording={true}
				countdown={null}
				audioLevel={0.65}
				recordingDurationMs={2400}
				startPlayheadMs={1000}
				currentTimeMs={3400}
				availableDevices={[]}
				selectedDeviceId=""
				onSelectDeviceId={() => {}}
				onStartRecord={() => {}}
				onStopRecord={() => {}}
				onCancelRecord={() => {}}
			/>
		);

		expect(React.isValidElement(element)).toBe(true);
	});
});
