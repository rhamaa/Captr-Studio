export interface RetiredSlideIssue {
	id: string | null;
	kind: "video" | "motion";
}

export class UnsupportedLegacySlidesError extends Error {
	constructor(readonly issues: RetiredSlideIssue[]) {
		super(`This project contains retired Video/Motion slides (${issues.map((issue) => issue.id ?? issue.kind).join(", ")}). Open it with a previous version of Captr Studio. The original project has not been changed.`);
		this.name = "UnsupportedLegacySlidesError";
	}
}

export function getRetiredSlideIssues(value: unknown): RetiredSlideIssue[] {
	if (!value || typeof value !== "object") return [];
	const project = value as Record<string, unknown>;
	const issues: RetiredSlideIssue[] = [];
	for (const [field, modeField] of [["slides", "type"], ["clips", "slideMode"]] as const) {
		const entries = project[field];
		if (!Array.isArray(entries)) continue;
		for (const entry of entries) {
			if (!entry || typeof entry !== "object") continue;
			const mode = entry[modeField] ?? (field === "clips" && entry.origin === "uploaded" ? "video" : undefined);
			if (mode === "video" || mode === "motion") {
				issues.push({ id: typeof entry.id === "string" ? entry.id : null, kind: mode });
			}
		}
	}
	return issues;
}

export function assertSupportedLegacyProject(value: unknown): void {
	const issues = getRetiredSlideIssues(value);
	if (issues.length) throw new UnsupportedLegacySlidesError(issues);
}
