import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/components/editor/useProjectMessages", () => ({
	useProjectMessages: () => (key: string) => key,
}));
vi.mock("@/contexts/I18nContext", () => ({
	useScopedT: () => (_key: string, fallback?: string) => fallback ?? _key,
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
	expect(empty).toContain("inspectProject");
	expect(empty).not.toContain("Record screen");
	expect(renderToStaticMarkup(<WelcomeScreen {...props} loading />)).toContain('role="status"');
	expect(renderToStaticMarkup(<WelcomeScreen {...props} error="Directory denied" />)).toContain(
		"Directory denied",
	);
});

it("Home does not expose the former background generator mini-app", () => {
	const formerToolAction = { onOpenBackgroundGenerator: () => {} };
	const html = renderToStaticMarkup(<WelcomeScreen {...props} {...formerToolAction} />);
	expect(html).not.toContain("Loop Background Studio");
	expect(html).not.toContain("Create seamless animated GIF backgrounds");
});
