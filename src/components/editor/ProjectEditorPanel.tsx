import type { ReactNode } from "react";

interface ProjectEditorPanelProps {
	recordingEditor: ReactNode | null;
	repurposeEditor?: ReactNode | null;
	children: ReactNode;
}

export function ProjectEditorPanel({
	recordingEditor,
	repurposeEditor,
	children,
}: ProjectEditorPanelProps) {
	if (recordingEditor !== null) {
		return <main className="project-recording-subeditor">{recordingEditor}</main>;
	}

	if (repurposeEditor) {
		return <main className="project-repurpose-subeditor">{repurposeEditor}</main>;
	}

	return <>{children}</>;
}
