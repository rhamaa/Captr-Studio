import { CopySimple, Folder, Plus, Square, TextT } from "@phosphor-icons/react";
import type { ShapeDefinition, StoryDesignTemplate } from "@/core/timeline/types";
import { useProjectMessages } from "./useProjectMessages";

interface ProjectToolRailProps {
	activeTab?: "assets" | "shapes";
	onSelectTab?: (tab: "assets" | "shapes") => void;
	onAddText: () => void;
	onAddShape: (kind: ShapeDefinition["kind"]) => void;
	templates?: StoryDesignTemplate[];
	onApplyTemplate?: (id: string) => void;
}

const shapeKinds = ["rectangle", "ellipse", "line", "arrow"] as const;

export function ProjectToolRail({
	activeTab = "assets",
	onSelectTab,
	onAddText,
	onAddShape,
	templates,
	onApplyTemplate,
}: ProjectToolRailProps) {
	const m = useProjectMessages();
	return (
		<aside className="project-tool-rail">
			<button
				type="button"
				aria-label="Assets"
				aria-current={activeTab === "assets" ? "page" : undefined}
				className={activeTab === "assets" ? "active" : ""}
				onClick={() => onSelectTab?.("assets")}
			>
				<Folder size={21} />
			</button>
			<button
				type="button"
				aria-label="Add text overlay"
				title="Add text overlay"
				onClick={onAddText}
			>
				<TextT size={19} />
			</button>
			<details className="project-shape-rail-menu">
				<summary
					aria-label={m("addShape")}
					title={m("addShape")}
					aria-current={activeTab === "shapes" ? "page" : undefined}
					className={activeTab === "shapes" ? "active" : ""}
					onClick={(e) => {
						if (onSelectTab) {
							e.preventDefault();
							onSelectTab("shapes");
						}
					}}
				>
					<span className="project-shape-rail-icon" aria-hidden="true">
						<Square size={19} />
						<Plus size={10} weight="bold" />
					</span>
				</summary>
				<div className="project-shape-rail-menu-items">
					{shapeKinds.map((kind) => (
						<button
							key={kind}
							type="button"
							className="project-shape-choice"
							onClick={(event) => {
								onAddShape(kind);
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
			{!!templates?.length && (
				<details className="project-shape-rail-menu">
					<summary aria-label="Templates" title="Templates">
						<CopySimple size={19} />
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
		</aside>
	);
}
