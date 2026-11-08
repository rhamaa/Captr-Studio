export const TELEPROMPTER_MIN_WPM = 60;
export const TELEPROMPTER_MAX_WPM = 300;
export const TELEPROMPTER_WPM_STEP = 10;
export const TELEPROMPTER_DEFAULT_WPM = 140;

export interface TeleprompterState {
	status: "idle" | "running" | "paused" | "done";
	offsetPx: number;
	wpm: number;
}

export interface TeleprompterMetrics {
	/** Average words on one rendered line. */
	wordsPerLine: number;
	lineHeightPx: number;
	/** Scroll distance at which the last line reaches the reading marker. */
	maxOffsetPx: number;
}

export type TeleprompterAction =
	| { type: "start" }
	| { type: "pause" }
	| { type: "resume" }
	| { type: "toggle" }
	| { type: "faster" }
	| { type: "slower" }
	| { type: "setWpm"; wpm: number }
	| { type: "reset" };

const clampWpm = (wpm: number) =>
	Math.min(TELEPROMPTER_MAX_WPM, Math.max(TELEPROMPTER_MIN_WPM, Math.round(wpm)));

export function createTeleprompterState(wpm = TELEPROMPTER_DEFAULT_WPM): TeleprompterState {
	return { status: "idle", offsetPx: 0, wpm: clampWpm(wpm) };
}

export function teleprompterReducer(
	state: TeleprompterState,
	action: TeleprompterAction,
): TeleprompterState {
	switch (action.type) {
		case "start":
			return { ...state, status: "running", offsetPx: 0 };
		case "pause":
			return state.status === "running" ? { ...state, status: "paused" } : state;
		case "resume":
			return state.status === "paused" ? { ...state, status: "running" } : state;
		case "toggle":
			if (state.status === "running") return { ...state, status: "paused" };
			if (state.status === "paused") return { ...state, status: "running" };
			return state;
		case "faster":
			return { ...state, wpm: clampWpm(state.wpm + TELEPROMPTER_WPM_STEP) };
		case "slower":
			return { ...state, wpm: clampWpm(state.wpm - TELEPROMPTER_WPM_STEP) };
		case "setWpm":
			return { ...state, wpm: clampWpm(action.wpm) };
		case "reset":
			return { ...state, status: "idle", offsetPx: 0 };
	}
}

/** Advances the scroll by `dtMs` at the current words-per-minute speed. */
export function tickTeleprompter(
	state: TeleprompterState,
	dtMs: number,
	metrics: TeleprompterMetrics,
): TeleprompterState {
	if (state.status !== "running" || !(dtMs > 0)) return state;
	if (!(metrics.wordsPerLine > 0) || !(metrics.lineHeightPx > 0)) return state;
	const pxPerMs = ((state.wpm / metrics.wordsPerLine) * metrics.lineHeightPx) / 60_000;
	const max = Math.max(0, metrics.maxOffsetPx);
	const offsetPx = Math.min(max, state.offsetPx + pxPerMs * dtMs);
	return offsetPx >= max ? { ...state, offsetPx: max, status: "done" } : { ...state, offsetPx };
}
