import { CloudArrowUp, FilmStrip, VideoCamera } from "@phosphor-icons/react";
import { useProjectMessages } from "./useProjectMessages";
export function ProjectWelcome({
	onImport,
	onRecord,
	hasAssets = false,
}: {
	onImport: () => void;
	onRecord: () => void;
	hasAssets?: boolean;
}) {
	const m = useProjectMessages();
	return (
		<div className="project-welcome">
			<div className="project-welcome-icon">
				<FilmStrip size={36} weight="light" />
			</div>
			<h1>{hasAssets ? m("buildTimeline") : m("startVideo")}</h1>
			<p>{hasAssets ? m("placeHint") : m("startHint")}</p>
			<div>
				<button onClick={onImport}>
					<CloudArrowUp size={17} />
					{m("importMedia")}
				</button>
				<button className="primary" onClick={onRecord}>
					<VideoCamera size={17} />
					{m("recordScreen")}
				</button>
			</div>
		</div>
	);
}
