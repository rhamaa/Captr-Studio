import { dialog } from "electron";
import { loadProjectFromPath } from "./ipc/project/manager";
import { queueProjectOpen } from "./pendingProjectOpen";

/** Show load failures before a cold-start file association opens the editor. */
export async function openStartupProject(projectPath: string): Promise<void> {
	try {
		const result = await loadProjectFromPath(projectPath);
		if (!result.success) {
			dialog.showErrorBox(
				"Unable to open project",
				result.message ?? "The project could not be opened.",
			);
		} else await queueProjectOpen({ result });
	} catch (error) {
		dialog.showErrorBox(
			"Unable to open project",
			error instanceof Error ? error.message : String(error),
		);
	}
}
