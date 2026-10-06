import {
	ArrowClockwise,
	ArrowCounterClockwise,
	ArrowLeft,
	CaretDown,
	Check,
	CheckCircle,
	Clock,
	Code,
	Copy,
	FloppyDisk,
	FolderOpen,
	Pause,
	PencilSimple,
	Play,
	Repeat,
	Robot,
	SidebarSimple,
	Sparkle,
	SpeakerHigh,
	SpeakerSlash,
	WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import type { MediaAsset, TimelineProject } from "@/core/timeline/types";
import { HyperframePromptInput } from "./HyperframePromptInput";

export interface HyperframeEditorProps {
	hyperframe: HyperframeComposition;
	project: TimelineProject;
	projectTitle?: string;
	transcripts?: Record<string, any>;
	onUpdate: (updated: Partial<HyperframeComposition>) => void;
	onClose: () => void;
	onExport?: () => void;
}

export function preprocessHyperframeHtml(
	html: string,
	mediaUrlMap?: Map<string, string>,
): string {
	if (!html) return "";
	let processed = html;

	// 1. Identify active media server base URL (e.g. http://127.0.0.1:63893)
	let activeBaseUrl = "";
	if (mediaUrlMap && mediaUrlMap.size > 0) {
		for (const url of mediaUrlMap.values()) {
			if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
				try {
					activeBaseUrl = new URL(url).origin;
					break;
				} catch {}
			}
		}
	}

	// 2. Re-base ANY stale or hardcoded loopback media server URLs (e.g. http://127.0.0.1:49221/video?path=...)
	const mediaUrlRegex = /(?:https?:)?\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/video\?path=([^"'()\s<>#]+)/gi;
	processed = processed.replace(mediaUrlRegex, (fullMatch, encodedPath) => {
		let rawPath = "";
		try {
			rawPath = decodeURIComponent(encodedPath);
		} catch {
			rawPath = encodedPath;
		}

		if (mediaUrlMap && mediaUrlMap.size > 0) {
			if (mediaUrlMap.has(rawPath)) return mediaUrlMap.get(rawPath)!;
			const forward = rawPath.replace(/\\/g, "/");
			if (mediaUrlMap.has(forward)) return mediaUrlMap.get(forward)!;

			const parts = forward.split("/");
			const base = parts[parts.length - 1];
			if (base && mediaUrlMap.has(base)) return mediaUrlMap.get(base)!;

			const strippedBase = base ? base.replace(/^(?:\d+-)+/, "") : "";
			if (strippedBase) {
				if (mediaUrlMap.has(strippedBase)) return mediaUrlMap.get(strippedBase)!;
				for (const [key, val] of mediaUrlMap.entries()) {
					if (key.endsWith(strippedBase)) {
						return val;
					}
				}
			}
		}

		if (activeBaseUrl) {
			return `${activeBaseUrl}/video?path=${encodeURIComponent(rawPath)}`;
		}
		return fullMatch;
	});

	// 3. Replace relative paths, basenames, file URLs, and asset IDs with live media URLs
	if (mediaUrlMap && mediaUrlMap.size > 0) {
		// Sort keys descending by length to replace longer paths (full path, file://) before basenames
		const sortedEntries = Array.from(mediaUrlMap.entries())
			.filter(([key, url]) => Boolean(key && url && key !== url))
			.sort((a, b) => b[0].length - a[0].length);

		for (const [key, mediaUrl] of sortedEntries) {
			const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			// If key is a basename (no slashes or backslashes), ensure it's not preceded by path= or %5C or %2F
			if (!key.includes("/") && !key.includes("\\")) {
				const regex = new RegExp(`(?<=["'\\(\\s>])${escaped}(?=["'\\)\\s<#?])`, "g");
				processed = processed.replace(regex, mediaUrl);
			} else {
				// Full path or file URL: replace all occurrences
				const regex = new RegExp(escaped, "g");
				processed = processed.replace(regex, mediaUrl);
			}
		}
	}

	// 4. Ensure all <video> tags have playsinline
	processed = processed.replace(/<video\b([^>]*)>/gi, (_match, attrs) => {
		let updatedAttrs = attrs;
		if (!/\bplaysinline\b/i.test(updatedAttrs)) {
			updatedAttrs += " playsinline";
		}
		return `<video${updatedAttrs}>`;
	});

	// 5. Auto-inject companion audio track if screen video is present but NO audio element is authored
	if (mediaUrlMap && !/<audio\b/i.test(processed)) {
		let micUrl: string | undefined;
		for (const [key, url] of mediaUrlMap.entries()) {
			if (key.includes("Microphone Audio") || key.endsWith("-mic") || key.endsWith(".mic.wav")) {
				micUrl = url;
				break;
			}
		}
		if (micUrl) {
			const audioTag = `\n<audio id="__captr_companion_mic" src="${micUrl}" preload="auto" playsinline></audio>`;
			if (processed.includes("</body>")) {
				processed = processed.replace("</body>", `${audioTag}\n</body>`);
			} else {
				processed += audioTag;
			}
		}
	}

	// 6. Inject media synchronizer script if not present
	if (!processed.includes("__captr_hyperframe_sync")) {
		const syncScript = `
<script id="__captr_hyperframe_sync">
(function() {
  window.__captr_is_playing = false;
  var __captr_host_controlled = false;

  // Protect HTMLMediaElement against 60fps seek stalls during continuous playback:
  var originalDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
  if (originalDescriptor && originalDescriptor.set) {
    var origSet = originalDescriptor.set;
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      get: originalDescriptor.get,
      set: function(val) {
        if (window.__captr_is_playing && !this.paused) {
          if (Math.abs(this.currentTime - val) < 0.25) {
            return;
          }
        }
        return origSet.call(this, val);
      },
      configurable: true,
    });
  }

  function syncMediaElements(t, isPlaying, isMuted, volume) {
    var els = document.querySelectorAll('video, audio');
    els.forEach(function(el) {
      if (el.tagName === 'AUDIO') {
        el.muted = typeof isMuted === 'boolean' ? isMuted : false;
        if (typeof volume === 'number') el.volume = volume;
      } else if (typeof isMuted === 'boolean') {
        el.muted = isMuted;
      }
      if (typeof volume === 'number') {
        el.volume = volume;
      }
      if (isPlaying) {
        if (el.paused) {
          try { el.play().catch(function(){}); } catch(e) {}
        }
        if (Math.abs(el.currentTime - t) > 0.25) {
          try { el.currentTime = t; } catch(e) {}
        }
      } else {
        if (!el.paused) {
          try { el.pause(); } catch(e) {}
        }
        if (Math.abs(el.currentTime - t) > 0.04) {
          try { el.currentTime = t; } catch(e) {}
        }
      }
    });
  }

  var existingSeek = window.seekFrame;
  window.seekFrame = function(timeInSeconds, isPlaying, isMuted, volume) {
    if (arguments.length >= 3) {
      __captr_host_controlled = true;
    } else if (__captr_host_controlled) {
      return; // Ignore internal animation loops that fight host transport
    }
    window.__captr_is_playing = !!isPlaying;
    if (typeof existingSeek === 'function' && existingSeek !== window.seekFrame) {
      try { existingSeek(timeInSeconds, isPlaying); } catch(e) {}
    }
    if (window.tl && typeof window.tl.seek === 'function') {
      try { window.tl.seek(timeInSeconds); } catch(e) {}
    }
    syncMediaElements(timeInSeconds, !!isPlaying, isMuted, volume);
  };

  // Automatic duration detection from embedded video/audio and GSAP timeline
  function detectMediaDuration() {
    var maxD = 0;
    var els = document.querySelectorAll('video, audio');
    els.forEach(function(el) {
      if (el.duration && isFinite(el.duration) && el.duration > maxD) {
        maxD = el.duration;
      }
    });
    if (window.tl && typeof window.tl.duration === 'function') {
      try {
        var tlD = window.tl.duration();
        if (tlD && isFinite(tlD) && tlD > maxD) maxD = tlD;
      } catch(e) {}
    }
    var rootEl = document.querySelector('[data-duration]');
    if (rootEl) {
      var dAttr = parseFloat(rootEl.getAttribute('data-duration'));
      if (dAttr && isFinite(dAttr) && dAttr > maxD) maxD = dAttr;
    }
    if (maxD > 0 && isFinite(maxD)) {
      try {
        window.parent.postMessage({ type: 'HYPERFRAME_DETECTED_DURATION', durationSec: maxD }, '*');
      } catch(e) {}
    }
  }

  window.addEventListener('loadedmetadata', detectMediaDuration, true);
  window.addEventListener('canplay', detectMediaDuration, true);
  setTimeout(detectMediaDuration, 300);
  setTimeout(detectMediaDuration, 1000);
  setTimeout(detectMediaDuration, 2500);

  window.addEventListener('message', function(ev) {
    if (ev && ev.data && ev.data.type === 'SEEK_FRAME') {
      var t = typeof ev.data.timeSec === 'number' ? ev.data.timeSec : 0;
      var isPlay = !!ev.data.isPlaying;
      var isMuted = typeof ev.data.isMuted === 'boolean' ? ev.data.isMuted : undefined;
      var volume = typeof ev.data.volume === 'number' ? ev.data.volume : undefined;
      window.seekFrame(t, isPlay, isMuted, volume);
    }
  });
})();
</script>`;
		if (processed.includes("</body>")) {
			processed = processed.replace("</body>", `${syncScript}\n</body>`);
		} else {
			processed += syncScript;
		}
	}

	return processed;
}

export async function buildProjectMediaUrlMap(
	project: TimelineProject,
	getLocalMediaUrl?: (path: string) => Promise<{ success: boolean; url?: string; error?: string }>,
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	if (!getLocalMediaUrl) return map;

	const candidatePaths = new Set<string>();

	for (const asset of project.assets || []) {
		if (asset.source?.path) {
			candidatePaths.add(asset.source.path);
		}
	}

	for (const pkg of project.packages || []) {
		if (pkg.screen?.path) candidatePaths.add(pkg.screen.path);
		if (pkg.webcam?.path) candidatePaths.add(pkg.webcam.path);
		if (pkg.microphone?.path) candidatePaths.add(pkg.microphone.path);
		const sys = pkg.system || (pkg as any).systemAudio;
		if (sys?.path) candidatePaths.add(sys.path);
	}

	for (const filePath of candidatePaths) {
		try {
			if (typeof window !== "undefined" && window.electronAPI?.approveLocalMediaPath) {
				await window.electronAPI.approveLocalMediaPath(filePath).catch(() => {});
			}
			const res = await getLocalMediaUrl(filePath);
			if (res.success && res.url) {
				const mediaUrl = res.url;
				map.set(filePath, mediaUrl);
				const forward = filePath.replace(/\\/g, "/");
				map.set(forward, mediaUrl);
				const parts = forward.split("/");
				const basename = parts[parts.length - 1];
				if (basename) {
					map.set(basename, mediaUrl);
					const stripped = basename.replace(/^(?:\d+-)+/, "");
					if (stripped && stripped !== basename) {
						map.set(stripped, mediaUrl);
					}
				}
				const assetsIndex = forward.indexOf("/assets/");
				if (assetsIndex !== -1) {
					map.set(forward.slice(assetsIndex + 1), mediaUrl);
				}
				try {
					const normalizedPath = forward.startsWith("/") ? forward : `/${forward}`;
					map.set(`file://${normalizedPath}`, mediaUrl);
				} catch {}
			}
		} catch {}
	}

	for (const asset of project.assets || []) {
		const pkg = project.packages?.find((p) => p.id === (asset.packageId || asset.id));
		const resolvedPath = pkg?.screen?.path ?? asset.source?.path;
		if (resolvedPath && map.has(resolvedPath)) {
			const resolvedUrl = map.get(resolvedPath)!;
			if (asset.name) map.set(asset.name, resolvedUrl);
			if (asset.id) map.set(asset.id, resolvedUrl);
		}
	}

	for (const pkg of project.packages || []) {
		const parentAsset = project.assets?.find((a) => a.packageId === pkg.id || a.id === pkg.id);
		const baseName = parentAsset?.name || pkg.id;

		if (pkg.microphone?.path && map.has(pkg.microphone.path)) {
			const micUrl = map.get(pkg.microphone.path)!;
			map.set(`${baseName} (Microphone Audio)`, micUrl);
			map.set(`${pkg.id}-mic`, micUrl);
			const base = pkg.microphone.path.split(/[/\\]/).pop();
			if (base) {
				map.set(base, micUrl);
				const stripped = base.replace(/^(?:\d+-)+/, "");
				if (stripped && stripped !== base) map.set(stripped, micUrl);
			}
		}
		const sys = pkg.system || (pkg as any).systemAudio;
		if (sys?.path && map.has(sys.path)) {
			const sysUrl = map.get(sys.path)!;
			map.set(`${baseName} (System Audio)`, sysUrl);
			map.set(`${pkg.id}-sys`, sysUrl);
			const base = sys.path.split(/[/\\]/).pop();
			if (base) {
				map.set(base, sysUrl);
				const stripped = base.replace(/^(?:\d+-)+/, "");
				if (stripped && stripped !== base) map.set(stripped, sysUrl);
			}
		}
		if (pkg.webcam?.path && map.has(pkg.webcam.path)) {
			const webUrl = map.get(pkg.webcam.path)!;
			map.set(`${baseName} (Webcam)`, webUrl);
			map.set(`${pkg.id}-webcam`, webUrl);
			const base = pkg.webcam.path.split(/[/\\]/).pop();
			if (base) {
				map.set(base, webUrl);
				const stripped = base.replace(/^(?:\d+-)+/, "");
				if (stripped && stripped !== base) map.set(stripped, webUrl);
			}
		}
	}

	return map;
}

interface AgentOption {
	id: string;
	name: string;
	command: string;
	description: string;
	available: boolean;
	executablePath?: string;
}

const DEFAULT_AGENTS: AgentOption[] = [
	{ id: "agy", name: "Antigravity CLI", command: "agy", description: "Antigravity Agent CLI", available: false },
	{ id: "claude", name: "Claude Code", command: "claude", description: "Anthropic Claude CLI", available: false },
	{ id: "codex", name: "OpenAI Codex", command: "codex", description: "Codex terminal agent", available: false },
	{ id: "opencode", name: "OpenCode CLI", command: "opencode", description: "OpenCode AI developer", available: false },
	{ id: "kiro", name: "Kiro CLI", command: "kiro", description: "Kiro autonomous terminal agent", available: false },
	{ id: "trae", name: "Trae CLI", command: "trae", description: "Trae AI agent", available: false },
	{ id: "cline", name: "Cline CLI", command: "cline", description: "Cline agent CLI", available: false },
	{ id: "hermes", name: "Hermes CLI", command: "hermes", description: "Hermes agent runner", available: false },
	{ id: "custom", name: "Custom Binary...", command: "", description: "Custom terminal executable", available: false },
];

const PRESET_PROMPTS = [
	{ label: "Video Showcase", prompt: "Embed the tagged video in a sleek browser mockup container with floating pastel title, glowing border, and smooth entry animation." },
	{ label: "Screen + PiP Webcam", prompt: "Play the screen recording full-width with a floating circular webcam overlay in the corner, synced kinetic captions, and subtle pulsing glow." },
	{ label: "Kinetic Intro", prompt: "Animate a bold title with smooth GSAP elastic bounce, glowing pastel subtitle, and floating particle badges." },
	{ label: "Lower Third", prompt: "Create a modern lower-third graphic with frosted glass card, speaker name, and animated accent bar." },
	{ label: "Stat Counter", prompt: "Display a clean metric card with an animated number counter from 0 to 100K and a pastel progress ring." },
	{ label: "Pastel CTA", prompt: "Design an outro card with soft pastel gradient, social icons, and pulse animation button." },
];

export function HyperframeEditor({
	hyperframe,
	project,
	projectTitle,
	transcripts,
	onUpdate,
	onClose,
}: HyperframeEditorProps) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const stageContainerRef = useRef<HTMLDivElement | null>(null);
	const logsEndRef = useRef<HTMLDivElement | null>(null);

	// Layout state: Sidebar toggle (Agent/Code side panel)
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [activeTab, setActiveTab] = useState<"agent" | "code">("agent");

	// Playback Transport State: default playing so video and animations immediately run in a smooth loop
	const [currentTimeSec, setCurrentTimeSec] = useState(0);
	const [isPlaying, setIsPlaying] = useState(true);
	const [isLooping, setIsLooping] = useState(true);
	const [isMuted, setIsMuted] = useState(false);
	const [volume, setVolume] = useState(1.0);
	const [scale, setScale] = useState(0.5);

	// Duration state & dynamic adjustment
	const durationSec = Math.max(0.1, hyperframe.durationUs / 1_000_000);
	const [isEditingDuration, setIsEditingDuration] = useState(false);
	const [customDurationDraft, setCustomDurationDraft] = useState(String(durationSec.toFixed(1)));
	const [detectedMediaDuration, setDetectedMediaDuration] = useState<number | null>(null);

	const handleSetDuration = (newSec: number) => {
		const clamped = Math.max(0.5, Math.min(3600, newSec));
		onUpdate({ durationUs: Math.round(clamped * 1_000_000) });
		setIsEditingDuration(false);
	};

	// Listen for duration detection notifications from embedded iframe
	useEffect(() => {
		const handleMessage = (ev: MessageEvent) => {
			if (ev && ev.data && ev.data.type === "HYPERFRAME_DETECTED_DURATION") {
				const d = typeof ev.data.durationSec === "number" ? ev.data.durationSec : 0;
				if (d > 0 && isFinite(d)) {
					const rounded = Math.round(d * 10) / 10;
					setDetectedMediaDuration(rounded);
					// Auto-update duration if hyperframe is at default 5s or if difference is significant
					if (Math.abs(durationSec - rounded) > 0.4 && (durationSec === 5 || !hyperframe.durationUs)) {
						onUpdate({ durationUs: Math.round(rounded * 1_000_000) });
					}
				}
			}
		};
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [durationSec, hyperframe.durationUs, onUpdate]);

	// Keep customDurationDraft in sync with durationSec
	useEffect(() => {
		setCustomDurationDraft(durationSec.toFixed(1));
	}, [durationSec]);

	// Code editor state
	const [codeDraft, setCodeDraft] = useState(hyperframe.htmlContent || "");
	const [codeCopied, setCodeCopied] = useState(false);

	// Title editing
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(hyperframe.name);

	// Synthesize available assets including dedicated audio and webcam tracks for packages
	const availableAssets = useMemo(() => {
		const list: MediaAsset[] = [...(project.assets || [])];
		for (const pkg of project.packages || []) {
			const parentAsset = project.assets?.find((a) => a.packageId === pkg.id || a.id === pkg.id);
			const baseName = parentAsset?.name || pkg.id;

			if (pkg.microphone?.path) {
				const micId = `${pkg.id}-mic`;
				if (!list.some((a) => a.id === micId)) {
					list.push({
						id: micId,
						kind: "audio",
						name: `${baseName} (Microphone Audio)`,
						width: 0,
						height: 0,
						source: {
							path: pkg.microphone.path,
							durationUs: pkg.microphone.durationUs || pkg.durationUs,
							offsetUs: pkg.microphone.offsetUs || 0,
						},
						durationUs: pkg.microphone.durationUs || pkg.durationUs,
						packageId: pkg.id,
					});
				}
			}

			const sys = pkg.system || (pkg as any).systemAudio;
			if (sys?.path) {
				const sysId = `${pkg.id}-sys`;
				if (!list.some((a) => a.id === sysId)) {
					list.push({
						id: sysId,
						kind: "audio",
						name: `${baseName} (System Audio)`,
						width: 0,
						height: 0,
						source: {
							path: sys.path,
							durationUs: sys.durationUs || pkg.durationUs,
							offsetUs: sys.offsetUs || 0,
						},
						durationUs: sys.durationUs || pkg.durationUs,
						packageId: pkg.id,
					});
				}
			}

			if (pkg.webcam?.path) {
				const webcamId = `${pkg.id}-webcam`;
				if (!list.some((a) => a.id === webcamId)) {
					list.push({
						id: webcamId,
						kind: "video",
						name: `${baseName} (Webcam)`,
						width: 1280,
						height: 720,
						source: {
							path: pkg.webcam.path,
							durationUs: pkg.webcam.durationUs || pkg.durationUs,
							offsetUs: pkg.webcam.offsetUs || 0,
						},
						durationUs: pkg.webcam.durationUs || pkg.durationUs,
						packageId: pkg.id,
					});
				}
			}
		}
		return list;
	}, [project.assets, project.packages]);

	// CLI Agent & Tagged Asset State
	const [availableAgents, setAvailableAgents] = useState<AgentOption[]>(DEFAULT_AGENTS);
	const [selectedAgentId, setSelectedAgentId] = useState("agy");
	const [customCommand, setCustomCommand] = useState("");
	const [userPrompt, setUserPrompt] = useState("");
	const [taggedAssets, setTaggedAssets] = useState<MediaAsset[]>([]);
	const [isAgentRunning, setIsAgentRunning] = useState(false);
	const [agentLogs, setAgentLogs] = useState<string[]>([]);
	const [agentError, setAgentError] = useState<string | null>(null);
	const [agentSuccess, setAgentSuccess] = useState<string | null>(null);

	const handleTaggedAssetsChange = (newTagged: MediaAsset[]) => {
		setTaggedAssets(newTagged);
		// If user tags an asset with duration, adapt hyperframe duration automatically
		const assetWithDuration = newTagged.find(
			(a) => (a.durationUs && a.durationUs > 0) || (a.source?.durationUs && a.source.durationUs > 0),
		);
		const durUs = assetWithDuration?.durationUs || assetWithDuration?.source?.durationUs;
		if (durUs && durUs > 0) {
			const assetSec = Math.round((durUs / 1_000_000) * 10) / 10;
			if (assetSec > 0 && Math.abs(durationSec - assetSec) > 0.1) {
				onUpdate({ durationUs: Math.round(assetSec * 1_000_000) });
			}
		}
	};

	const [mediaUrlMap, setMediaUrlMap] = useState<Map<string, string>>(new Map());

	// Resolve local media URLs for all project assets and recording packages
	useEffect(() => {
		let isMounted = true;
		if (window.electronAPI?.getLocalMediaUrl) {
			buildProjectMediaUrlMap(project, window.electronAPI.getLocalMediaUrl)
				.then((map) => {
					if (isMounted) {
						setMediaUrlMap(map);
					}
				})
				.catch((err) => {
					console.warn("Failed to build media URL map:", err);
				});
		}
		return () => {
			isMounted = false;
		};
	}, [project]);

	// Preprocessed HTML with resolved media URLs, browser playback attributes, and sync script
	const processedHtml = useMemo(() => {
		return preprocessHyperframeHtml(hyperframe.htmlContent || "", mediaUrlMap);
	}, [hyperframe.htmlContent, mediaUrlMap]);

	// Sync code draft when hyperframe updates externally
	useEffect(() => {
		setCodeDraft(hyperframe.htmlContent || "");
	}, [hyperframe.htmlContent]);

	// Load available CLI agents from electron
	useEffect(() => {
		let isMounted = true;
		if (window.electronAPI?.getAvailableAgents) {
			window.electronAPI
				.getAvailableAgents()
				.then((agents) => {
					if (!isMounted) return;
					if (agents && agents.length > 0) {
						const merged = DEFAULT_AGENTS.map((def) => {
							const found = agents.find((a) => a.id === def.id);
							return found ? { ...def, ...found } : def;
						});
						setAvailableAgents(merged);
						const readyOne = merged.find((a) => a.available);
						if (readyOne && !merged.find((a) => a.id === selectedAgentId)?.available) {
							setSelectedAgentId(readyOne.id);
						}
					}
				})
				.catch((err) => {
					console.warn("Failed to detect CLI agents:", err);
				});
		}
		return () => {
			isMounted = false;
		};
	}, [selectedAgentId]);

	// Subscribe to streaming logs
	useEffect(() => {
		if (!window.electronAPI?.onHyperframeAgentLogStream) return;
		const unsubscribe = window.electronAPI.onHyperframeAgentLogStream((chunk) => {
			setAgentLogs((prev) => [...prev, chunk]);
		});
		return () => {
			unsubscribe();
		};
	}, []);

	// Auto scroll logs
	useEffect(() => {
		logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [agentLogs]);

	// Responsive scale calculation for full preview canvas
	useEffect(() => {
		const updateScale = () => {
			if (!stageContainerRef.current) return;
			const { clientWidth, clientHeight } = stageContainerRef.current;
			if (clientWidth > 0 && clientHeight > 0) {
				const padding = 64;
				const scaleX = (clientWidth - padding) / (hyperframe.width || 1920);
				const scaleY = (clientHeight - padding) / (hyperframe.height || 1080);
				setScale(Math.max(0.15, Math.min(scaleX, scaleY, 0.95)));
			}
		};
		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, [hyperframe.width, hyperframe.height, sidebarOpen]);

	// Playback animation loop
	useEffect(() => {
		if (!isPlaying) return;
		let animId: number;
		let lastTime = performance.now();

		const step = (now: number) => {
			const deltaSec = (now - lastTime) / 1000;
			lastTime = now;

			setCurrentTimeSec((prev) => {
				const next = prev + deltaSec;
				if (next >= durationSec) {
					if (isLooping) {
						return 0;
					}
					setIsPlaying(false);
					return durationSec;
				}
				return next;
			});

			animId = requestAnimationFrame(step);
		};

		animId = requestAnimationFrame(step);
		return () => cancelAnimationFrame(animId);
	}, [isPlaying, durationSec, isLooping]);

	// Send seek message to iframe
	useEffect(() => {
		if (!iframeRef.current?.contentWindow) return;
		try {
			const win = iframeRef.current.contentWindow as unknown as {
				seekFrame?: (time: number, isPlaying?: boolean, isMuted?: boolean, volume?: number) => void;
			};
			if (typeof win.seekFrame === "function") {
				win.seekFrame(currentTimeSec, isPlaying, isMuted, volume);
			} else {
				iframeRef.current.contentWindow.postMessage(
					{ type: "SEEK_FRAME", timeSec: currentTimeSec, isPlaying, isMuted, volume },
					"*",
				);
			}
		} catch {
			// Ignore cross-origin error
		}
	}, [currentTimeSec, isPlaying, isMuted, volume]);

	// Keyboard shortcuts listener
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				(target.matches("input,textarea,select,[contenteditable=true]") ||
					target.isContentEditable)
			) {
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			} else if (e.key === " " || e.code === "Space") {
				e.preventDefault();
				togglePlay();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, isPlaying, durationSec]);

	const togglePlay = () => {
		if (isPlaying) {
			setIsPlaying(false);
		} else {
			if (currentTimeSec >= durationSec) {
				setCurrentTimeSec(0);
			}
			setIsPlaying(true);
		}
	};

	const handleReload = () => {
		if (iframeRef.current) {
			iframeRef.current.srcdoc = processedHtml;
			setCurrentTimeSec(0);
		}
	};

	const handleApplyCode = () => {
		onUpdate({ htmlContent: codeDraft });
	};

	const handleCopyCode = () => {
		navigator.clipboard.writeText(codeDraft);
		setCodeCopied(true);
		setTimeout(() => setCodeCopied(false), 2000);
	};

	const handleSaveTitle = () => {
		const trimmed = titleDraft.trim();
		if (trimmed) {
			onUpdate({ name: trimmed });
		}
		setIsEditingTitle(false);
	};

	const handleRunAgent = async () => {
		if (!userPrompt.trim()) return;
		setAgentError(null);
		setAgentSuccess(null);
		setIsAgentRunning(true);
		setAgentLogs([`🚀 Invoking CLI Agent: ${selectedAgentId}...`]);

		try {
			if (!window.electronAPI?.runHyperframeAgentTask) {
				throw new Error("Electron Agent API is not available in this environment.");
			}

			const resolveAssetPackage = (a: MediaAsset) => {
				if (a.kind === "recording" || a.packageId) {
					return project.packages?.find((p) => p.id === (a.packageId || a.id));
				}
				return undefined;
			};

			const resolveAssetPath = (a: MediaAsset) => {
				const pkg = resolveAssetPackage(a);
				if (a.source?.path) return a.source.path;
				if (a.id.endsWith("-mic")) return pkg?.microphone?.path;
				if (a.id.endsWith("-sys")) return (pkg?.system || (pkg as any)?.systemAudio)?.path;
				if (a.id.endsWith("-webcam")) return pkg?.webcam?.path;
				return pkg?.screen?.path ?? a.source?.path;
			};

			const buildAssetPayload = (a: MediaAsset) => {
				const pkg = resolveAssetPackage(a);
				const resolvedPath = resolveAssetPath(a);
				const mediaUrl = resolvedPath ? mediaUrlMap.get(resolvedPath) : undefined;
				return {
					id: a.id,
					name: a.name,
					kind: a.kind,
					path: resolvedPath,
					mediaUrl,
					packageId: a.packageId || pkg?.id,
					durationMs: a.durationUs ? a.durationUs / 1000 : undefined,
					recordingPackage: pkg
						? {
								id: pkg.id,
								name: (pkg as any).name || a.name,
								screenPath: pkg.screen?.path,
								webcamPath: pkg.webcam?.path,
								microphonePath: pkg.microphone?.path,
								systemAudioPath: pkg.system?.path ?? (pkg as any).systemAudio?.path,
								cursorPath: pkg.cursorPath,
								settings: pkg.settings,
						  }
						: undefined,
				};
			};

			// Calculate target duration from tagged assets or detected media duration
			let targetDurationSec = durationSec;
			const taggedWithDur = taggedAssets.find(
				(a) => (a.durationUs && a.durationUs > 0) || (a.source?.durationUs && a.source.durationUs > 0),
			);
			const taggedDurUs = taggedWithDur?.durationUs || taggedWithDur?.source?.durationUs;
			if (taggedDurUs && taggedDurUs > 0) {
				targetDurationSec = Math.round((taggedDurUs / 1_000_000) * 10) / 10;
			} else if (detectedMediaDuration && detectedMediaDuration > 0) {
				targetDurationSec = detectedMediaDuration;
			}

			const res = await window.electronAPI.runHyperframeAgentTask({
				agentId: selectedAgentId,
				customCommand: selectedAgentId === "custom" ? customCommand : undefined,
				userPrompt: userPrompt.trim(),
				hyperframeId: hyperframe.id,
				hyperframeName: hyperframe.name,
				currentHtml: hyperframe.htmlContent || "",
				width: hyperframe.width,
				height: hyperframe.height,
				durationSec: targetDurationSec,
				taggedAssets: taggedAssets.map(buildAssetPayload),
				projectContext: {
					projectId: project.projectId,
					projectTitle: projectTitle || project.title,
					aspectRatio: hyperframe.aspectRatio || "16:9",
					packages: project.packages,
					transcripts: transcripts,
					assets: availableAssets.map(buildAssetPayload),
				},
			});

			if (res.logs && res.logs.length > 0) {
				setAgentLogs(res.logs);
			}

			if (res.success && res.html) {
				onUpdate({
					htmlContent: res.html,
					durationUs: Math.round(targetDurationSec * 1_000_000),
				});
				setCodeDraft(res.html);
				setAgentSuccess("Hyperframe updated successfully by agent!");
				setCurrentTimeSec(0);
				setIsPlaying(true);
				if (iframeRef.current) {
					iframeRef.current.srcdoc = preprocessHyperframeHtml(res.html, mediaUrlMap);
				}
			} else {
				setAgentError(res.error || "Agent execution failed without returning valid HTML.");
			}
		} catch (err) {
			setAgentError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsAgentRunning(false);
		}
	};

	const handleCancelAgent = async () => {
		if (window.electronAPI?.cancelHyperframeAgentTask) {
			await window.electronAPI.cancelHyperframeAgentTask();
		}
		setIsAgentRunning(false);
		setAgentLogs((prev) => [...prev, "🛑 Agent task cancelled by user."]);
	};

	const selectedAgent = availableAgents.find((a) => a.id === selectedAgentId);

	return (
		<div className="flex h-full w-full flex-col bg-[#111214] text-[#F5F6F8] overflow-hidden select-none">
			{/* Top Bar Header */}
			<header className="flex h-14 shrink-0 items-center justify-between border-b border-[#343A46] bg-[#1C1F26] px-5 z-20">
				{/* Header Left: Navigation & Identity */}
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={onClose}
						className="flex items-center gap-1.5 rounded-lg border border-[#343A46] bg-[#15171C] px-3 py-1.5 text-xs font-semibold text-[#A8AFBD] hover:border-white/20 hover:text-white transition"
						title="Return to Multi-Artboard Hub (Esc)"
					>
						<ArrowLeft size={14} weight="bold" />
						<span>Back</span>
						<kbd className="ml-1 rounded bg-white/10 px-1 py-0.5 text-[10px]">Esc</kbd>
					</button>

					<span className="text-[#4B5262]">/</span>

					{projectTitle && (
						<>
							<span className="text-xs text-[#A8AFBD] font-medium" title={projectTitle}>
								{projectTitle}
							</span>
							<span className="text-[#4B5262]">/</span>
						</>
					)}

					<span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#A879F5]/30 bg-[#A879F5]/15 text-[#A879F5]">
						<Sparkle size={16} weight="fill" />
					</span>

					{isEditingTitle ? (
						<div className="flex items-center gap-1.5">
							<input
								type="text"
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSaveTitle();
									if (e.key === "Escape") setIsEditingTitle(false);
								}}
								autoFocus
								className="rounded border border-[#6FA8FF] bg-[#15171C] px-2 py-0.5 text-sm font-semibold text-white outline-none"
							/>
							<button
								type="button"
								onClick={handleSaveTitle}
								className="rounded bg-[#6FA8FF] px-2 py-0.5 text-xs font-semibold text-[#15171C]"
							>
								Save
							</button>
						</div>
					) : (
						<div
							className="group flex cursor-pointer items-center gap-2"
							onClick={() => setIsEditingTitle(true)}
							title="Click to rename Hyperframe"
						>
							<h2 className="text-sm font-bold tracking-wide text-white group-hover:text-[#6FA8FF]">
								{hyperframe.name}
							</h2>
							<span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#A8AFBD] opacity-0 group-hover:opacity-100 transition">
								Rename
							</span>
						</div>
					)}

					{/* Composition Spec Badges */}
					<div className="flex items-center gap-2 border-l border-[#343A46] pl-3 text-xs">
						<span className="rounded bg-[#A879F5]/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#c5a7fb]">
							{hyperframe.aspectRatio || "16:9"}
						</span>
						<span className="font-mono text-[11px] text-[#A8AFBD]">
							{hyperframe.width}x{hyperframe.height}
						</span>
						<span className="text-[#343A46]">•</span>
						{isEditingDuration ? (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									const val = parseFloat(customDurationDraft);
									if (!isNaN(val) && val > 0) handleSetDuration(val);
								}}
								className="flex items-center gap-1"
							>
								<input
									type="number"
									step="0.1"
									min="0.5"
									max="3600"
									autoFocus
									value={customDurationDraft}
									onChange={(e) => setCustomDurationDraft(e.target.value)}
									onBlur={() => {
										const val = parseFloat(customDurationDraft);
										if (!isNaN(val) && val > 0) handleSetDuration(val);
										else setIsEditingDuration(false);
									}}
									className="w-16 rounded border border-[#6FA8FF] bg-[#15171C] px-1.5 py-0.5 font-mono text-[11px] text-white outline-none"
								/>
								<span className="text-[11px] text-[#A8AFBD]">s</span>
							</form>
						) : (
							<button
								type="button"
								onClick={() => {
									setCustomDurationDraft(durationSec.toFixed(1));
									setIsEditingDuration(true);
								}}
								title="Click to edit duration in seconds"
								className="group/dur flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] text-[#A8AFBD] hover:bg-white/5 hover:text-white transition"
							>
								<span>{durationSec.toFixed(1)}s</span>
								<PencilSimple size={10} className="opacity-0 group-hover/dur:opacity-100 text-[#6FA8FF]" />
							</button>
						)}
						<span className="text-[#343A46]">•</span>
						<span className="font-mono text-[11px] text-[#8DDB9B]">60 FPS</span>
					</div>
				</div>

				{/* Header Right: Actions & Sidebar Toggle */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={handleReload}
						className="flex items-center gap-1.5 rounded-lg border border-[#343A46] bg-[#15171C] px-2.5 py-1.5 text-xs font-semibold text-[#A8AFBD] hover:border-white/20 hover:text-white transition"
						title="Restart & Reload Frame"
					>
						<ArrowClockwise size={14} />
						<span>Reload</span>
					</button>

					<button
						type="button"
						onClick={() => setSidebarOpen((v) => !v)}
						className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
							sidebarOpen
								? "border-[#6FA8FF]/40 bg-[#6FA8FF]/15 text-white"
								: "border-[#343A46] bg-[#15171C] text-[#A8AFBD] hover:text-white"
						}`}
						title={sidebarOpen ? "Collapse Side Panel" : "Expand Side Panel"}
					>
						<SidebarSimple size={15} weight="bold" />
						<span>{sidebarOpen ? "Hide Panel" : "Agent / Code"}</span>
					</button>
				</div>
			</header>

			{/* Main Workspace Layout: Center Stage (Wide) & Right Sidebar */}
			<div className="flex flex-1 overflow-hidden">
				{/* Center Stage: Full Preview Canvas & Dedicated Transport Bar */}
				<main className="flex flex-1 flex-col overflow-hidden bg-[#111214]">
					{/* Live Canvas Viewport */}
					<div
						ref={stageContainerRef}
						className="relative flex flex-1 items-center justify-center overflow-hidden p-8"
					>
						<div
							className="relative overflow-hidden rounded-xl border border-white/10 bg-transparent shadow-2xl transition-transform"
							style={{
								width: `${hyperframe.width}px`,
								height: `${hyperframe.height}px`,
								transform: `scale(${scale})`,
								transformOrigin: "center center",
							}}
						>
							<iframe
								ref={iframeRef}
								data-testid="hyperframe-stage-iframe"
								title={hyperframe.name}
								sandbox="allow-scripts allow-same-origin"
								srcDoc={processedHtml}
								className="h-full w-full border-none pointer-events-none"
							/>
						</div>
					</div>

					{/* Dedicated Bottom Transport Bar (Always Visible, Never Clipped) */}
					<div className="flex h-16 shrink-0 items-center gap-4 border-t border-[#343A46] bg-[#1C1F26] px-6 shadow-lg z-10">
						{/* Play / Pause Primary Button */}
						<button
							type="button"
							data-testid="hyperframe-transport-play"
							onClick={togglePlay}
							className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6FA8FF] text-[#15171C] font-bold shadow-md transition hover:bg-[#85b7ff] hover:scale-105 active:scale-95"
							title={isPlaying ? "Pause (Space)" : "Play (Space)"}
						>
							{isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
						</button>

						{/* Restart Button */}
						<button
							type="button"
							onClick={() => setCurrentTimeSec(0)}
							className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#343A46] bg-[#15171C] text-[#A8AFBD] hover:border-white/20 hover:text-white transition"
							title="Rewind to start"
						>
							<ArrowCounterClockwise size={15} />
						</button>

						{/* Loop Toggle */}
						<button
							type="button"
							onClick={() => setIsLooping((v) => !v)}
							className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
								isLooping
									? "border-[#8DDB9B]/40 bg-[#8DDB9B]/15 text-[#8DDB9B]"
									: "border-[#343A46] bg-[#15171C] text-[#717887]"
							}`}
							title={isLooping ? "Looping Enabled" : "Looping Disabled"}
						>
							<Repeat size={15} weight="bold" />
						</button>

						{/* Mute/Unmute Audio Toggle & Volume Slider */}
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								data-testid="hyperframe-transport-mute"
								onClick={() => setIsMuted((m) => !m)}
								className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
									!isMuted
										? "border-[#8DDB9B]/40 bg-[#8DDB9B]/15 text-[#8DDB9B] hover:bg-[#8DDB9B]/25"
										: "border-[#343A46] bg-[#15171C] text-[#717887] hover:text-white"
								}`}
								title={isMuted ? "Unmute Audio (Audio is Muted)" : "Mute Audio (Audio is Playing)"}
							>
								{!isMuted ? (
									<SpeakerHigh size={15} weight="bold" />
								) : (
									<SpeakerSlash size={15} weight="bold" />
								)}
							</button>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={isMuted ? 0 : volume}
								onChange={(e) => {
									const v = parseFloat(e.target.value);
									setVolume(v);
									if (v > 0 && isMuted) setIsMuted(false);
								}}
								className="w-14 h-1.5 cursor-pointer accent-[#8DDB9B] bg-[#242832] rounded"
								title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
							/>
						</div>

						{/* Timecode Current */}
						<span className="w-16 text-right font-mono text-sm font-semibold text-white">
							{currentTimeSec.toFixed(2)}s
						</span>

						{/* Timeline Range Scrubber */}
						<input
							type="range"
							data-testid="hyperframe-transport-scrubber"
							min="0"
							max={durationSec}
							step="0.01"
							value={currentTimeSec}
							onChange={(e) => {
								setIsPlaying(false);
								setCurrentTimeSec(Number.parseFloat(e.target.value));
							}}
							className="flex-1 cursor-pointer accent-[#6FA8FF] h-2 rounded-lg bg-[#242832]"
						/>

						{/* Timecode Total Duration (Click to edit) */}
						{isEditingDuration ? (
							<form
								onSubmit={(e) => {
									e.preventDefault();
									const val = parseFloat(customDurationDraft);
									if (!isNaN(val) && val > 0) handleSetDuration(val);
								}}
								className="flex items-center gap-1"
							>
								<input
									type="number"
									step="0.1"
									min="0.5"
									max="3600"
									autoFocus
									value={customDurationDraft}
									onChange={(e) => setCustomDurationDraft(e.target.value)}
									onBlur={() => {
										const val = parseFloat(customDurationDraft);
										if (!isNaN(val) && val > 0) handleSetDuration(val);
										else setIsEditingDuration(false);
									}}
									className="w-16 rounded border border-[#6FA8FF] bg-[#15171C] px-1.5 py-1 font-mono text-xs text-white outline-none"
								/>
								<span className="text-xs text-[#A8AFBD]">s</span>
							</form>
						) : (
							<button
								type="button"
								data-testid="hyperframe-total-duration-btn"
								onClick={() => {
									setCustomDurationDraft(durationSec.toFixed(1));
									setIsEditingDuration(true);
								}}
								title="Click to edit total duration in seconds"
								className="group/tottime flex items-center gap-1 rounded px-1.5 py-1 font-mono text-sm font-semibold text-[#A8AFBD] hover:bg-white/5 hover:text-white transition"
							>
								<span>{durationSec.toFixed(2)}s</span>
								<PencilSimple size={12} className="opacity-0 group-hover/tottime:opacity-100 text-[#6FA8FF]" />
							</button>
						)}

						{/* Auto-Fit Media Duration Button (Visible when media duration is detected & differs) */}
						{detectedMediaDuration && Math.abs(detectedMediaDuration - durationSec) > 0.4 && (
							<button
								type="button"
								data-testid="hyperframe-fit-media-btn"
								onClick={() => handleSetDuration(detectedMediaDuration)}
								className="flex items-center gap-1.5 rounded-lg border border-[#6FA8FF]/40 bg-[#6FA8FF]/15 px-2.5 py-1 text-xs font-semibold text-[#8cc2ff] hover:bg-[#6FA8FF]/25 hover:text-white transition shadow-sm animate-pulse"
								title={`Set timeline duration to match detected video/audio duration (${detectedMediaDuration.toFixed(1)}s)`}
							>
								<Clock size={13} weight="bold" />
								<span>Fit Media ({detectedMediaDuration.toFixed(1)}s)</span>
							</button>
						)}
					</div>
				</main>

				{/* Right Sidebar: CLI Agent & Source Code (Collapsible) */}
				{sidebarOpen && (
					<aside className="flex w-[460px] shrink-0 flex-col border-l border-[#343A46] bg-[#1C1F26] shadow-2xl z-20">
						{/* Tab Switcher */}
						<div className="flex border-b border-[#343A46] bg-[#15171C] p-2 gap-1.5">
							<button
								type="button"
								onClick={() => setActiveTab("agent")}
								className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition ${
									activeTab === "agent"
										? "border border-[#A879F5]/40 bg-[#A879F5]/15 text-white shadow-sm"
										: "text-[#A8AFBD] hover:text-white"
								}`}
							>
								<Robot size={16} weight="bold" className="text-[#A879F5]" />
								<span>CLI Agent</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab("code")}
								className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition ${
									activeTab === "code"
										? "border border-[#6FA8FF]/40 bg-[#6FA8FF]/15 text-white shadow-sm"
										: "text-[#A8AFBD] hover:text-white"
								}`}
							>
								<Code size={16} weight="bold" className="text-[#6FA8FF]" />
								<span>Source Code</span>
							</button>
						</div>

						{/* Tab 1: AI Agent Studio */}
						{activeTab === "agent" && (
							<div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
								{/* Agent Selector Card */}
								<div className="rounded-xl border border-[#343A46] bg-[#15171C] p-3.5 space-y-3">
									<div className="flex items-center justify-between">
										<label className="text-xs font-bold uppercase tracking-wider text-[#A8AFBD]">
											CLI Agent Runner
										</label>
										<div className="flex items-center gap-1.5">
											{selectedAgent?.available ? (
												<span className="inline-flex items-center gap-1 rounded-full bg-[#8DDB9B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#8DDB9B]">
													<CheckCircle size={12} weight="fill" />
													Ready
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full bg-[#F6C768]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F6C768]">
													<WarningCircle size={12} weight="fill" />
													Not in PATH
												</span>
											)}
										</div>
									</div>

									<div className="relative">
										<select
											value={selectedAgentId}
											onChange={(e) => setSelectedAgentId(e.target.value)}
											className="w-full appearance-none rounded-lg border border-[#343A46] bg-[#1C1F26] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#6FA8FF] transition"
										>
											{availableAgents.map((agent) => (
												<option key={agent.id} value={agent.id}>
													{agent.name} ({agent.command || "custom"}) {agent.available ? "✓" : ""}
												</option>
											))}
										</select>
										<CaretDown
											size={13}
											className="pointer-events-none absolute right-3 top-3 text-[#A8AFBD]"
										/>
									</div>

									{selectedAgentId === "custom" && (
										<div className="flex gap-2">
											<input
												type="text"
												value={customCommand}
												onChange={(e) => setCustomCommand(e.target.value)}
												placeholder="Binary name e.g. hermes or /usr/bin/my-cli"
												className="flex-1 rounded-lg border border-[#343A46] bg-[#1C1F26] px-3 py-1.5 text-xs text-white placeholder-[#717887] outline-none focus:border-[#6FA8FF]"
											/>
										</div>
									)}

									{/* Project Context Chips */}
									<div className="flex flex-wrap items-center gap-1.5 pt-1">
										<span className="inline-flex items-center gap-1 rounded bg-[#242832] px-2 py-0.5 text-[10px] text-[#A8AFBD] font-medium">
											<FolderOpen size={11} className="text-[#6FA8FF]" />
											{project.assets.length} {project.assets.length === 1 ? "Asset" : "Assets"}
										</span>
										<span className="rounded bg-[#242832] px-2 py-0.5 text-[10px] font-mono text-[#A8AFBD]">
											{hyperframe.width}×{hyperframe.height}
										</span>
										<span className="rounded bg-[#242832] px-2 py-0.5 text-[10px] font-mono text-[#A8AFBD]">
											{durationSec.toFixed(1)}s
										</span>
										<span className="rounded bg-[#A879F5]/20 px-2 py-0.5 text-[10px] font-mono text-[#c5a7fb]">
											GSAP 3
										</span>
									</div>
								</div>

								{/* Prompt Presets */}
								<div className="space-y-1.5">
									<span className="text-[11px] font-semibold text-[#A8AFBD]">
										Inspiration Presets:
									</span>
									<div className="flex flex-wrap gap-1.5">
										{PRESET_PROMPTS.map((p) => (
											<button
												key={p.label}
												type="button"
												onClick={() => setUserPrompt(p.prompt)}
												className="rounded-md border border-[#343A46] bg-[#15171C] px-2 py-1 text-[11px] text-[#A8AFBD] hover:border-[#A879F5]/50 hover:text-white transition"
											>
												{p.label}
											</button>
										))}
									</div>
								</div>

								{/* Prompt Input with @ Mention Autocomplete & Tagged Media Chips */}
								<div className="flex flex-col space-y-2">
									<label className="text-xs font-bold text-white">
										Instructions for Agent
									</label>
									<HyperframePromptInput
										value={userPrompt}
										onChange={setUserPrompt}
										assets={availableAssets}
										taggedAssets={taggedAssets}
										onTaggedAssetsChange={handleTaggedAssetsChange}
										disabled={isAgentRunning}
										onSubmit={handleRunAgent}
									/>

									<div className="flex items-center gap-2 pt-1">
										<button
											type="button"
											onClick={handleRunAgent}
											disabled={isAgentRunning || !userPrompt.trim()}
											className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6FA8FF] to-[#A879F5] py-2.5 text-xs font-bold text-[#15171C] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
										>
											<Sparkle size={15} weight="bold" />
											<span>{isAgentRunning ? "Running Agent..." : "Run Agent"}</span>
										</button>

										{isAgentRunning && (
											<button
												type="button"
												onClick={handleCancelAgent}
												className="rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2.5 text-xs font-bold text-red-300 hover:bg-red-500/25 transition"
											>
												Cancel
											</button>
										)}
									</div>
								</div>

								{/* Status Notices */}
								{agentError && (
									<div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
										<p className="font-semibold">Agent Error:</p>
										<p className="mt-1 font-mono text-[11px] leading-relaxed">{agentError}</p>
									</div>
								)}

								{agentSuccess && (
									<div className="flex items-center gap-2 rounded-xl border border-[#8DDB9B]/40 bg-[#8DDB9B]/10 p-3 text-xs text-[#8DDB9B]">
										<Check size={16} weight="bold" />
										<span>{agentSuccess}</span>
									</div>
								)}

								{/* Execution Logs */}
								<div className="flex flex-1 flex-col rounded-xl border border-[#343A46] bg-[#111214] overflow-hidden min-h-[140px]">
									<div className="flex items-center justify-between border-b border-[#343A46] bg-[#15171C] px-3 py-1.5 text-[11px] font-semibold text-[#A8AFBD]">
										<span>Terminal Stream Logs</span>
										{isAgentRunning && (
											<span className="flex items-center gap-1.5 text-[#6FA8FF]">
												<span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#6FA8FF]" />
												Streaming
											</span>
										)}
									</div>
									<div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-slate-300 max-h-48 select-text">
										{agentLogs.length === 0 ? (
											<span className="text-[#555E6D]">No logs yet. Run an agent prompt above.</span>
										) : (
											agentLogs.map((log, i) => (
												<div key={i} className="whitespace-pre-wrap">
													{log}
												</div>
											))
										)}
										<div ref={logsEndRef} />
									</div>
								</div>
							</div>
						)}

						{/* Tab 2: Direct Source Code Editor */}
						{activeTab === "code" && (
							<div className="flex flex-1 flex-col overflow-hidden p-4 space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-xs font-bold text-white">Direct HTML Source</span>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={handleCopyCode}
											className="flex items-center gap-1 rounded border border-[#343A46] bg-[#15171C] px-2 py-1 text-xs text-[#A8AFBD] hover:text-white transition"
											title="Copy HTML"
										>
											{codeCopied ? <Check size={12} className="text-[#8DDB9B]" /> : <Copy size={12} />}
											<span>{codeCopied ? "Copied" : "Copy"}</span>
										</button>
										<button
											type="button"
											onClick={handleApplyCode}
											className="flex items-center gap-1 rounded bg-[#6FA8FF] px-2.5 py-1 text-xs font-bold text-[#15171C] hover:bg-[#85b7ff] transition"
											title="Apply and Hot-Reload"
										>
											<FloppyDisk size={13} weight="bold" />
											<span>Apply</span>
										</button>
									</div>
								</div>

								<div className="relative flex-1 overflow-hidden rounded-xl border border-[#343A46] bg-[#111214]">
									<textarea
										data-testid="hyperframe-code-editor"
										value={codeDraft}
										onChange={(e) => setCodeDraft(e.target.value)}
										spellCheck={false}
										className="h-full w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none selection:bg-[#6FA8FF]/30 select-text"
									/>
								</div>
							</div>
						)}
					</aside>
				)}
			</div>
		</div>
	);
}
