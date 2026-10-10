import http from "node:http";
import { BrowserWindow } from "electron";
import {
	applyAddBRollOrOverlay,
	applyRemoveSilence,
	applySplitClip,
	applyTrimClip,
	type BRollOrOverlaySpec,
	formatProjectContext,
	summarizeProjectDiff,
} from "../../../src/core/timeline/agentTools";
import {
	applyStoryCommand,
	getStoryEditProject,
	getStoryProject,
	type StoryEditContext,
	type StoryEditPlan,
	sameStoryEditContext,
} from "../../../src/core/timeline/storyOwnership";
import type { AssetTranscript } from "../../../src/core/timeline/transcriptTypes";
import type { TimelineProject } from "../../../src/core/timeline/types";
import { validateTimelineProject } from "../../../src/core/timeline/validation";

export interface ActiveProjectContext {
	editContext: StoryEditContext;
	project: TimelineProject;
	transcripts: Record<string, AssetTranscript>;
	playheadUs: number;
	selection: string[];
	activeArtboardId: string | null;
}

export interface McpServerInfo {
	running: boolean;
	port: number;
	endpoint: string;
	sseUrl: string;
	mcpConfig: Record<string, unknown>;
	activeClientsCount: number;
}

export type EditPlan = StoryEditPlan;

const DEFAULT_MCP_PORT = 39420;
let mcpHttpServer: http.Server | null = null;
let currentPort = DEFAULT_MCP_PORT;
let activeContext: ActiveProjectContext | null = null;
let speculativeProject: TimelineProject | null = null;
let speculativeContext: StoryEditContext | undefined;
let activePlan: EditPlan | null = null;

interface SseSession {
	id: string;
	res: http.ServerResponse;
}

const sseSessions = new Map<string, SseSession>();

export function setMcpProjectContext(context: ActiveProjectContext): void {
	if (speculativeContext) {
		let current = sameStoryEditContext(speculativeContext, context.editContext);
		if (current) {
			try {
				getStoryProject(context.project, speculativeContext.scope);
			} catch {
				current = false;
			}
		}
		if (!current) clearSpeculativeProject();
	}
	activeContext = structuredClone(context);
}

export function getMcpProjectContext(): ActiveProjectContext | null {
	return activeContext;
}

export function getActiveEditPlan(): EditPlan | null {
	return activePlan;
}

export function clearSpeculativeProject(): void {
	speculativeProject = null;
	speculativeContext = undefined;
	activePlan = null;
	broadcastToRenderers("agent:speculative-preview", null);
	broadcastToRenderers("agent:edit-plan", null);
}

export function getSpeculativeProject(): TimelineProject | null {
	return speculativeProject;
}

export function setSpeculativeProject(
	project: TimelineProject | null,
	diff?: import("../../../src/core/timeline/agentPayload").AgentDiffSummary,
	context?: StoryEditContext,
): void {
	if (project && activeContext?.project) {
		if (!sameStoryEditContext(context, activeContext.editContext))
			throw new Error("Stale Story edit context");
		speculativeProject = applyStoryCommand(
			activeContext.project,
			context!.scope,
			() => project,
		);
		speculativeContext = structuredClone(context);
		const d =
			diff ??
			summarizeProjectDiff(getStoryProject(activeContext.project, context!.scope), project);
		broadcastToRenderers("agent:speculative-preview", {
			project,
			context,
			diff: d,
		});
	} else if (!project) {
		speculativeProject = null;
		speculativeContext = undefined;
		broadcastToRenderers("agent:speculative-preview", null);
	}
}

function broadcastToRenderers(channel: string, payload: unknown) {
	try {
		for (const win of BrowserWindow.getAllWindows()) {
			if (!win.isDestroyed()) {
				win.webContents.send(channel, payload);
			}
		}
	} catch {}
}

