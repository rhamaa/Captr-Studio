import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import {
	formatNativeHelperManifestWarning,
	updateNativeHelperManifest,
	verifyNativeHelperManifest,
} from "./native-helper-manifest.mjs";

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, "electron", "native", "gpu-export-probe");
const buildDir = path.join(sourceDir, "build");
const bundledDir = path.join(
	projectRoot,
	"electron",
	"native",
	"bin",
	process.arch === "arm64" ? "win32-arm64" : "win32-x64",
);
const bundledExePath = path.join(bundledDir, "recordly-gpu-export.exe");
const helperId = "recordly-gpu-export";
const generatorArch = process.arch === "arm64" ? "ARM64" : "x64";

if (process.platform !== "win32") {
	console.log("[build-windows-gpu-export] Skipping Windows GPU export helper build.");
	process.exit(0);
}

if (!existsSync(path.join(sourceDir, "CMakeLists.txt"))) {
	console.error("[build-windows-gpu-export] CMakeLists.txt not found at", sourceDir);
	process.exit(1);
}

function findCmake() {
	try {
		execSync("cmake --version", { stdio: "pipe" });
		return "cmake";
	} catch {
		// Continue probing common Windows install locations.
	}

	const standaloneCmakePaths = [
		path.join("C:", "Program Files", "CMake", "bin", "cmake.exe"),
		path.join("C:", "Program Files (x86)", "CMake", "bin", "cmake.exe"),
	];
	for (const cmakePath of standaloneCmakePaths) {
		if (existsSync(cmakePath)) {
			return `"${cmakePath}"`;
		}
	}

	// VS bundled CMake
	const vsRoots = [
		path.join("C:", "Program Files", "Microsoft Visual Studio"),
		path.join("C:", "Program Files (x86)", "Microsoft Visual Studio"),
	];
	const vsEditions = ["Preview", "Community", "Professional", "Enterprise", "BuildTools"];
	const vsVersions = ["18", "2026", "2022", "2019"];
	for (const root of vsRoots) {
		for (const version of vsVersions) {
			for (const edition of vsEditions) {
				const cmakePath = path.join(
					root,
					version,
					edition,
					"Common7",
					"IDE",
					"CommonExtensions",
					"Microsoft",
					"CMake",
					"CMake",
					"bin",
					"cmake.exe",
				);
				if (existsSync(cmakePath)) {
					return `"${cmakePath}"`;
				}
			}
		}
	}

	return null;
}

function fallbackToBundledHelperOrExit(reason) {
	if (existsSync(bundledExePath)) {
		const verification = verifyNativeHelperManifest({
			projectRoot,
			helperId,
			sourceDir,
			binaryPath: bundledExePath,
			binaryName: "recordly-gpu-export.exe",
		});
		if (!verification.ok) {
			console.warn(
				formatNativeHelperManifestWarning("build-windows-gpu-export", verification),
			);
		}
		console.warn(`[build-windows-gpu-export] ${reason}`);
		console.log(`[build-windows-gpu-export] Using bundled helper: ${bundledExePath}`);
		process.exit(0);
	}

	console.error(`[build-windows-gpu-export] ${reason}`);
	process.exit(1);
}

const cmake = findCmake();
if (!cmake) {
	fallbackToBundledHelperOrExit(
		"CMake not found. Install Visual Studio with C++ CMake tools or standalone CMake.",
	);
}

mkdirSync(buildDir, { recursive: true });

function clearCmakeCache() {
	rmSync(path.join(buildDir, "CMakeCache.txt"), { force: true });
	rmSync(path.join(buildDir, "CMakeFiles"), { recursive: true, force: true });
}

console.log("[build-windows-gpu-export] Configuring CMake...");
const vsGenerators = ["Visual Studio 18 2026", "Visual Studio 17 2022", "Visual Studio 16 2019"];

let configured = false;
for (const gen of vsGenerators) {
	try {
		clearCmakeCache();
		execSync(`${cmake} .. -G "${gen}" -A ${generatorArch}`, {
			cwd: buildDir,
			stdio: "inherit",
			timeout: 120000,
		});
		configured = true;
		break;
	} catch {
		console.log(`[build-windows-gpu-export] Generator "${gen}" failed, trying next...`);
	}
}

if (!configured) {
	fallbackToBundledHelperOrExit("CMake configure failed with all Visual Studio generators.");
}

console.log("[build-windows-gpu-export] Building Windows GPU export helper...");
try {
	execSync(`${cmake} --build . --config Release`, {
		cwd: buildDir,
		stdio: "inherit",
		timeout: 300000,
	});
} catch (error) {
	fallbackToBundledHelperOrExit(`Build failed: ${error.message}`);
}

const exePath = path.join(buildDir, "Release", "gpu-export-probe.exe");
if (!existsSync(exePath)) {
	fallbackToBundledHelperOrExit(`Expected exe not found at ${exePath}`);
}

mkdirSync(bundledDir, { recursive: true });
copyFileSync(exePath, bundledExePath);
console.log(`[build-windows-gpu-export] Staged bundled helper: ${bundledExePath}`);
const manifestPath = updateNativeHelperManifest({
	projectRoot,
	helperId,
	sourceDir,
	binaryPath: bundledExePath,
	binaryName: "recordly-gpu-export.exe",
});
console.log(`[build-windows-gpu-export] Updated helper manifest: ${manifestPath}`);
