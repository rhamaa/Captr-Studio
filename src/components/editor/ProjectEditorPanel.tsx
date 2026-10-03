import type { ReactNode } from "react";

interface ProjectEditorPanelProps {
	recordingEditor: ReactNode | null;
	children: ReactNode;
}

export function ProjectEditorPanel({ recordingEditor, children }: ProjectEditorPanelProps) {
	if (recordingEditor !== null) {
		return <main className="project-recording-subeditor">{recordingEditor}</main>;
	}

	return <>{children}</>;
}
