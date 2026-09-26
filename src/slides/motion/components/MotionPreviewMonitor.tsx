import React from "react";

interface MotionPreviewMonitorProps {
	iframeRef: React.RefObject<HTMLIFrameElement>;
	srcDoc: string;
	aspectRatio: number;
	onIframeLoad: () => void;
}

export const MotionPreviewMonitor: React.FC<MotionPreviewMonitorProps> = ({
	iframeRef,
	srcDoc,
	aspectRatio,
	onIframeLoad,
}) => {
	return (
		<div className="flex flex-1 items-center justify-center p-4 bg-slate-950 overflow-hidden">
			<div
				className="relative flex items-center justify-center w-full h-full max-h-[82vh] overflow-hidden rounded-xl border border-slate-800/80 bg-black shadow-2xl"
				style={{
					aspectRatio: `${aspectRatio}`,
				}}
			>
				<iframe
					ref={iframeRef}
					title="Captr Motion Preview"
					srcDoc={srcDoc}
					onLoad={onIframeLoad}
					sandbox="allow-scripts allow-same-origin"
					className="h-full w-full border-0 select-none pointer-events-auto"
				/>
			</div>
		</div>
	);
};
