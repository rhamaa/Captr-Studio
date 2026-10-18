export type AppActiveView = "home" | "editor" | "settings";

export type ActiveSurface =
	| { kind: "none" }
	| {
			kind: "story-editor";
			selectedClipIds: string[];
			playheadUs: number;
			activeTrackId?: string;
			zoomScale?: number;
	  }
	| {
			kind: "record-editor";
			recordingAssetId: string;
			packageId: string;
			activeTab: "scene" | "appearance" | "cursor" | "layout";
			currentAppearancePreset?: string;
			outwardBorderWidth?: number;
	  }
	| {
			kind: "caption-editor";
			selectedSegmentIndex?: number;
			activeLanguage?: string;
			isBurnInEnabled?: boolean;
			totalSegments?: number;
	  }
	| {
			kind: "artboard-canvas";
			artboardId: string;
			aspectRatio: "9:16" | "1:1" | "16:9" | "4:5";
			isRepurposing?: boolean;
	  }
	| {
			kind: "voiceover-studio";
			isRecording: boolean;
			takeCount: number;
	  };

export interface ContextualAccelerator {
	id: string;
	label: string;
	description: string;
	toolName: string;
	shortcut?: string;
}

export interface CaptrAppContext {
	isProjectOpen: boolean;
	projectId?: string;
	projectTitle?: string;
	projectPath?: string | null;
	activeView: AppActiveView;
	activeSurface: ActiveSurface;
	availableAccelerators: ContextualAccelerator[];
	telemetrySummary?: {
		transcriptWordCount: number;
		hasCursorClicks: boolean;
		totalDurationUs: number;
	};
}

export interface GlobalAiSettings {
	preferredRunner:
		| "agy"
		| "claude"
		| "opencode"
		| "cursor"
		| "codex"
		| "devin"
		| "hermes"
		| "cline"
		| "kiro"
		| "trae"
		| "custom"
		| (string & {});
	customRunnerPath?: string;
	defaultModel: string;
	apiBaseUrl?: string;
	apiKey?: string;
	mcpServerPort: number;
	enableAutoMcpServer: boolean;
	enableGhostPreview: boolean;
}

export interface ProjectAiConfig {
	modelOverride?: string;
	personaPrompt?: string;
	silenceThresholdMs?: number;
	defaultCaptionStyle?: string;
}
