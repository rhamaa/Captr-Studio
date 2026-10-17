import { useEffect, useState } from "react";
import {
	copyClips,
	copyClipAttributes,
	detachClipAudio,
	pasteClips,
	pasteClipAttributes,
	setClipRelation,
	type ClipClipboard,
} from "@/core/timeline/editingCommands";
import type { ProjectCommand } from "@/core/timeline/history";
import type { TimelineProject } from "@/core/timeline/types";

export function StoryEditingToolbar({
	project,
	selection,
	playheadUs,
	onCommand,
}: {
	project: TimelineProject;
	selection: string[];
	playheadUs: number;
	onCommand: (c: ProjectCommand) => void;
}) {
	const [clipboard, setClipboard] = useState<ClipClipboard | null>(null),
		[attributes, setAttributes] = useState<ReturnType<typeof copyClipAttributes> | null>(null),
		[error, setError] = useState("");
	const run = (action: () => void) => {
		try {
			action();
			setError("");
		} catch (e) {
			setError(String(e));
		}
	};
	const copy = () => run(() => setClipboard(copyClips(project, selection)));
	const paste = () =>
		run(() => {
			if (clipboard) onCommand((p) => pasteClips(p, clipboard, playheadUs));
		});
	const copyAttributes = () =>
		run(() => {
			if (selection[0]) setAttributes(copyClipAttributes(project, selection[0]));
		});
	const pasteAttributes = () =>
		run(() => {
			if (attributes) onCommand((p) => pasteClipAttributes(p, selection, attributes));
		});
	const relation = (kind: "groupId" | "linkId", join: boolean) =>
		run(() => onCommand((p) => setClipRelation(p, selection, kind, join)));
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (
				e.defaultPrevented ||
				target.closest?.("input,textarea,select,[contenteditable=true],[role=dialog]") ||
				!(e.ctrlKey || e.metaKey)
			)
				return;
			const key = e.key.toLowerCase();
			if (!["c", "v", "g"].includes(key)) return;
			e.preventDefault();
			e.stopImmediatePropagation();
			if (key === "c") {
				if (e.shiftKey) copyAttributes();
				else copy();
			}
			if (key === "v") {
				if (e.shiftKey) pasteAttributes();
				else paste();
			}
			if (key === "g") relation("groupId", !e.shiftKey);
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	});
	return (
		<div className="story-workflow-toolbar" aria-label="Story editing tools">
			<div className="story-edit-actions">
				<button type="button" disabled={!selection.length} onClick={copy} title="Ctrl+C">
					Copy
				</button>
				<button type="button" disabled={!clipboard} onClick={paste} title="Ctrl+V">
					Paste
				</button>
				<button
					type="button"
					disabled={selection.length !== 1}
					onClick={copyAttributes}
					title="Ctrl+Shift+C"
				>
					Copy attributes
				</button>
				<button
					type="button"
					disabled={!attributes || !selection.length}
					onClick={pasteAttributes}
					title="Ctrl+Shift+V"
				>
					Paste attributes
				</button>
				<button
					type="button"
					disabled={selection.length < 2}
					onClick={() => relation("groupId", true)}
				>
					Group
				</button>
				<button
					type="button"
					disabled={!selection.length}
					onClick={() => relation("groupId", false)}
				>
					Ungroup
				</button>
				<button
					type="button"
					disabled={selection.length < 2}
					onClick={() => relation("linkId", true)}
				>
					Link
				</button>
				<button
					type="button"
					disabled={!selection.length}
					onClick={() => relation("linkId", false)}
				>
					Unlink
				</button>
				<button
					type="button"
					disabled={selection.length !== 1}
					onClick={() => run(() => onCommand((p) => detachClipAudio(p, selection[0])))}
				>
					Detach audio
				</button>
			</div>
			{error && <p role="alert">{error}</p>}
		</div>
	);
}