const MCP_TOOLS = [
	{
		name: "get_project_context",
		description:
			"Returns the complete active Captr Studio project context including canvas, tracks, clips, assets, speech transcripts with word timestamps, artboards, whiteboard notes, current playhead, and selection.",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "propose_edit_plan",
		description:
			"Proposes a structured editing plan for Captr Studio with summary and step-by-step actions. Displayed to user in Copilot Dock.",
		inputSchema: {
			type: "object",
			required: ["summary", "steps"],
			properties: {
				summary: { type: "string", description: "Brief summary of planned edits" },
				steps: {
					type: "array",
					items: { type: "string" },
					description: "Sequential list of edit actions",
				},
				estimatedDurationSec: {
					type: "number",
					description: "Estimated final video duration in seconds",
				},
			},
		},
	},
	{
		name: "split_clip",
		description:
			"Splits a timeline clip into two contiguous clips at a specified timeline timestamp in microseconds or seconds.",
		inputSchema: {
			type: "object",
			required: ["clipId"],
			properties: {
				clipId: { type: "string", description: "ID of the clip to split" },
				atTimelineUs: {
					type: "number",
					description: "Timeline timestamp in microseconds at which to split",
				},
				atRelativeSec: {
					type: "number",
					description: "Relative seconds from clip start at which to split",
				},
			},
		},
	},
	{
		name: "trim_clip",
		description: "Trims a clip's in-point, out-point, or timeline start position.",
		inputSchema: {
			type: "object",
			required: ["clipId"],
			properties: {
				clipId: { type: "string", description: "ID of the clip to trim" },
				sourceInUs: {
					type: "number",
					description: "Source in-point in microseconds",
				},
				sourceOutUs: {
					type: "number",
					description: "Source out-point in microseconds",
				},
				startUs: {
					type: "number",
					description: "New timeline start position in microseconds",
				},
			},
		},
	},
	{
		name: "remove_silence",
		description:
			"Analyzes speech transcripts or audio to remove pauses/silence segments from timeline clips, rippling subsequent clips automatically.",
		inputSchema: {
			type: "object",
			properties: {
				assetId: {
					type: "string",
					description: "Optional asset ID to restrict silence removal to",
				},
				minDurationMs: {
					type: "number",
					description: "Minimum pause duration in ms to treat as silence (default 800ms)",
				},
				targetClipIds: {
					type: "array",
					items: { type: "string" },
					description: "Optional list of clip IDs to process",
				},
			},
		},
	},
	{
		name: "add_broll_or_overlay",
		description:
			"Inserts a B-Roll graphic, kinetic typography, callout card, text overlay, or library asset onto the timeline.",
		inputSchema: {
			type: "object",
			required: ["startUs", "durationUs"],
			properties: {
				type: {
					type: "string",
					enum: ["hyperframe", "text", "shape", "asset"],
					description: "Type of overlay to add",
				},
				title: { type: "string", description: "Title or text content" },
				subtitle: { type: "string", description: "Optional subtitle" },
				text: { type: "string", description: "Overlay text body" },
				shapeDefinition: {
					type: "object",
					description: "Inline rectangle, ellipse, line or arrow definition with style",
				},
				assetId: { type: "string", description: "Asset ID if type is asset" },
				trackId: { type: "string", description: "Target visual track ID" },
				startUs: {
					type: "number",
					description: "Timeline start position in microseconds",
				},
				durationUs: {
					type: "number",
					description: "Duration of overlay in microseconds",
				},
				theme: { type: "string", description: "Visual theme (e.g. dark_modern)" },
			},
		},
	},
	{
		name: "preview_speculative_edits",
		description:
			"Updates the speculative ghost timeline preview in Captr Studio without permanently modifying the project, allowing the user to inspect changes before committing.",
		inputSchema: {
			type: "object",
			properties: {
				project: {
					type: "object",
					description: "Optional full TimelineProject object to set as speculative draft",
				},
			},
		},
	},
	{
		name: "commit_edits",
		description:
			"Commits proposed timeline edits into the active project via ProjectController.execute, maintaining undo/redo history.",
		inputSchema: {
			type: "object",
			properties: {
				project: {
					type: "object",
					description:
						"Optional TimelineProject to commit. If omitted, commits current speculative draft.",
				},
				commitMessage: {
					type: "string",
					description: "Optional description of committed edits",
				},
			},
		},
	},
];

