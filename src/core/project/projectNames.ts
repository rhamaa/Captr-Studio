/** Saved paths, rather than an old bundle title, own the visible project name. */
export function projectFileName(path: string | null): string {
	return path?.split(/[\\/]/).at(-1) || "Untitled";
}

export function projectTitleFromPath(path: string): string {
	return projectFileName(path).replace(/\.(captr|json)$/i, "");
}

export function validateProjectBaseName(input: string): string {
	const name = input.replace(/\.captr$/i, "");
	if (
		!name.trim() ||
		/[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
		/[.\s]$/.test(name) ||
		/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name)
	) throw new Error("Choose a valid project name without reserved characters or trailing dots/spaces.");
	if (new TextEncoder().encode(`${name}.captr`).length > 255)
		throw new Error("Project name is too long.");
	return name;
}
