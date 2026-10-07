import { getAssetUrlsByMetaUrl } from "@tldraw/assets/urls";

/**
 * Returns offline-safe asset URLs bundled locally, preventing
 * tldraw from requesting unpkg.com or any remote CDN in air-gapped environments.
 */
export function getTldrawOfflineAssetUrls() {
	return getAssetUrlsByMetaUrl();
}
