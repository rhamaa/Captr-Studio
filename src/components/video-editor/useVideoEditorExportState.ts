import { useCallback, useRef, useState } from "react";
import type { ExportProgress } from "@/lib/exporter";

export type PendingExportSave = {
	fileName: string;
	// Exactly one of these is populated. `tempFilePath` is the preferred form
	// for MP4 exports — the main process holds the finished file on disk, so
	// "Save Again" just renames it instead of round-tripping through the
	// renderer's ArrayBuffer heap.
	arrayBuffer?: ArrayBuffer;
	tempFilePath?: string;
};

export type CancelableExporter = {
	cancel(): void;
};

export function useVideoEditorExportState() {
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const [showExportDropdown, setShowExportDropdown] = useState(false);
	const [exportedFilePath, setExportedFilePath] = useState<string | undefined>(undefined);
	const [hasPendingExportSave, setHasPendingExportSave] = useState(false);
	const exporterRef = useRef<CancelableExporter | null>(null);
	const pendingExportSaveRef = useRef<PendingExportSave | null>(null);

	const clearPendingExportSave = useCallback(() => {
		const pending = pendingExportSaveRef.current;
		pendingExportSaveRef.current = null;
		setHasPendingExportSave(false);
		if (pending?.tempFilePath && typeof window !== "undefined") {
			// Best-effort cleanup — main-process also reaps stale temp files on
			// before-quit, so we ignore failures here.
			void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
		}
	}, []);

	return {
		clearPendingExportSave,
		exportError,
		exporterRef,
		exportedFilePath,
		exportProgress,
		hasPendingExportSave,
		isExporting,
		pendingExportSaveRef,
		setExportError,
		setExportProgress,
		setExportedFilePath,
		setHasPendingExportSave,
		setIsExporting,
		setShowExportDropdown,
		showExportDropdown,
	};
}
