import { type ChildProcess, spawn } from "node:child_process";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateVttFromTranscript } from "../../../src/core/timeline/transcriptTypes";
import { buildMediaUrl, ensureMediaServer, getMediaServerBaseUrl } from "../../mediaServer";
import { KNOWN_AGENTS, checkAgentAvailability, getAugmentedEnv } from "./agentDetector";

export interface RecordingStreamInfo {
	path: string;
	mediaUrl?: string;
	width?: number;
	height?: number;
	durationSec?: number;
}

export interface CursorTelemetrySummary {
	sampleCount: number;
	clickCount: number;
	samplesFile?: string;
	samplePreview?: Array<{ timeMs: number; cx: number; cy: number; interactionType?: string }>;
}

export interface TranscriptSummary {
	fullText: string;
	segments: Array<{ startMs: number; endMs: number; text: string }>;
}

export interface RecordingPackageDetail {
	packageId?: string;
	screen?: RecordingStreamInfo;
	webcam?: RecordingStreamInfo;
	microphone?: RecordingStreamInfo;
	system?: RecordingStreamInfo;
	cursorPath?: string;
	cursorTelemetrySummary?: CursorTelemetrySummary;
	transcript?: TranscriptSummary;
}

export interface TaggedAsset {
	id: string;
	name: string;
	kind: string;
	path?: string;
	mediaUrl?: string;
	packageId?: string;
	recordingPackage?: RecordingPackageDetail;
}

export interface HyperframeTaskContext {
	userPrompt: string;
	hyperframeName: string;
	width: number;
	height: number;
	durationSec: number;
	assetsSummary: string;
	draftFilePath: string;
	taggedAssets?: TaggedAsset[];
}

export interface RunHyperframeTaskParams {
	agentId: string;
	customCommand?: string;
	userPrompt: string;
	hyperframeId: string;
	hyperframeName: string;
	currentHtml: string;
	width: number;
	height: number;
	durationSec: number;
	taggedAssets?: TaggedAsset[];
	projectContext: {
		projectTitle: string;
		aspectRatio: string;
		assets: Array<{
			id: string;
			name: string;
			kind: string;
			path?: string;
			mediaUrl?: string;
			packageId?: string;
			durationMs?: number;
			recordingPackage?: RecordingPackageDetail;
		}>;
		packages?: any[];
		transcripts?: Record<string, any>;
	};
}

export interface RunHyperframeTaskResult {
	success: boolean;
	html?: string;
	logs: string[];
	error?: string;
}

let activeProcess: ChildProcess | null = null;

export function formatAssetDetail(a: TaggedAsset): string {
	let str = `• @${a.name} (Kind: ${a.kind}, ID: ${a.id})\n`;
	if (a.mediaUrl) {
		str += `  - Primary Media URL (USE IN HTML): "${a.mediaUrl}"\n`;
	}
	if (a.path) {
		str += `  - Local File: "${a.path}"\n`;
	}
	if (a.recordingPackage) {
		const rec = a.recordingPackage;
		str += `  - Recording Package Media & Sidecars:\n`;
		if (rec.screen) {
			const sUrl = rec.screen.mediaUrl || rec.screen.path;
			str += `    * Screen Recording Video: "${sUrl}" (${rec.screen.width ?? 1920}x${rec.screen.height ?? 1080}, ${rec.screen.durationSec ?? 0}s)\n`;
			str += `      -> HTML tag: <video src="${sUrl}" autoplay muted loop playsinline></video>\n`;
		}
		if (rec.webcam) {
			const wUrl = rec.webcam.mediaUrl || rec.webcam.path;
			str += `    * Webcam Overlay Video: "${wUrl}"\n`;
			str += `      -> HTML PiP: <video src="${wUrl}" autoplay muted loop playsinline class="webcam-pip"></video>\n`;
		}
		if (rec.microphone) {
			const mUrl = rec.microphone.mediaUrl || rec.microphone.path;
			str += `    * Microphone Voice Audio Track: "${mUrl}"\n`;
			str += `      -> HTML tag: <audio id="voiceover" src="${mUrl}" preload="auto" data-start="0" data-duration="${rec.screen?.durationSec || 10}"></audio>\n`;
		}
		if (rec.system) {
			const sUrl = rec.system.mediaUrl || rec.system.path;
			str += `    * System Audio Track: "${sUrl}"\n`;
			str += `      -> HTML tag: <audio id="system-audio" src="${sUrl}" preload="auto" data-start="0" data-duration="${rec.screen?.durationSec || 10}"></audio>\n`;
		}
		if (rec.transcript && rec.transcript.fullText) {
			str += `    * Speech Transcript & Captions: "${rec.transcript.fullText}"\n`;
			str += `      -> Timed sentence & word cues are in "transcript.json" & "captions.vtt" in workspace. Animate kinetic subtitles synced with this speech!\n`;
		}
		if (rec.cursorTelemetrySummary) {
			str += `    * Mouse Cursor Telemetry: ${rec.cursorTelemetrySummary.sampleCount} points, ${rec.cursorTelemetrySummary.clickCount} mouse clicks recorded\n`;
			str += `      -> Raw samples in "cursor_telemetry.json". You can animate custom cursor markers, spotlight zoom, or click ripple effects!\n`;
		}
	}
	if (a.kind === "audio" && a.mediaUrl) {
		str += `  - Audio Track URL (USE IN HTML): "${a.mediaUrl}"\n`;
		str += `    -> HTML tag: <audio id="audio-${a.id}" src="${a.mediaUrl}" preload="auto"></audio>\n`;
	}
	return str;
}

