vi.mock("@/components/settings/AppSettingsDialog", () => ({ AppSettingsDialog: () => null }));

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("./ProjectEditor", () => ({
	ProjectEditor: () => React.createElement("div", null, "hidden editor"),
}));
vi.mock("@/components/welcome/WelcomeScreen", () => ({
	WelcomeScreen: (props: { onOpenLoopBackgroundStudio?: () => void }) =>
		React.createElement(
			"main",
			{
				"data-loop-studio-action": props.onOpenLoopBackgroundStudio
					? "available"
					: "missing",
			},
			"Project Home",
		),
}));

import { ProjectApplication } from "./ProjectApplication";

it("renders Home without constructing or activating a hidden project", () => {
	const activate = vi.fn();
	vi.stubGlobal("window", { electronAPI: { activateTimelineProject: activate } });
	const html = renderToStaticMarkup(<ProjectApplication />);
	expect(html).toContain("Project Home");
	expect(html).toContain('data-loop-studio-action="available"');
	expect(html).not.toContain("hidden editor");
	expect(activate).not.toHaveBeenCalled();
	vi.unstubAllGlobals();
});
