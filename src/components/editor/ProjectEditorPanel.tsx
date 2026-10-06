import type { ReactNode } from "react";

interface ProjectEditorPanelProps {
	recordingEditor: ReactNode | null;
	repurposeEditor?: ReactNode | null;
	hyperframeEditor?: ReactNode | null;
	children: ReactNode;
}

export function ProjectEditorPanel({
	recordingEditor,
	repurposeEditor,
	hyperframeEditor,
	children,
}: ProjectEditorPanelProps) {
	if (recordingEditor !== null) {
		return <main className="project-recording-subeditor">{recordingEditor}</main>;
	}

	if (hyperframeEditor) {
		return <main className="project-hyperframe-subeditor">{hyperframeEditor}</main>;
	}

	if (repurposeEditor) {
		return <main className="project-repurpose-subeditor">{repurposeEditor}</main>;
	}

	return <>{children}</>;
}
