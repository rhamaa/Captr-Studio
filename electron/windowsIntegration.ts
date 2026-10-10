import { exec, execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Ensures Windows file associations for .captr and shortcut icons point
 * to the modern Captr Studio icon branding.
 */
export async function setupWindowsIntegration(): Promise<void> {
	if (process.platform !== "win32") {
		return;
	}

	try {
		const appRoot = path.join(__dirname, "..");
		const candidateProjectIcons = [
			path.join(process.resourcesPath, "captr-project.ico"),
			path.join(process.resourcesPath, "icon.ico"),
			path.join(appRoot, "icons", "icons", "win", "captr-project.ico"),
			path.join(appRoot, "icons", "icons", "win", "icon.ico"),
		];
		const projectIconPath = candidateProjectIcons.find((p) => fs.existsSync(p));

		const candidateAppIcons = [
			path.join(process.resourcesPath, "icon.ico"),
			path.join(appRoot, "icons", "icons", "win", "icon.ico"),
		];
		const appIconPath = candidateAppIcons.find((p) => fs.existsSync(p));

		if (!projectIconPath && !appIconPath) {
			return;
		}

		const iconToUse = projectIconPath || appIconPath;

		// 1. Ensure Registry entries under HKCU\Software\Classes
		// We register both Captr Studio Project (installer progId) and CaptrStudio.Project
		const regCommands: string[] = [];
		if (iconToUse) {
			const iconArg = `"${iconToUse},0"`;
			regCommands.push(
				`reg add "HKCU\\Software\\Classes\\Captr Studio Project\\DefaultIcon" /ve /t REG_SZ /d ${iconArg} /f`,
				`reg add "HKCU\\Software\\Classes\\CaptrStudio.Project\\DefaultIcon" /ve /t REG_SZ /d ${iconArg} /f`,
				`reg add "HKCU\\Software\\Classes\\.captr\\DefaultIcon" /ve /t REG_SZ /d ${iconArg} /f`,
			);
		}

		for (const cmd of regCommands) {
			await new Promise<void>((resolve) => {
				exec(cmd, { windowsHide: true }, () => resolve());
			});
		}

		// 2. Check Start Menu shortcut to ensure taskbar icon displays the updated icon
		const appData = process.env.APPDATA;
		if (appData && appIconPath) {
			const lnkPath = path.join(
				appData,
				"Microsoft",
				"Windows",
				"Start Menu",
				"Programs",
				"Captr Studio.lnk",
			);
			if (fs.existsSync(lnkPath)) {
				const psScript = `
$sh = New-Object -ComObject WScript.Shell
$sc = $sh.CreateShortcut('${lnkPath.replace(/'/g, "''")}')
if ($sc.IconLocation -notmatch 'icon\\.ico') {
    $sc.IconLocation = '${appIconPath.replace(/'/g, "''")},0'
    $sc.Save()
}
`;
				await new Promise<void>((resolve) => {
					execFile(
						"powershell",
						["-NoProfile", "-NonInteractive", "-Command", psScript],
						{ windowsHide: true },
						() => resolve(),
					);
				});
			}
		}

		// 3. Notify Windows Explorer of the association/icon change
		const refreshPs = `
$code = @'
using System;
using System.Runtime.InteropServices;
public class ShellChange {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[ShellChange]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
`;
		execFile(
			"powershell",
			["-NoProfile", "-NonInteractive", "-Command", refreshPs],
			{ windowsHide: true },
			() => {
				// Refresh notification completed
			},
		);
	} catch (err) {
		console.warn("[windows-integration] Failed to setup Windows integration:", err);
	}
}
