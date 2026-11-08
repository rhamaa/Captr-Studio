import { describe, expect, it } from "vitest";
import {
	createTeleprompterState,
	TELEPROMPTER_DEFAULT_WPM,
	teleprompterReducer,
	tickTeleprompter,
} from "./teleprompterModel";

const metrics = { wordsPerLine: 7, lineHeightPx: 42, maxOffsetPx: 1000 };

describe("teleprompter model", () => {
	it("starts idle at the top with the default speed", () => {
		expect(createTeleprompterState()).toEqual({
			status: "idle",
			offsetPx: 0,
			wpm: TELEPROMPTER_DEFAULT_WPM,
		});
	});

	it("only moves while running", () => {
		const idle = createTeleprompterState(140);
		expect(tickTeleprompter(idle, 1000, metrics).offsetPx).toBe(0);
		const running = teleprompterReducer(idle, { type: "start" });
		// 140 wpm / 7 words per line = 20 lines/min -> 1/3 line per second = 14 px.
		expect(tickTeleprompter(running, 1000, metrics).offsetPx).toBeCloseTo(14);
	});

	it("pauses, resumes and toggles", () => {
		let state = teleprompterReducer(createTeleprompterState(), { type: "start" });
		state = teleprompterReducer(state, { type: "toggle" });
		expect(state.status).toBe("paused");
		expect(tickTeleprompter(state, 5000, metrics).offsetPx).toBe(0);
		state = teleprompterReducer(state, { type: "toggle" });
		expect(state.status).toBe("running");
	});

	it("stops at the end of the script", () => {
		const running = teleprompterReducer(createTeleprompterState(300), { type: "start" });
		const end = tickTeleprompter(running, 10 * 60_000, metrics);
		expect(end).toMatchObject({ offsetPx: 1000, status: "done" });
	});

	it("changes speed in steps and clamps", () => {
		let state = createTeleprompterState(295);
		state = teleprompterReducer(state, { type: "faster" });
		expect(state.wpm).toBe(300);
		state = teleprompterReducer(createTeleprompterState(65), { type: "slower" });
		expect(state.wpm).toBe(60);
		expect(teleprompterReducer(state, { type: "setWpm", wpm: 1000 }).wpm).toBe(300);
	});

	it("reset returns to the top and keeps the speed", () => {
		let state = teleprompterReducer(createTeleprompterState(180), { type: "start" });
		state = tickTeleprompter(state, 3000, metrics);
		state = teleprompterReducer(state, { type: "reset" });
		expect(state).toEqual({ status: "idle", offsetPx: 0, wpm: 180 });
	});

	it("ignores bad metrics and time", () => {
		const running = teleprompterReducer(createTeleprompterState(), { type: "start" });
		expect(tickTeleprompter(running, -50, metrics).offsetPx).toBe(0);
		expect(tickTeleprompter(running, 1000, { ...metrics, wordsPerLine: 0 }).offsetPx).toBe(0);
	});
});
