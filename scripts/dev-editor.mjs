import { spawn } from node:child_process;

process.env.RECORDLY_DEV_OPEN_RECORDING_INPUT = true;
const child = spawn(npx, [vite, --config, vite.config.ts], {
	stdio: inherit,
	shell: true,
	env: process.env,
});

child.on(exit, (code) => {
	process.exit(code ?? 0);
});
