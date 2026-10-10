import { Folder, Plus, Square } from "@phosphor-icons/react";
import type { ShapeDefinition } from "@/core/timeline/types";
import { useProjectMessages } from "./useProjectMessages";

interface ProjectToolRailProps {
	onAddShape: (kind: ShapeDefinition["kind"]) => void;
}

const shapeKinds = ["rectangle", "ellipse", "line", "arrow"] as const;

export function ProjectToolRail({ onAddShape }: ProjectToolRailProps) {
	const m = useProjectMessages();
	return (
		<aside className="project-tool-rail">
			<button type="button" aria-label="Assets" aria-current="page">
				<Folder size={21} />
			</button>
			<details className="project-shape-rail-menu">
				<summary aria-label={m("addShape")} title={m("addShape")}>
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
		</aside>
	);
}
