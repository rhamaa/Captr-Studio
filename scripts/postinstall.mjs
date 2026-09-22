import { spawnSync } from "node:child_process";
import path from "node:path";

const npmExecPath = process.env.npm_execpath;
const hasNpmExecPath = typeof npmExecPath === "string" && npmExecPath.length > 0;
const npmExecExtension = hasNpmExecPath ? path.extname(npmExecPath).toLowerCase() : "";
const npmExecIsNodeScript = hasNpmExecPath && [".js", ".cjs", ".mjs"].includes(npmExecExtension);
const npmInvoker = hasNpmExecPath
	? npmExecIsNodeScript
		? {
				command: process.execPath,
				argsPrefix: [npmExecPath],
				shell: false,
			}
		: {
				command: npmExecPath,
				argsPrefix: [],
				shell: process.platform === "win32",
			}
	: {
			command: process.platform === "win32" ? "npm.cmd" : "npm",
			argsPrefix: [],
			shell: process.platform === "win32",
		};

function runScript(scriptName) {
	console.log(`[postinstall] Running npm script: ${scriptName}`);
	const result = spawnSync(npmInvoker.command, [...npmInvoker.argsPrefix, "run", scriptName], {
		stdio: "inherit",
		env: process.env,
		shell: npmInvoker.shell,
	});

	if (result.error) {
		console.error(`[postinstall] Failed to start "${scriptName}" (${result.error.message}).`);
		return false;
	}

	if (result.signal) {
		console.error(`[postinstall] "${scriptName}" was terminated by signal ${result.signal}.`);
		return false;
	}

	if (result.status !== 0) {
		console.error(`[postinstall] "${scriptName}" exited with code ${result.status}.`);
		return false;
	}

	return true;
}

if (!runScript("rebuild:native")) {
	process.exit(1);
}

if (!runScript("build:platform-native-helpers")) {
	process.exit(1);
}
