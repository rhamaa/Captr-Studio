export type HomeTool = "loop-background-studio" | null;
export type ApplicationSurface = "project" | "home" | Exclude<HomeTool, null>;

export type HomeToolNavigationAction =
	| { type: "open-loop-background-studio" }
	| { type: "back-to-home" };

export function homeToolNavigationReducer(
	_current: HomeTool,
	action: HomeToolNavigationAction,
): HomeTool {
	return action.type === "open-loop-background-studio" ? "loop-background-studio" : null;
}

export function getApplicationSurface(
	hasProjectController: boolean,
	homeTool: HomeTool,
): ApplicationSurface {
	if (hasProjectController) return "project";
	return homeTool ?? "home";
}
