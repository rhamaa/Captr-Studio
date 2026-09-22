import { registerProjectFilesystemHandlers } from "./filesystem";
import { registerProjectLoadHandlers } from "./load";
import { registerProjectMediaHandlers } from "./media";
import { registerProjectSaveHandlers } from "./save";
import { registerProjectSessionHandlers } from "./session";

/**
 * Registers every project-domain IPC handler.
 * Handlers are grouped by concern: filesystem, save, load/library,
 * recording session state, and media resolution.
 */
export function registerProjectHandlers() {
	registerProjectFilesystemHandlers();
	registerProjectSaveHandlers();
	registerProjectLoadHandlers();
	registerProjectMediaHandlers();
	registerProjectSessionHandlers();
}
