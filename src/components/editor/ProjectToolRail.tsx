import { CopySimple, Folder, Plus, Square, TextT } from "@phosphor-icons/react";
import type { ShapeDefinition, StoryDesignTemplate } from "@/core/timeline/types";
import { useProjectMessages } from "./useProjectMessages";

export interface ProjectToolRailProps {
	activeTab?: "assets" | "shapes";
	onSelectTab?: (tab: "assets" | "shapes") => void;
	onAddText?: () => void;
	onAddShape?: (kind: ShapeDefinition["kind"]) => void;
	templates?: StoryDesignTemplate[];
	onApplyTemplate?: (id: string) => void;
	className?: string;
}

const shapeKinds = ["rectangle", "ellipse", "line", "arrow"] as const;

export function ProjectToolRail({
	activeTab = "assets",
	onSelectTab,
	onAddText,
	onAddShape,
	templates,
	onApplyTemplate,
	className = "",
}: ProjectToolRailProps) {
	const m = useProjectMessages();
	return (
		<div className={`project-tool-rail ${className}`} aria-label="Editor sidebar navigation">
			<div className="project-tool-rail-tabs">
				<button
					type="button"
					aria-label="Assets"
					aria-current={activeTab === "assets" ? "page" : undefined}
					className={`project-tool-rail-btn ${activeTab === "assets" ? "active" : ""}`}
					onClick={() => onSelectTab?.("assets")}
					title="Assets"
				>
					<Folder size={16} weight={activeTab === "assets" ? "fill" : "regular"} />
					<span>Assets</span>
				</button>
				<details className="project-shape-rail-menu">
					<summary
						aria-label={m("addShape")}
						title={m("addShape")}
						aria-current={activeTab === "shapes" ? "page" : undefined}
						className={`project-tool-rail-btn ${activeTab === "shapes" ? "active" : ""}`}
						onClick={(e) => {
							if (onSelectTab) {
								e.preventDefault();
								onSelectTab("shapes");
							}
						}}
					>
						<span className="project-shape-rail-icon" aria-hidden="true">
							<Square size={15} weight={activeTab === "shapes" ? "fill" : "regular"} />
							<Plus size={8} weight="bold" />
						</span>
						<span>Shapes</span>
					</summary>
					<div className="project-shape-rail-menu-items">
						{shapeKinds.map((kind) => (
							<button
								key={kind}
								type="button"
								className="project-shape-choice"
								onClick={(event) => {
									onAddShape?.(kind);
									const details = event.currentTarget.closest("details");
									if (details) {
										details.open = false;
										details.querySelector("summary")?.focus();
									}
								}}
							>
								{m(kind)}
							</button>
						))}
					</div>
				</details>
			</div>

			{onAddText && (
				<>
					<div className="project-tool-rail-divider" />
					<div className="project-tool-rail-actions">
						<button
							type="button"
							aria-label="Add text overlay"
							title="Add text overlay"
							className="project-tool-rail-action-btn"
							onClick={onAddText}
						>
							<TextT size={15} />
							<span>Text</span>
						</button>
						{!!templates?.length && (
							<details className="project-shape-rail-menu">
								<summary
									aria-label="Templates"
									title="Templates"
									className="project-tool-rail-action-btn"
								>
									<CopySimple size={15} />
								</summary>
								<div className="project-shape-rail-menu-items">
									{templates.map((template) => (
										<button
											key={template.id}
											type="button"
											className="project-shape-choice"
											onClick={(event) => {
												onApplyTemplate?.(template.id);
												const details = event.currentTarget.closest("details");
												if (details) {
													details.open = false;
													details.querySelector("summary")?.focus();
												}
											}}
										>
											{template.name}
										</button>
									))}
								</div>
							</details>
						)}
					</div>
				</>
			)}
		</div>
	);
}
