import { useMemo, useState } from "react";
import { ArrowClockwise, FolderOpen, Plus, Minus, Square, X, Gear } from "@phosphor-icons/react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
import { useProjectMessages } from "@/components/editor/useProjectMessages";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
import { ProjectCard } from "./ProjectCard";
import "./projectHome.css";
export interface WelcomeScreenProps {
	onNewProject: (aspectRatio?: string) => void;
	onOpenProjectFile: () => void;
	onOpenRecentProject: (path: string) => void;
	recentProjects: ProjectLibraryEntry[];
	loading?: boolean;
	error?: string | null;
	busy?: boolean;
	onRefreshProjects?: () => Promise<void>;
	onOpenSettings?: () => void;
}
export function WelcomeScreen(props: WelcomeScreenProps) {
	const m = useProjectMessages();
	const [query, setQuery] = useState("");
	const projects = useMemo(
		() =>
			props.recentProjects.filter((p) =>
				`${p.name} ${p.path}`.toLowerCase().includes(query.trim().toLowerCase()),
			),
		[props.recentProjects, query],
	);
	return (
		<main className="project-home">
			<header className="home-topbar">
				<CaptrLogo variant="icon" size={30} />
				<strong>Captr Studio</strong>
				<div className="home-window-controls">
					{props.onOpenSettings && (
						<button aria-label="Settings" onClick={props.onOpenSettings}>
							<Gear size={19} />
						</button>
					)}
					<button
						aria-label="Minimize"
						onClick={() => void window.electronAPI?.minimizeWindow?.()}
					>
						<Minus size={17} />
					</button>
					<button
						aria-label="Maximize"
						onClick={() => void window.electronAPI?.maximizeWindow?.()}
					>
						<Square size={15} />
					</button>
					<button
						aria-label="Close"
						onClick={() => void window.electronAPI?.closeWindow?.()}
					>
						<X size={17} />
					</button>
				</div>
			</header>
			<div className="home-body">
				<section className="home-heading">
					<p>CAPTR STUDIO</p>
					<h1>{m("homeWelcome")}</h1>
					<span>{m("homeHint")}</span>
				</section>
				<section className="home-quick-actions" aria-label={m("quickActions")}>
					<button
						disabled={props.busy}
						className="home-primary"
						onClick={() => props.onNewProject("16:9")}
					>
						<Plus size={24} />
						<span>
							<strong>{m("newProject")}</strong>
							<small>{m("newProjectHint")}</small>
						</span>
					</button>
					<button disabled={props.busy} onClick={props.onOpenProjectFile}>
						<FolderOpen size={24} />
						<span>
							<strong>{m("openProject")}</strong>
							<small>{m("openProjectHint")}</small>
						</span>
					</button>
				</section>
				<section className="home-library">
					<div className="home-library-toolbar">
						<h2>{m("yourProjects")}</h2>
						<input
							type="search"
							aria-label={m("searchProjects")}
							placeholder={m("searchProjects")}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						<button
							aria-label={m("refresh")}
							disabled={props.loading || props.busy}
							onClick={() => void props.onRefreshProjects?.()}
						>
							<ArrowClockwise size={19} />
						</button>
					</div>
					{props.loading ? (
						<p role="status" className="home-state">
							{m("loadingProjects")}
						</p>
					) : props.error ? (
						<div role="alert" className="home-state">
							<p>{props.error}</p>
							<button onClick={() => void props.onRefreshProjects?.()}>
								{m("retry")}
							</button>
						</div>
					) : projects.length ? (
						<div className="home-project-grid">
							{projects.map((entry) => (
								<ProjectCard
									key={entry.path}
									entry={entry}
									onOpen={
										props.busy ? () => undefined : props.onOpenRecentProject
									}
								/>
							))}
						</div>
					) : (
						<div className="home-state">
							<FolderOpen size={36} />
							<h3>{query ? m("noProjectMatches") : m("emptyProjects")}</h3>
							<p>{query ? m("searchProjects") : m("emptyProjectsHint")}</p>
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
