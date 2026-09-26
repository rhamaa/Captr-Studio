import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MotionCodeEditor, type MotionEditorTab } from "./MotionCodeEditor";
import { extractDocumentParts } from "../motionDocument";
import { createDefaultMotionMeta, type MotionSlideMeta } from "../schema";

interface MotionSlideCodeEditorPanelProps {
	motionMeta?: MotionSlideMeta;
	durationMs: number;
	onUpdateMeta: (updater: (previous: MotionSlideMeta) => MotionSlideMeta) => void;
	onChangeDuration?: (durationMs: number) => void;
	onChangeSlideLabel?: (label: string) => void;
}

export function MotionSlideCodeEditorPanel({
	motionMeta,
	durationMs,
	onUpdateMeta,
	onChangeDuration,
	onChangeSlideLabel,
}: MotionSlideCodeEditorPanelProps) {
	const [activeTab, setActiveTab] = useState<MotionEditorTab>("document");
	const defaultMeta = useMemo(() => createDefaultMotionMeta(), []);

	const updateField = <K extends keyof MotionSlideMeta,>(
		key: K,
		value: MotionSlideMeta[K],
	) => {
		onUpdateMeta((previous) => ({
			...(previous ?? defaultMeta),
			document:
				key === "html" || key === "css" || key === "js"
					? ""
					: (previous ?? defaultMeta).document,
			[key]: value,
		}));
	};

	const handleChangeDocument = (document: string) => {
		const parts = extractDocumentParts(document);
		onUpdateMeta((previous) => ({
			...(previous ?? defaultMeta),
			document,
			...parts,
		}));
	};

	const handleImportDocument = (document: string, fileName?: string) => {
		const parts = extractDocumentParts(document);
		if (fileName) onChangeSlideLabel?.(fileName.replace(/\.html?$/i, ""));
		onUpdateMeta((previous) => ({
			...(previous ?? defaultMeta),
			document,
			...parts,
			sourceFileName: fileName,
		}));
		toast.success("File HTML berhasil di-import!");
	};

	const handleResetStarter = () => {
		const starterMeta = createDefaultMotionMeta();
		onUpdateMeta(() => starterMeta);
		toast.info("Template starter berhasil di-reset");
	};

	return (
		<MotionCodeEditor
			isSidebarMode
			activeTab={activeTab}
			onChangeTab={setActiveTab}
			documentCode={motionMeta?.document ?? defaultMeta.document}
			htmlCode={motionMeta?.html ?? ""}
			cssCode={motionMeta?.css ?? ""}
			jsCode={motionMeta?.js ?? ""}
			durationMs={durationMs}
			onChangeDuration={
				onChangeDuration ?? ((nextDurationMs) => updateField("durationMs", nextDurationMs))
			}
			onChangeDocument={handleChangeDocument}
			onChangeHtml={(html) => updateField("html", html)}
			onChangeCss={(css) => updateField("css", css)}
			onChangeJs={(js) => updateField("js", js)}
			onImportDocument={handleImportDocument}
			onResetStarter={handleResetStarter}
			autoReload
		/>
	);
}