export function formatHyperframeTaskPrompt(ctx: HyperframeTaskContext): string {
	let taggedSection = "";
	if (ctx.taggedAssets && ctx.taggedAssets.length > 0) {
		const list = ctx.taggedAssets.map((a) => formatAssetDetail(a)).join("\n");
		taggedSection = `\n\nPRIORITY TAGGED MEDIA (CRITICAL):\nThe user explicitly tagged the following project assets to be used and animated in this Hyperframe:\n${list}\nYou MUST integrate these tagged media elements into the HTML composition:\n- Use <video src="..." autoplay loop playsinline> for video & screen recordings.\n- MANDATORY AUDIO: In Captr Studio, screen recording MP4s DO NOT contain microphone speech! The microphone voiceover is recorded in a separate companion audio file. You MUST embed <audio id="voiceover" src="..." preload="auto" data-start="0" data-duration="${ctx.durationSec}"></audio> so the speaker's voice is audible! Every <audio> element MUST have a unique id.\n- If webcam is available, you can add it as a floating picture-in-picture circle or rounded badge.\n- If transcript/captions are available, render synced animated kinetic captions.\n- If cursor telemetry is available, you can animate cursor pointers or click ripple effects.\n`;
	}

	return `You are crafting an HTML5/CSS/JavaScript video composition ("Hyperframe") for Captr Studio using HeyGen HyperFrames specifications.
The composition file is located at: "${ctx.draftFilePath}".
Composition specs: ${ctx.width}x${ctx.height} px, duration: ${ctx.durationSec}s.
Target Title: "${ctx.hyperframeName}".

Available Project Assets:
${ctx.assetsSummary}${taggedSection}

USER REQUEST:
"${ctx.userPrompt}"

CRITICAL HYPERFRAMES COMPOSITION RULES:
1. DURATION & TIMING COMPLIANCE (CRITICAL):
   - The composition duration is ${ctx.durationSec}s.
   - All animations, GSAP timeline, kinetic subtitles, and media elements MUST span the entire ${ctx.durationSec}s duration.
   - DO NOT clamp time to 5s.
   - DO NOT create self-running requestAnimationFrame loops or setInterval tickers in the page. Playback is driven exclusively by the outer player calling window.seekFrame(t).
2. LIVE PLAYING VIDEO & MANDATORY COMPANION AUDIO (CRITICAL):
   - When a video or screen recording is tagged, it MUST be embedded as a real, continuous playing <video src="..." autoplay loop playsinline></video> element.
   - In Captr Studio, screen recording MP4 files DO NOT contain microphone speech! The microphone voiceover is recorded in a separate companion audio file. If a microphone audio track or audio asset is tagged/present, you MUST embed:
     <audio id="voiceover" src="..." preload="auto" data-start="0" data-duration="${ctx.durationSec}"></audio>
     Every <audio> element MUST have a unique id attribute.
   - NEVER capture or replace video with a static image, snapshot, or canvas screenshot. The video must run as live video during the composition.
3. PRESERVE VIDEO ASPECT RATIO & CLEAN LAYOUT:
   - For screen recordings (usually 16:9), do NOT awkwardly crop or cut off parts of the screen.
   - Use 'object-fit: contain' or embed the video inside an elegant container/device mockup (e.g. browser bar mockup with mac-style traffic light dots, rounded corners, soft pastel glow shadow).
   - If designing a full-bleed video canvas, use width: 100%; height: 100%; object-fit: contain (or cover), and layer animated typography, badges, or stats on top.
4. NEVER use raw local Windows paths (e.g. "C:\\...") or "file:///" in <video src="...">, <audio src="..."> or <img src="..."> tags. Web browsers and sandboxed iframes block local file schemes for security. ALWAYS use the provided Media URL ("http://127.0.0.1:...").
5. TIMELINE SYNC ARCHITECTURE:
   - Root container: <div id="root" data-composition-id="main" data-duration="${ctx.durationSec}" style="width:100%;height:100%;">
   - Create exactly one paused GSAP timeline: const tl = gsap.timeline({ paused: true }); window.tl = tl;
   - Implement 'window.seekFrame(timeInSeconds, isPlaying)' to seek window.tl and sync media elements up to ${ctx.durationSec}s:
\`\`\`javascript
window.seekFrame = function(timeInSeconds, isPlaying) {
  const clampedTime = Math.max(0, Math.min(${ctx.durationSec}, timeInSeconds));
  if (window.tl) window.tl.seek(clampedTime);
  const mediaElements = document.querySelectorAll("video, audio");
  mediaElements.forEach(function(el) {
    if (isPlaying) {
      if (el.paused) el.play().catch(function(){});
      if (Math.abs(el.currentTime - clampedTime) > 0.25) {
        el.currentTime = clampedTime;
      }
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - clampedTime) > 0.04) {
        el.currentTime = clampedTime;
      }
    }
  });
};
window.getDuration = function() { return ${ctx.durationSec}; };
\`\`\`

INSTRUCTIONS:
1. Open and inspect "${ctx.draftFilePath}".
2. Implement the requested motion design (e.g. kinetic typography, CSS keyframes, HTML5 Canvas animation, CSS variables, glassmorphic layout, embedding videos or images).
3. Follow Captr Studio soft pastel aesthetics: soft blue (#6FA8FF), lavender (#A879F5), sage mint (#8DDB9B), honey amber (#F6C768), coral rose (#FF6B81). Avoid radioactive neon cyan.
4. Save the revised HTML code directly back to "${ctx.draftFilePath}" OR return the complete HTML inside a \`\`\`html code block in your response.`;
}

