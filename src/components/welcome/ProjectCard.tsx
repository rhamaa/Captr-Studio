import { useState } from "react";
import { FolderOpen, Trash } from "@phosphor-icons/react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
import { LocalMediaImage } from "@/components/LocalMediaImage";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
interface ProjectCardProps {
	entry: ProjectLibraryEntry;
	onOpen: (path: string) => void;
	onReveal?: (path: string) => void;
	onDelete?: (path: string) => void;
	viewMode?: "grid" | "list";
}
export function ProjectCard({
	entry,
	onOpen,
	onReveal,
	onDelete,
	viewMode = "grid",
}: ProjectCardProps) {
	const [failed, setFailed] = useState(false);
	return (
		<article className={`home-project-card ${viewMode}`}>
			<button
				className="home-project-open"
				onClick={() => onOpen(entry.path)}
				aria-label={`Open ${entry.name}`}
				title={entry.path}
			>
				<div className="home-project-thumbnail">
					{!failed && entry.thumbnailDataUrl ? (
						<img src={entry.thumbnailDataUrl} alt="" onError={() => setFailed(true)} />
					) : !failed && entry.thumbnailPath ? (
						<LocalMediaImage
							src={entry.thumbnailPath}
							alt=""
							onError={() => setFailed(true)}
						/>
					) : (
						<CaptrLogo variant="icon" size={36} />
					)}
				</div>
				<div className="home-project-info">
					<strong>{entry.name}</strong>
					<span title={entry.path}>{entry.path}</span>
					<time dateTime={new Date(entry.updatedAt || 0).toISOString()}>
						{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString() : "—"}
					</time>
				</div>
			</button>
			{(onReveal || onDelete) && (
				<div className="home-project-actions">
					{onReveal && (
						<button aria-label="Show in folder" onClick={() => onReveal(entry.path)}>
							<FolderOpen size={16} />
						</button>
					)}
					{onDelete && (
						<button aria-label="Delete project" onClick={() => onDelete(entry.path)}>
							<Trash size={16} />
						</button>
					)}
				</div>
			)}
		</article>
	);
}
