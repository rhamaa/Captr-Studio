import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	executeMcpToolCall,
	getMcpServerInfo,
	handleJsonRpcMessage,
	setMcpProjectContext,
	startMcpServer,
	stopMcpServer,
} from "./mcpServer";
import { createTimelineProject, placeAsset, registerMedia } from "../../../src/core/timeline/commands";
import type { MediaAsset } from "../../../src/core/timeline/types";

// Mock BrowserWindow for electron
vi.mock("electron", () => ({
	BrowserWindow: {
		getAllWindows: () => [],
	},
}));

describe("mcpServer", () => {
	function createMockContext() {
		let project = createTimelineProject("mcp-proj", "MCP Project");
		const asset: MediaAsset = {
			id: "a1",
			kind: "video",
			name: "Demo.mp4",
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
			source: {
				path: "assets/a1/video.mp4",
				durationUs: 10_000_000,
				offsetUs: 0,
			},
		};
		project = registerMedia(project, asset);
		project = placeAsset(project, "a1", "visual-1", 0, { clipId: "c1" });
		return {
			project,
			transcripts: {},
			playheadUs: 2_000_000,
			selection: ["c1"],
			activeArtboardId: null,
		};
	}

	beforeAll(async () => {
		setMcpProjectContext(createMockContext());
	});

	afterAll(() => {
		stopMcpServer();
	});

	it("handles MCP initialize request", () => {
		const res = handleJsonRpcMessage({
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: { protocolVersion: "2024-11-05" },
		});

		expect(res.id).toBe(1);
		expect(res.result.serverInfo.name).toBe("captr-studio");
		expect(res.result.capabilities.tools).toBeDefined();
	});

	it("handles tools/list and returns all 8 required tools", () => {
		const res = handleJsonRpcMessage({
			jsonrpc: "2.0",
			id: 2,
			method: "tools/list",
		});

		const toolNames = res.result.tools.map((t: any) => t.name);
		expect(toolNames).toContain("get_project_context");
		expect(toolNames).toContain("propose_edit_plan");
		expect(toolNames).toContain("split_clip");
		expect(toolNames).toContain("trim_clip");
		expect(toolNames).toContain("remove_silence");
		expect(toolNames).toContain("add_broll_or_overlay");
		expect(toolNames).toContain("preview_speculative_edits");
		expect(toolNames).toContain("commit_edits");
		expect(toolNames.length).toBe(8);
	});

	it("executes get_project_context tool", async () => {
		const res = await executeMcpToolCall("get_project_context", {});
		expect(res.isError).toBeFalsy();
		const parsed = JSON.parse(res.text);
		expect(parsed.title).toBe("MCP Project");
		expect(parsed.tracks[0].clips[0].id).toBe("c1");
		expect(parsed.playhead.playheadUs).toBe(2_000_000);
	});

	it("executes propose_edit_plan tool", async () => {
		const res = await executeMcpToolCall("propose_edit_plan", {
			summary: "Trim intro and remove pauses",
			steps: ["1. Cut first 2 seconds", "2. Remove pause at 5s"],
			estimatedDurationSec: 8,
		});
		expect(res.isError).toBeFalsy();
		expect(res.text).toContain("Trim intro and remove pauses");
	});

	it("executes split_clip tool and produces speculative draft", async () => {
		const res = await executeMcpToolCall("split_clip", {
			clipId: "c1",
			atTimelineUs: 5_000_000,
		});
		expect(res.isError).toBeFalsy();
		const parsed = JSON.parse(res.text);
		expect(parsed.success).toBe(true);
		expect(parsed.leftClipId).toBe("c1");
		expect(parsed.rightClipId).toBeTruthy();
	});

	it("starts local HTTP server and responds to direct /mcp endpoint", async () => {
		const info = await startMcpServer(0); // Port 0 chooses free ephemeral port
		expect(info.running).toBe(true);
		expect(info.port).toBeGreaterThan(0);
		expect(info.sseUrl).toContain(String(info.port));

		// Direct fetch to /mcp
		const response = await fetch(`http://127.0.0.1:${info.port}/mcp`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 42,
				method: "tools/list",
			}),
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data.id).toBe(42);
		expect(data.result.tools.length).toBe(8);
	});

	it("executes trim_clip with second-based arguments", async () => {
		const res = await executeMcpToolCall("trim_clip", {
			clipId: "c1",
			sourceInSec: 1,
			sourceOutSec: 6,
		});
		expect(res.isError).toBeFalsy();
		const parsed = JSON.parse(res.text);
		expect(parsed.success).toBe(true);
		expect(parsed.clipId).toBe("c1");
	});

	it("executes add_broll_or_overlay tool", async () => {
		const res = await executeMcpToolCall("add_broll_or_overlay", {
			type: "text",
			text: "New Feature Introduction",
			startUs: 1_000_000,
			durationUs: 3_000_000,
		});
		expect(res.isError).toBeFalsy();
		const parsed = JSON.parse(res.text);
		expect(parsed.success).toBe(true);
		expect(parsed.clipId).toBeDefined();
	});

	it("executes preview_speculative_edits and commit_edits updating activeContext in memory", async () => {
		const prev = await executeMcpToolCall("preview_speculative_edits", {});
		expect(prev.isError).toBeFalsy();

		const commit = await executeMcpToolCall("commit_edits", {
			commitMessage: "Test commit",
		});
		expect(commit.isError).toBeFalsy();
		const commitParsed = JSON.parse(commit.text);
		expect(commitParsed.success).toBe(true);

		// Context in memory should reflect committed project
		const ctxRes = await executeMcpToolCall("get_project_context", {});
		const ctxParsed = JSON.parse(ctxRes.text);
		expect(ctxParsed.tracks[0].clips.length).toBeGreaterThanOrEqual(1);
	});

	it("connects to SSE endpoint and receives endpoint discovery event", async () => {
		const info = getMcpServerInfo();
		const controller = new AbortController();

		const res = await fetch(`http://127.0.0.1:${info.port}/sse`, {
			signal: controller.signal,
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/event-stream");

		const reader = res.body?.getReader();
		const chunk = await reader?.read();
		const text = new TextDecoder().decode(chunk?.value);
		expect(text).toContain("event: endpoint");
		expect(text).toContain("/message?sessionId=");

		// Extract sessionId
		const match = text.match(/sessionId=([a-zA-Z0-9_-]+)/);
		expect(match).toBeTruthy();
		const sessionId = match![1];

		// Send tools/list to /message with sessionId
		const postRes = await fetch(`http://127.0.0.1:${info.port}/message?sessionId=${sessionId}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 99,
				method: "tools/list",
			}),
		});
		expect(postRes.status).toBe(202);

		// Read response over SSE stream
		const sseChunk = await reader?.read();
		const sseText = new TextDecoder().decode(sseChunk?.value);
		expect(sseText).toContain("event: message");
		expect(sseText).toContain('"id":99');

		controller.abort();
	});
});