export function extractHtmlFromAgentOutput(output: string): string {
	const trimmed = output.trim();
	// Check for ```html ... ``` block
	const codeBlockMatch = trimmed.match(/```(?:html|htm)?\s*([\s\S]*?)```/i);
	if (codeBlockMatch && codeBlockMatch[1]) {
		const extracted = codeBlockMatch[1].trim();
		if (extracted.includes("<html") || extracted.includes("<!DOCTYPE") || extracted.includes("<div")) {
			return extracted;
		}
	}

	// Direct HTML detection
	if (
		trimmed.startsWith("<!DOCTYPE html") ||
		trimmed.startsWith("<html") ||
		(trimmed.includes("<body") && trimmed.includes("</body>"))
	) {
		return trimmed;
	}

	return output;
}

export function buildHyperframeAgentArgs(
	agentId: string,
	taskPrompt: string,
	workspaceDir?: string,
	defaultArgs?: string[],
): string[] {
	if (agentId === "agy") {
		const args = ["--dangerously-skip-permissions"];
		if (workspaceDir) {
			args.push("--add-dir", workspaceDir);
		}
		args.push("-p", taskPrompt);
		return args;
	}
	if (agentId === "claude") {
		return ["--dangerously-skip-permissions", "-p", taskPrompt];
	}
	if (agentId === "opencode") {
		return ["run", "--auto", taskPrompt];
	}
	if (["kiro", "trae", "cline", "hermes"].includes(agentId)) {
		return ["-p", taskPrompt];
	}
	if (defaultArgs && defaultArgs.length > 0) {
		return [...defaultArgs, taskPrompt];
	}
	return ["-p", taskPrompt];
}

