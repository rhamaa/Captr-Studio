import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/components/editor/useProjectMessages", () => ({
	useProjectMessages: () => (key: string) => key,
}));
import { WelcomeScreen } from "./WelcomeScreen";
const props = {
	recentProjects: [],
	onNewProject: () => {},
	onOpenProjectFile: () => {},
	onOpenRecentProject: () => {},
};
it("Home exposes New Open Refresh but no recorder and distinct states", () => {
	const empty = renderToStaticMarkup(<WelcomeScreen {...props} />);
	expect(empty).toContain("emptyProjects");
	expect(empty).not.toContain("Record screen");
	expect(renderToStaticMarkup(<WelcomeScreen {...props} loading />)).toContain('role="status"');
	expect(renderToStaticMarkup(<WelcomeScreen {...props} error="Directory denied" />)).toContain(
		"Directory denied",
	);
});
