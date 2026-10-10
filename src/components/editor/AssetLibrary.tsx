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
import type {
	MediaAsset,
	RecordingPackage,
	ShapeDefinition,
	StoryDesignTemplate,
} from "@/core/timeline/types";
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
	onCreateText?: () => void;
	onCreateShape?: (kind: ShapeDefinition["kind"]) => void;
	templates?: StoryDesignTemplate[];
	onApplyTemplate?: (id: string) => void;
}
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
	onCreateText,
	onCreateShape,
	templates,
	onApplyTemplate,
}: AssetLibraryProps) {
	const m = useProjectMessages();
	const [view, setView] = useState<"grid" | "list">("grid"),
		[sort, setSort] = useState<"added" | "name">("added"),
		[query, setQuery] = useState(""),
		[dropping, setDropping] = useState(false);
	const shown = useMemo(() => {
		const result = assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
		return sort === "name" ? [...result].sort((a, b) => a.name.localeCompare(b.name)) : result;
	}, [assets, query, sort]);
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
					<span>{assets.length || ""}</span>
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
			{!!assets.length && (
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
				{!assets.length ? (
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
					shown.map((asset) => {
						const pkg = packages.find((p) => p.id === asset.packageId);
						return (
							<AssetCard
								key={asset.id}
								asset={asset}
								sourcePath={asset.source?.path ?? pkg?.screen.path}
								audioPath={pkg?.microphone?.path ?? pkg?.system?.path}
								selected={asset.id === selectedAssetId}
								onPreview={() => onPreview(asset.id)}
								onPlace={() => onPlace(asset.id)}
								onRemove={() => onRemove(asset.id)}
								onTranscribe={
									onTranscribe ? () => onTranscribe(asset.id) : undefined
								}
							/>
						);
					})
				)}
				{!!assets.length && !shown.length && (
					<p className="project-muted">{m("noMatches")}</p>
				)}
			</div>
			{storyAssets && (
				<>
					<header className="project-panel-header">
						<h2>
							Story Media<span>{storyAssets.length || ""}</span>
						</h2>
					</header>
					<div className={`project-asset-grid ${view}`}>
						{!storyAssets.length && (
							<p className="project-assets-empty">No media in this Story</p>
						)}
						{storyAssets.map((asset) => (
							<AssetCard
								key={asset.id}
								asset={asset}
								sourcePath={asset.source?.path}
								selected={asset.id === selectedAssetId}
								onPreview={() => onPreview(asset.id)}
								onPlace={() => onPlace(asset.id)}
								onRemove={() => onRemoveStoryMedia?.(asset.id)}
								onPublish={onPublish ? () => onPublish(asset.id) : undefined}
							/>
						))}
					</div>
				</>
			)}
			{onCreateText && (
				<>
					<header className="project-panel-header">
						<h2>Text / Shapes</h2>
					</header>
					<div className="project-asset-actions">
						<button onClick={onCreateText}>Add Text</button>
						{(["rectangle", "ellipse", "line", "arrow"] as const).map((kind) => (
							<button key={kind} onClick={() => onCreateShape?.(kind)}>
								{m(kind)}
							</button>
						))}
					</div>
				</>
			)}
			{templates && (
				<>
					<header className="project-panel-header">
						<h2>Templates</h2>
					</header>
					<div className="project-asset-grid">
						{!templates.length && <p className="project-assets-empty">No templates</p>}
						{templates.map((template) => (
							<button
								key={template.id}
								onClick={() => onApplyTemplate?.(template.id)}
							>
								{template.name}
							</button>
						))}
					</div>
				</>
			)}
		</section>
	);
}