export async function executeMcpToolCall(
	name: string,
	args: Record<string, any> = {},
): Promise<{ text: string; isError?: boolean }> {
	if (!activeContext || !activeContext.project) {
		return {
			text: "Error: No active Captr Studio project open. Open a project first.",
			isError: true,
		};
	}

	if (name !== "get_project_context" && !args.editContext)
		return {
			text: "Edit proposals require their captured Story editContext from get_project_context.",
			isError: true,
		};
	const proposalContext =
		(args.editContext as StoryEditContext | undefined) ??
		speculativeContext ??
		activeContext.editContext;
	if (!sameStoryEditContext(proposalContext, activeContext.editContext))
		return {
			text: "Stale Story edit context. Refresh project context before proposing edits.",
			isError: true,
		};
	const baseRoot = speculativeProject ?? activeContext.project;
	let baseProject: TimelineProject;
	try {
		getStoryEditProject(activeContext.project, proposalContext.scope);
		baseProject = getStoryEditProject(baseRoot, proposalContext.scope);
	} catch (error) {
		return { text: String(error), isError: true };
	}
	const propose = (view: TimelineProject) => {
		speculativeProject = applyStoryCommand(baseRoot, proposalContext.scope, () => view);
		speculativeContext = structuredClone(proposalContext);
	};

	switch (name) {
		case "get_project_context": {
			const summary = formatProjectContext(baseProject, activeContext.transcripts, {
				playheadUs: activeContext.playheadUs,
				selection: activeContext.selection,
				activeArtboardId: activeContext.activeArtboardId,
				editContext: activeContext.editContext,
			});
			return {
				text: JSON.stringify(summary, null, 2),
			};
		}

		case "propose_edit_plan": {
			speculativeContext = structuredClone(proposalContext);
			const plan: EditPlan = {
				context: structuredClone(proposalContext),
				summary: String(args.summary || "Edit plan"),
				steps: Array.isArray(args.steps) ? args.steps.map(String) : [],
				estimatedDurationSec:
					typeof args.estimatedDurationSec === "number"
						? args.estimatedDurationSec
						: undefined,
				createdAt: new Date().toISOString(),
			};
			activePlan = plan;
			broadcastToRenderers("agent:edit-plan", plan);
			return {
				text: `Proposed edit plan: "${plan.summary}" with ${plan.steps.length} steps.`,
			};
		}

		case "split_clip": {
			const clipId = String(args.clipId);
			let atUs: number | undefined;

			if (typeof args.atTimelineUs === "number") {
				atUs = Math.round(args.atTimelineUs);
			} else if (typeof args.atTimelineSec === "number" || typeof args.atSec === "number") {
				atUs = Math.round(((args.atTimelineSec ?? args.atSec) as number) * 1_000_000);
			} else if (typeof args.atRelativeSec === "number") {
				// Find clip start
				const clip = baseProject.tracks
					.flatMap((t) => t.clips)
					.find((c) => c.id === clipId);
				if (!clip) {
					return { text: `Error: Clip "${clipId}" not found`, isError: true };
				}
				atUs = Math.round(clip.startUs + args.atRelativeSec * 1_000_000);
			}

			if (atUs === undefined) {
				return {
					text: "Error: Must provide atTimelineUs, atTimelineSec, or atRelativeSec",
					isError: true,
				};
			}

			try {
				const res = applySplitClip(baseProject, clipId, atUs);
				propose(res.project);
				const diff = summarizeProjectDiff(
					getStoryEditProject(activeContext.project, proposalContext.scope),
					getStoryEditProject(speculativeProject!, proposalContext.scope),
				);
				broadcastToRenderers("agent:speculative-preview", {
					project: getStoryEditProject(speculativeProject!, proposalContext.scope),
					context: proposalContext,
					diff,
				});
				return {
					text: JSON.stringify({
						success: true,
						leftClipId: res.leftClipId,
						rightClipId: res.rightClipId,
						splitAtUs: atUs,
					}),
				};
			} catch (err) {
				return {
					text: `Split failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
			}
		}

		case "trim_clip": {
			const clipId = String(args.clipId);
			const sourceInUs =
				typeof args.sourceInUs === "number"
					? Math.round(args.sourceInUs)
					: typeof args.sourceInSec === "number"
						? Math.round(args.sourceInSec * 1_000_000)
						: undefined;
			const sourceOutUs =
				typeof args.sourceOutUs === "number"
					? Math.round(args.sourceOutUs)
					: typeof args.sourceOutSec === "number"
						? Math.round(args.sourceOutSec * 1_000_000)
						: undefined;
			const startUs =
				typeof args.startUs === "number"
					? Math.round(args.startUs)
					: typeof args.startSec === "number"
						? Math.round(args.startSec * 1_000_000)
						: undefined;

			try {
				const updated = applyTrimClip(baseProject, clipId, {
					sourceInUs,
					sourceOutUs,
					startUs,
				});
				propose(updated);
				const diff = summarizeProjectDiff(
					getStoryEditProject(activeContext.project, proposalContext.scope),
					getStoryEditProject(speculativeProject!, proposalContext.scope),
				);
				broadcastToRenderers("agent:speculative-preview", {
					project: getStoryEditProject(speculativeProject!, proposalContext.scope),
					context: proposalContext,
					diff,
				});
				return {
					text: JSON.stringify({ success: true, clipId }),
				};
			} catch (err) {
				return {
					text: `Trim failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
			}
		}

		case "remove_silence": {
			try {
				const res = applyRemoveSilence(baseProject, activeContext.transcripts, {
					assetId: args.assetId ? String(args.assetId) : undefined,
					minDurationMs:
						typeof args.minDurationMs === "number" ? args.minDurationMs : 800,
					targetClipIds: Array.isArray(args.targetClipIds)
						? args.targetClipIds.map(String)
						: undefined,
				});
				propose(res.project);
				const diff = summarizeProjectDiff(
					getStoryEditProject(activeContext.project, proposalContext.scope),
					getStoryEditProject(speculativeProject!, proposalContext.scope),
				);
				broadcastToRenderers("agent:speculative-preview", {
					project: getStoryEditProject(speculativeProject!, proposalContext.scope),
					context: proposalContext,
					diff,
				});
				return {
					text: JSON.stringify({
						success: true,
						cutsCount: res.cutsCount,
						savedDurationSec: Number((res.savedDurationUs / 1_000_000).toFixed(2)),
					}),
				};
			} catch (err) {
				return {
					text: `Remove silence failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
			}
		}

		case "add_broll_or_overlay": {
			try {
				const spec: BRollOrOverlaySpec = {
					shapeDefinition: args.shapeDefinition,
					type: args.type || "text",
					title: args.title ? String(args.title) : undefined,
					subtitle: args.subtitle ? String(args.subtitle) : undefined,
					text: args.text ? String(args.text) : undefined,
					assetId: args.assetId ? String(args.assetId) : undefined,
					trackId: args.trackId ? String(args.trackId) : undefined,
					startUs: typeof args.startUs === "number" ? Math.round(args.startUs) : 0,
					durationUs:
						typeof args.durationUs === "number"
							? Math.round(args.durationUs)
							: 3_000_000,
					theme: args.theme ? String(args.theme) : undefined,
				};
				const res = applyAddBRollOrOverlay(baseProject, spec);
				propose(res.project);
				const diff = summarizeProjectDiff(
					getStoryEditProject(activeContext.project, proposalContext.scope),
					getStoryEditProject(speculativeProject!, proposalContext.scope),
				);
				broadcastToRenderers("agent:speculative-preview", {
					project: getStoryEditProject(speculativeProject!, proposalContext.scope),
					context: proposalContext,
					diff,
				});
				return {
					text: JSON.stringify({
						success: true,
						clipId: res.clipId,
						trackId: res.trackId,
					}),
				};
			} catch (err) {
				return {
					text: `Add overlay failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
			}
		}

		case "preview_speculative_edits": {
			try {
				let targetProject = baseProject;
				if (args.project && typeof args.project === "object") {
					targetProject = validateTimelineProject(args.project as TimelineProject);
				}
				propose(targetProject);
				const diff = summarizeProjectDiff(
					getStoryEditProject(activeContext.project, proposalContext.scope),
					getStoryEditProject(speculativeProject!, proposalContext.scope),
				);
				broadcastToRenderers("agent:speculative-preview", {
					project: getStoryEditProject(speculativeProject!, proposalContext.scope),
					context: proposalContext,
					diff,
				});
				return {
					text: JSON.stringify({
						success: true,
						diff,
					}),
				};
			} catch (err) {
				return {
					text: `Speculative preview failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
			}
		}

		case "commit_edits": {
			try {
				let toCommit: TimelineProject | null = null;
				if (args.project && typeof args.project === "object") {
					toCommit = applyStoryCommand(baseRoot, proposalContext.scope, () =>
						validateTimelineProject(args.project as TimelineProject),
					);
				} else if (speculativeProject) {
					toCommit = speculativeProject;
				}

				if (!toCommit) {
					return {
						text: "Error: No speculative edits or project provided to commit",
						isError: true,
					};
				}

				broadcastToRenderers("agent:commit-edits", {
					project: getStoryEditProject(toCommit, proposalContext.scope),
					context: proposalContext,
					commitMessage: args.commitMessage || "Agent edits committed",
				});
				speculativeProject = null;
				return {
					text: JSON.stringify({
						success: true,
						committedClipsCount: toCommit.tracks.reduce(
							(acc, t) => acc + t.clips.length,
							0,
						),
					}),
				};
			} catch (err) {
				return {
					text: `Commit failed: ${err instanceof Error ? err.message : String(err)}`,
					isError: true,
				};
			}
		}

		default:
			return {
				text: `Error: Unknown tool "${name}"`,
				isError: true,
			};
	}
}

export function handleJsonRpcMessage(message: any): any {
	if (!message || typeof message !== "object") {
		return {
			jsonrpc: "2.0",
			id: null,
			error: { code: -32700, message: "Parse error" },
		};
	}

	const id = message.id ?? null;
	const method = message.method;

	if (method === "initialize") {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				protocolVersion: "2024-11-05",
				capabilities: {
					tools: {},
				},
				serverInfo: {
					name: "captr-studio",
					version: "1.4.0",
				},
			},
		};
	}

	if (method === "notifications/initialized") {
		return null; // Notifications have no response
	}

	if (method === "ping") {
		return {
			jsonrpc: "2.0",
			id,
			result: {},
		};
	}

	if (method === "tools/list") {
		return {
			jsonrpc: "2.0",
			id,
			result: {
				tools: MCP_TOOLS.map((tool) => ({
					...tool,
					inputSchema: {
						...tool.inputSchema,
						required: [
							...(("required" in tool.inputSchema ? tool.inputSchema.required : []) ??
								[]),
							...(tool.name === "get_project_context" ? [] : ["editContext"]),
						],
						properties: {
							...tool.inputSchema.properties,
							editContext: {
								type: "object",
								description:
									"Exact scope, projectId, generation and revision captured from get_project_context when the proposal began",
							},
						},
					},
				})),
			},
		};
	}

	if (method === "tools/call") {
		const toolName = message.params?.name;
		const toolArgs = message.params?.arguments || {};
		return (async () => {
			const res = await executeMcpToolCall(toolName, toolArgs);
			return {
				jsonrpc: "2.0",
				id,
				result: {
					content: [
						{
							type: "text",
							text: res.text,
						},
					],
					isError: res.isError || false,
				},
			};
		})();
	}

	return {
		jsonrpc: "2.0",
		id,
		error: { code: -32601, message: `Method "${method}" not found` },
	};
}

export async function startMcpServer(desiredPort = DEFAULT_MCP_PORT): Promise<McpServerInfo> {
	if (mcpHttpServer) {
		return getMcpServerInfo();
	}

	return new Promise((resolve, reject) => {
		const server = http.createServer(async (req, res) => {
			// CORS headers for external tools & local browser access
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

			if (req.method === "OPTIONS") {
				res.writeHead(200);
				res.end();
				return;
			}

			const urlObj = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
			const pathname = urlObj.pathname;

			if (pathname === "/health" || pathname === "/status") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify(getMcpServerInfo()));
				return;
			}

			// SSE Endpoint
			if (pathname === "/sse" && req.method === "GET") {
				const sessionId = `mcp-sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});

				const session: SseSession = { id: sessionId, res };
				sseSessions.set(sessionId, session);

				const keepAliveTimer = setInterval(() => {
					try {
						res.write(": keepalive\r\n\r\n");
					} catch {}
				}, 15000);

				req.on("close", () => {
					clearInterval(keepAliveTimer);
					sseSessions.delete(sessionId);
				});

				// Send endpoint event as per MCP specification
				res.write(`event: endpoint\r\ndata: /message?sessionId=${sessionId}\r\n\r\n`);
				return;
			}

			// POST /message?sessionId=... for SSE transport
			if (pathname === "/message" && req.method === "POST") {
				const sessionId = urlObj.searchParams.get("sessionId");
				if (!sessionId || !sseSessions.has(sessionId)) {
					res.writeHead(404, { "Content-Type": "application/json" });
					res.end(
						JSON.stringify({
							error: `Session "${sessionId}" not found or disconnected`,
						}),
					);
					return;
				}
				const session = sseSessions.get(sessionId)!;

				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});

				req.on("end", async () => {
					try {
						const jsonMsg = JSON.parse(body);
						const responsePromiseOrObj = handleJsonRpcMessage(jsonMsg);
						const response = await Promise.resolve(responsePromiseOrObj);

						if (response && session) {
							session.res.write(
								`event: message\r\ndata: ${JSON.stringify(response)}\r\n\r\n`,
							);
						}

						res.writeHead(202, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ status: "accepted" }));
					} catch (err) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Invalid JSON" }));
					}
				});
				return;
			}

			// POST /mcp - direct JSON-RPC endpoint
			if (pathname === "/mcp" && req.method === "POST") {
				let body = "";
				req.on("data", (chunk) => {
					body += chunk;
				});

				req.on("end", async () => {
					try {
						const jsonMsg = JSON.parse(body);
						const responsePromiseOrObj = handleJsonRpcMessage(jsonMsg);
						const response = await Promise.resolve(responsePromiseOrObj);
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify(response || {}));
					} catch (err) {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "Invalid JSON" }));
					}
				});
				return;
			}

			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("Not Found");
		});

		server.on("error", (err: any) => {
			if (err.code === "EADDRINUSE" && desiredPort !== 0) {
				// Retry on dynamic free port
				try {
					server.close();
				} catch {}
				mcpHttpServer = null;
				startMcpServer(0).then(resolve).catch(reject);
			} else {
				reject(err);
			}
		});

		server.listen(desiredPort, "127.0.0.1", () => {
			const addr = server.address() as any;
			currentPort = addr.port;
			mcpHttpServer = server;
			resolve(getMcpServerInfo());
		});
	});
}

export function stopMcpServer(): void {
	if (mcpHttpServer) {
		mcpHttpServer.close();
		mcpHttpServer = null;
		sseSessions.clear();
	}
}

export function getMcpServerInfo(): McpServerInfo {
	const running = Boolean(mcpHttpServer);
	const port = currentPort;
	const sseUrl = `http://127.0.0.1:${port}/sse`;
	const endpoint = `http://127.0.0.1:${port}/mcp`;
	const mcpConfig = {
		mcpServers: {
			captr: {
				url: sseUrl,
			},
		},
	};

	return {
		running,
		port,
		endpoint,
		sseUrl,
		mcpConfig,
		activeClientsCount: sseSessions.size,
	};
}
