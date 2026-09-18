import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const child = spawn(
	process.execPath,
	[
		fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url)),
		"--config",
		"vite.config.ts",
	],
	{
		stdio: "inherit",
		env: {
			...process.env,
			RECORDLY_DEV_OPEN_EDITOR: "1",
			...(process.argv[2] ? { RECORDLY_DEV_OPEN_RECORDING_INPUT: process.argv[2] } : {}),
		},
	},
);
child.on("error", (error) => {
	console.error("Unable to start the editor:", error);
	process.exitCode = 1;
});
child.on("exit", (code) => {
	process.exit(code ?? 0);
});
