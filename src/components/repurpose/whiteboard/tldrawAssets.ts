import { getAssetUrls } from "@tldraw/assets/selfHosted";

/**
 * Returns offline-safe asset URLs bundled locally in public/tldraw-assets,
 * preventing tldraw from requesting unpkg.com or any remote CDN in air-gapped environments.
 */
export function getTldrawOfflineAssetUrls() {
	const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
	const baseUrl = isFileProtocol ? "./tldraw-assets" : "/tldraw-assets";
	const urls = getAssetUrls({ baseUrl });

	// Map each icon to its standalone individual SVG rather than 0_merged.svg#fragment
	// because Chromium CSS mask: url(...) does not activate SVG internal :target rules,
	// which causes all icons to render as blank/empty boxes.
	const icons: Record<string, string> = {};
	for (const key of Object.keys(urls.icons)) {
		icons[key] = `${baseUrl}/icons/icon/${key}.svg`;
	}

	return {
		...urls,
		icons,
	};
}
