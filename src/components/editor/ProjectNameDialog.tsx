import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { validateProjectBaseName } from "@/core/project/projectNames";
import { useProjectMessages } from "./useProjectMessages";
export function projectNameDialogActions(saved: boolean, draft: string) {
	let error: string | null = null;
	try {
		validateProjectBaseName(draft);
	} catch (e) {
		error = e instanceof Error ? e.message : String(e);
	}
	return { valid: !error, rename: saved, saveAs: saved, save: !saved, error };
}
interface Props {
	fileName: string;
	draftName: string;
	saved: boolean;
	busy: boolean;
	error: string | null;
	onDraftChange: (name: string) => void;
	onRename: () => void;
	onSaveAs: () => void;
	onSave: () => void;
	onClose: () => void;
}
export function ProjectNameDialog(props: Props) {
	const m = useProjectMessages(),
		actions = projectNameDialogActions(props.saved, props.draftName);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !props.busy) props.onClose();
			}}
		>
			<DialogContent
				onEscapeKeyDown={(e) => {
					if (props.busy) e.preventDefault();
				}}
				onPointerDownOutside={(e) => {
					if (props.busy) e.preventDefault();
				}}
			>
				<DialogTitle>{m("projectName")}</DialogTitle>
				<DialogDescription>
					{props.fileName} · {props.saved ? m("renameHint") : m("firstSaveHint")}
				</DialogDescription>
				<label className="project-name-label">
					{m("projectName")}
					<div className="project-name-input">
						<input
							autoFocus
							value={props.draftName}
							aria-label={m("projectName")}
							disabled={props.busy}
							onChange={(e) => props.onDraftChange(e.target.value)}
							onKeyDown={(e) => e.stopPropagation()}
						/>
						<span>.captr</span>
					</div>
				</label>
				{(props.error || actions.error) && (
					<p role="alert">{props.error || actions.error}</p>
				)}
				<div className="project-dialog-actions">
					<button disabled={props.busy} onClick={props.onClose}>
						{m("cancel")}
					</button>
					{actions.rename && (
						<button disabled={props.busy || !actions.valid} onClick={props.onRename}>
							{m("renameProject")}
						</button>
					)}
					{actions.saveAs && (
						<button disabled={props.busy || !actions.valid} onClick={props.onSaveAs}>
							{m("saveAs")}
						</button>
					)}
					{actions.save && (
						<button disabled={props.busy || !actions.valid} onClick={props.onSave}>
							{m("saveProject")}
						</button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