/**
 * Runs a CLI agent to generate or refine a Hyperframe HTML composition.
 */
export async function runHyperframeAgentTask(
	params: RunHyperframeTaskParams,
	onLog?: (chunk: string) => void,
): Promise<RunHyperframeTaskResult> {
	if (activeProcess) {
		return {
			success: false,
			logs: [],
			error: "An agent task is already running. Please cancel or wait for it to complete.",
		};
	}

	const logs: string[] = [];
	const log = (msg: string) => {
		logs.push(msg);
		onLog?.(msg);
	};

	let tempDir: string | null = null;

	try {
		const commandName =
			params.agentId === "custom" && params.customCommand
				? params.customCommand.trim()
				: KNOWN_AGENTS.find((a) => a.id === params.agentId)?.command || params.agentId;

		const execPath = await checkAgentAvailability(commandName);
		if (!execPath) {
			return {
				success: false,
				logs,
				error: `CLI Agent binary "${commandName}" is not installed or not found in system PATH. Please verify your environment or select another agent.`,
			};
		}

		// Create dedicated workspace
		const workspaceDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "captr-hyperframe-agent-"));
		tempDir = workspaceDir;
		const draftHtmlPath = path.join(workspaceDir, "index.html");
		await fsPromises.writeFile(draftHtmlPath, params.currentHtml, "utf-8");

		// Ensure media server is ready and obtain base URL
		const baseUrl = await ensureMediaServer().catch(() => getMediaServerBaseUrl() || "");

		let rememberPathFn: ((p: string) => Promise<any>) | null = null;
		try {
			const mgr = await import("../project/manager");
			rememberPathFn = mgr.rememberApprovedLocalReadPath;
		} catch {}

		const resolveUrl = async (fp?: string): Promise<string | undefined> => {
			if (!fp) return undefined;
			try {
				if (rememberPathFn) await rememberPathFn(fp);
				if (baseUrl) return buildMediaUrl(baseUrl, fp);
			} catch {}
			return undefined;
		};

		// Helper to find package by id
		const findPackage = (pkgId?: string) => {
			if (!pkgId) return undefined;
			return (params.projectContext.packages || []).find((p: any) => p.id === pkgId);
		};

		// Enrich each asset with mediaUrl, screen, webcam, mic, cursor, and transcript
		const enrichedAssets = await Promise.all(
			(params.projectContext.assets || []).map(async (a) => {
				const pkg = findPackage(a.packageId || a.recordingPackage?.packageId);
				const screenPath = a.path || pkg?.screen?.path;
				const webcamPath = a.recordingPackage?.webcam?.path || pkg?.webcam?.path;
				const micPath = a.recordingPackage?.microphone?.path || pkg?.microphone?.path;
				const systemPath = a.recordingPackage?.system?.path || pkg?.system?.path;
				let cursorPath = a.recordingPackage?.cursorPath || pkg?.cursorPath;
				if (!cursorPath && screenPath) {
					const candidate = `${screenPath}.cursor.json`;
					try {
						await fsPromises.access(candidate);
						cursorPath = candidate;
					} catch {}
				}

				const screenMediaUrl = await resolveUrl(screenPath);
				const webcamMediaUrl = await resolveUrl(webcamPath);
				const micMediaUrl = await resolveUrl(micPath);
				const systemMediaUrl = await resolveUrl(systemPath);

				// Cursor telemetry
				let cursorTelemetrySummary = a.recordingPackage?.cursorTelemetrySummary;
				if (cursorPath) {
					try {
						if (rememberPathFn) await rememberPathFn(cursorPath);
						const raw = await fsPromises.readFile(cursorPath, "utf-8");
						const parsed = JSON.parse(raw);
						const samples = Array.isArray(parsed)
							? parsed
							: (parsed.samples || parsed.events || []);
						const clicks = samples.filter(
							(s: any) => s.interactionType === "click" || s.type === "click" || s.click,
						);
						cursorTelemetrySummary = {
							sampleCount: samples.length,
							clickCount: clicks.length,
							samplesFile: "cursor_telemetry.json",
							samplePreview: clicks.slice(0, 10).map((c: any) => ({
								timeMs: c.timeMs ?? c.t ?? 0,
								cx: c.cx ?? c.x ?? 0,
								cy: c.cy ?? c.y ?? 0,
								interactionType: c.interactionType ?? c.type ?? "click",
							})),
						};
						await fsPromises.writeFile(
							path.join(workspaceDir, "cursor_telemetry.json"),
							JSON.stringify(parsed, null, 2),
							"utf-8",
						);
					} catch {}
				}

				// Transcripts
				let transcriptSummary = a.recordingPackage?.transcript;
				try {
					let tData = params.projectContext.transcripts?.[a.id];
					if (!tData && screenPath) {
						const tCandidate = path.join(path.dirname(screenPath), "transcript.json");
						try {
							const raw = await fsPromises.readFile(tCandidate, "utf-8");
							tData = JSON.parse(raw);
						} catch {}
					}
					if (tData) {
						const fullText =
							tData.fullText ||
							(tData.segments ? tData.segments.map((s: any) => s.text).join(" ") : "");
						const segs = (tData.segments || []).map((s: any) => ({
							startMs: Math.round((s.startUs ?? s.startMs ?? 0) / (s.startUs ? 1000 : 1)),
							endMs: Math.round((s.endUs ?? s.endMs ?? 0) / (s.endUs ? 1000 : 1)),
							text: s.text || "",
						}));
						transcriptSummary = {
							fullText,
							segments: segs,
						};
						await fsPromises.writeFile(
							path.join(workspaceDir, "transcript.json"),
							JSON.stringify(tData, null, 2),
							"utf-8",
						);
						try {
							const vtt = generateVttFromTranscript(tData);
							await fsPromises.writeFile(path.join(workspaceDir, "captions.vtt"), vtt, "utf-8");
						} catch {}
					}
				} catch {}

				let recordingPackage: RecordingPackageDetail | undefined = undefined;
				if (a.kind === "recording" || pkg || webcamPath || micPath) {
					recordingPackage = {
						packageId: pkg?.id || a.packageId,
						screen: screenPath
							? {
									path: screenPath,
									mediaUrl: screenMediaUrl,
									width: pkg?.width || a.recordingPackage?.screen?.width,
									height: pkg?.height || a.recordingPackage?.screen?.height,
									durationSec:
										(pkg?.durationUs ? pkg.durationUs / 1_000_000 : undefined) ||
										(a.durationMs ? a.durationMs / 1000 : undefined),
								}
							: undefined,
						webcam: webcamPath
							? {
									path: webcamPath,
									mediaUrl: webcamMediaUrl,
								}
							: undefined,
						microphone: micPath
							? {
									path: micPath,
									mediaUrl: micMediaUrl,
								}
							: undefined,
						system: systemPath
							? {
									path: systemPath,
									mediaUrl: systemMediaUrl,
								}
							: undefined,
						cursorPath,
						cursorTelemetrySummary,
						transcript: transcriptSummary,
					};
				}

				return {
					...a,
					path: screenPath ?? a.path,
					mediaUrl: screenMediaUrl ?? (await resolveUrl(a.path)),
					recordingPackage,
				};
			}),
		);

		// Synchronize tagged assets with enriched data
		const enrichedTaggedAssets: TaggedAsset[] = (params.taggedAssets || []).map((ta) => {
			const matching = enrichedAssets.find((ea) => ea.id === ta.id || ea.name === ta.name);
			if (matching) {
				return {
					...ta,
					path: matching.path ?? ta.path,
					mediaUrl: matching.mediaUrl ?? ta.mediaUrl,
					recordingPackage: matching.recordingPackage ?? ta.recordingPackage,
				};
			}
			return ta;
		});

		// Summarize assets for prompt
		const assetsSummary =
			enrichedAssets.length > 0
				? enrichedAssets.map((a) => formatAssetDetail(a)).join("\n")
				: "No media assets";

		// Calculate effective duration: if tagged asset has known duration, use it
		let effectiveDurationSec = params.durationSec;
		for (const ta of enrichedTaggedAssets) {
			const d = ta.recordingPackage?.screen?.durationSec;
			if (d && d > 0 && (effectiveDurationSec === 5 || d > effectiveDurationSec)) {
				effectiveDurationSec = Math.round(d * 10) / 10;
			}
		}

		// Write PROJECT_ASSETS.json
		await fsPromises.writeFile(
			path.join(workspaceDir, "PROJECT_ASSETS.json"),
			JSON.stringify(
				{
					projectTitle: params.projectContext.projectTitle,
					aspectRatio: params.projectContext.aspectRatio,
					width: params.width,
					height: params.height,
					durationSec: effectiveDurationSec,
					taggedAssets: enrichedTaggedAssets,
					assets: enrichedAssets,
					transcripts: params.projectContext.transcripts,
				},
				null,
				2,
			),
			"utf-8",
		);

		const taskPrompt = formatHyperframeTaskPrompt({
			userPrompt: params.userPrompt,
			hyperframeName: params.hyperframeName,
			width: params.width,
			height: params.height,
			durationSec: effectiveDurationSec,
			assetsSummary,
			draftFilePath: draftHtmlPath,
			taggedAssets: enrichedTaggedAssets,
		});

		const defaultArgs = KNOWN_AGENTS.find((a) => a.id === params.agentId)?.defaultArgs;
		const args = buildHyperframeAgentArgs(params.agentId, taskPrompt, workspaceDir, defaultArgs);

		// Write TASK.md in workspace so agent can also inspect full task spec directly
		await fsPromises.writeFile(path.join(workspaceDir, "TASK.md"), taskPrompt, "utf-8");

		log(`[Captr Studio] Spawning ${execPath} in ${workspaceDir}…`);

		let combinedStdout = "";
		let combinedStderr = "";

		// Windows: If command is an .exe, run without cmd.exe shell so arguments aren't broken by cmd.exe word-splitting
		const useShell =
			process.platform === "win32" && !execPath.toLowerCase().endsWith(".exe");

		const exitCode = await new Promise<number | null>((resolve) => {
			const child = spawn(execPath, args, {
				cwd: workspaceDir,
				env: {
					...getAugmentedEnv(),
					FORCE_COLOR: "0",
				},
				shell: useShell,
				stdio: ["ignore", "pipe", "pipe"],
			}) as ChildProcess;
			activeProcess = child;

			child.stdout?.on("data", (chunk: Buffer) => {
				const str = chunk.toString("utf-8");
				combinedStdout += str;
				log(str);
			});

			child.stderr?.on("data", (chunk: Buffer) => {
				const str = chunk.toString("utf-8");
				combinedStderr += str;
				log(str);
			});

			child.on("close", (code: number | null) => {
				activeProcess = null;
				resolve(code);
			});

			child.on("error", (err: Error) => {
				activeProcess = null;
				log(`Process error: ${err.message}`);
				resolve(1);
			});
		});

		// Check if index.html was modified on disk
		let finalHtml: string | null = null;
		try {
			const onDisk = await fsPromises.readFile(draftHtmlPath, "utf-8");
			if (onDisk.trim() && onDisk !== params.currentHtml) {
				finalHtml = onDisk;
			}
		} catch {}

		// Fallback: extract HTML from stdout
		if (!finalHtml) {
			const extracted = extractHtmlFromAgentOutput(combinedStdout);
			if (extracted && extracted !== combinedStdout && extracted.includes("<html")) {
				finalHtml = extracted;
			} else if (extracted.includes("<!DOCTYPE") || extracted.includes("<html")) {
				finalHtml = extracted;
			}
		}

		if (!finalHtml) {
			// If exitCode was 0 but no HTML changed, return error or original with notice
			if (exitCode === 0) {
				return {
					success: false,
					logs,
					error: "Agent completed but did not produce modified HTML output.",
				};
			}
			return {
				success: false,
				logs,
				error: combinedStderr || `Agent exited with code ${exitCode}`,
			};
		}

		return {
			success: true,
			html: finalHtml,
			logs,
		};
	} catch (err) {
		return {
			success: false,
			logs,
			error: String(err),
		};
	} finally {
		if (tempDir) {
			await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
		}
	}
}

export function cancelActiveHyperframeAgentTask(): boolean {
	if (activeProcess) {
		activeProcess.kill();
		activeProcess = null;
		return true;
	}
	return false;
}
