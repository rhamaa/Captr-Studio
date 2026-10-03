import { useI18n } from "@/contexts/I18nContext";
export const projectMessages = {
	assets: "Assets",
	import: "Import",
	record: "Record",
	recordScreen: "Record screen",
	browse: "Browse files",
	search: "Search assets",
	emptyAssets: "Drag and drop videos, photos, and audio files here",
	noMatches: "No matching assets",
	preview: "Preview",
	sourcePreview: "Source preview",
	backTimeline: "Back to timeline",
	buildTimeline: "Build your timeline",
	startVideo: "Start your next video",
	placeHint: "Drag an asset onto the timeline, or use its + button.",
	startHint: "Import media or record your screen. Your assets stay editable.",
	importMedia: "Import media",
	file: "File",
	newProject: "New project",
	openProject: "Open project",
	save: "Save",
	saveAs: "Save as…",
	saving: "Saving…",
	unsaved: "Unsaved changes",
	saved: "Saved",
} as const;
export function useProjectMessages() {
	const { t } = useI18n();
	return (key: keyof typeof projectMessages) =>
		t(`editor.projectWorkspace.${key}`, projectMessages[key]);
}
