import {
	ArrowsDownUp,
	ArrowUp,
	CloudArrowUp,
	List,
	Microphone,
	SquaresFour,
	VideoCamera,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import type { MediaAsset, RecordingPackage } from "@/core/timeline/types";
import { AssetCard } from "./AssetCard";
import { useProjectMessages } from "./useProjectMessages";
export interface AssetLibraryProps {
	assets: MediaAsset[];
	packages: RecordingPackage[];
	selectedAssetId: string | null;
	onImport: (paths?: string[]) => void;
	onRecord: () => void;
	onRecordAudio: () => void;
	onPreview: (id: string) => void;
	onPlace: (id: string) => void;
	onRemove: (id: string) => void;
	onTranscribe?: (id: string) => void;
	storyAssets?: MediaAsset[];
	onPublish?: (id: string) => void;
	onRemoveStoryMedia?: (id: string) => void;
}

type LibraryMediaEntry = { asset: MediaAsset; owner: "project" | "story" };

const isProjectMediaAsset = (asset: MediaAsset) => asset.kind !== "text" && asset.kind !== "shape";
const isStoryMediaAsset = (asset: MediaAsset) =>
	asset.kind === "video" || asset.kind === "image" || asset.kind === "audio";

export function AssetLibrary({
	assets,
	packages,
	selectedAssetId,
	onImport,
	onRecord,
	onRecordAudio,
	onPreview,
	onPlace,
	onRemove,
	onTranscribe,
	storyAssets,
	onPublish,
	onRemoveStoryMedia,
}: AssetLibraryProps) {
	const m = useProjectMessages();
	const [view, setView] = useState<"grid" | "list">("grid"),
		[sort, setSort] = useState<"added" | "name">("added"),
		[query, setQuery] = useState(""),
		[dropping, setDropping] = useState(false);
	const media = useMemo<LibraryMediaEntry[]>(
		() => [
			...assets
				.filter(isProjectMediaAsset)
				.map((asset) => ({ asset, owner: "project" as const })),
			...(storyAssets ?? [])
				.filter(isStoryMediaAsset)
				.map((asset) => ({ asset, owner: "story" as const })),
		],
		[assets, storyAssets],
	);
	const shown = useMemo(() => {
		const result = media.filter(({ asset }) =>
			asset.name.toLowerCase().includes(query.toLowerCase()),
		);
		return sort === "name"
			? [...result].sort((a, b) => a.asset.name.localeCompare(b.asset.name))
			: result;
	}, [media, query, sort]);
	return (
		<section
			className={`project-assets ${dropping ? "drag-over" : ""}`}
			aria-label="Asset library"
			onDragOver={(event) => {
				if (event.dataTransfer.types.includes("Files")) {
					event.preventDefault();
					setDropping(true);
				}
			}}
			onDragLeave={() => setDropping(false)}
			onDrop={(event) => {
				if (!event.dataTransfer.files.length) return;
				event.preventDefault();
				setDropping(false);
				const paths = Array.from(event.dataTransfer.files)
					.map((file) => window.electronAPI.getPathForFile(file))
					.filter(Boolean);
				onImport(paths);
			}}
		>
			<header className="project-panel-header">
				<h2>
					{m("assets")}
					<span>{media.length || ""}</span>
				</h2>
				<button
					aria-label={view === "grid" ? "List view" : "Grid view"}
					title="Change asset view"
					onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
				>
					{view === "grid" ? <List size={18} /> : <SquaresFour size={18} />}
				</button>
				<button
					aria-label="Sort assets"
					title={sort === "name" ? "Sort by added order" : "Sort by name"}
					onClick={() => setSort((s) => (s === "added" ? "name" : "added"))}
				>
					<ArrowsDownUp size={16} />
				</button>
				<button className="project-import-button" onClick={() => onImport()}>
					<CloudArrowUp size={18} />
					{m("import")}
				</button>
				<button
					className="project-import-button"
					aria-label={m("recordAudio")}
					onClick={onRecordAudio}
				>
					<Microphone size={18} />
					{m("recordAudio")}
				</button>
			</header>
			{!!media.length && (
				<div className="project-assets-search">
					<input
						aria-label="Search assets"
						placeholder={m("search")}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
					/>
				</div>
			)}
			<div className={`project-asset-grid ${view}`}>
				{!media.length ? (
					<div className="project-assets-empty">
						<ArrowUp size={40} weight="light" />
						<p>{m("emptyAssets")}</p>
						<button onClick={() => onImport()}>{m("browse")}</button>
						<span>or</span>
						<button onClick={onRecord}>
							<VideoCamera size={16} />
							{m("recordScreen")}
						</button>
					</div>
				) : (
					shown.map(({ asset, owner }) => {
						const pkg = packages.find((p) => p.id === asset.packageId);
						return (
							<AssetCard
								key={`${owner}:${asset.id}`}
								asset={asset}
								recordingPackage={pkg}
								sourcePath={asset.source?.path ?? pkg?.screen.path}
								audioPath={
									owner === "project"
										? pkg?.microphone?.path ?? pkg?.system?.path
										: undefined
								}
								selected={asset.id === selectedAssetId}
								onPreview={() => onPreview(asset.id)}
								onPlace={() => onPlace(asset.id)}
								onRemove={() =>
									owner === "story"
										? onRemoveStoryMedia?.(asset.id)
										: onRemove(asset.id)
								}
								onTranscribe={
									owner === "project" && onTranscribe
										? () => onTranscribe(asset.id)
										: undefined
								}
								onPublish={
									owner === "story" && onPublish
										? () => onPublish(asset.id)
										: undefined
								}
							/>
						);
					})
				)}
				{!!media.length && !shown.length && (
					<p className="project-muted">{m("noMatches")}</p>
				)}
			</div>
		</section>
	);
}
