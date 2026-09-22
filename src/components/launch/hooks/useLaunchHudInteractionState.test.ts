import { afterEach, expect, it, vi } from "vitest";

const effects = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock("react", () => ({
	useRef: (current: unknown) => ({ current }),
	useCallback: (callback: unknown) => callback,
	useEffect: (effect: () => unknown) => effects.push(effect),
}));

import { useLaunchHudInteractionState } from "./useLaunchHudInteractionState";

afterEach(() => {
	effects.length = 0;
	vi.useRealTimers();
	vi.unstubAllGlobals();
});
it("does not enable click-through when a popover close timer fires during a drag", () => {
	vi.useFakeTimers();
	const ignore = vi.fn();
	vi.stubGlobal("window", { electronAPI: { hudOverlaySetIgnoreMouse: ignore } });
	const dragging = { current: false };
	useLaunchHudInteractionState({
		openId: null,
		isHudDraggingRef: dragging,
		isWebcamPreviewDraggingRef: { current: false },
		webcamPreviewDragStartRef: { current: null },
	});
	const cleanup = effects[0]() as () => void;
	dragging.current = true;
	vi.advanceTimersByTime(200);
	expect(ignore).not.toHaveBeenCalledWith(true);
	cleanup();
});
