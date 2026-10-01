import { releaseLegacyProjectCandidate } from "./ipc/project/manager";
import type { PendingProjectOpen } from "../src/components/editor/projectLifecycle";
let pending: PendingProjectOpen | null = null;
/** Warm requests defer loading until the editor has protected its unsaved project. */
export async function queueProjectOpen(next: PendingProjectOpen): Promise<void> {
	const previous = pending;
	pending = next;
	const token = previous?.result?.conversionToken;
	if (token && token !== next.result?.conversionToken) await releaseLegacyProjectCandidate(token);
}
export function consumePendingProjectOpen(): PendingProjectOpen | null {
	const next = pending;
	pending = null;
	return next;
}
