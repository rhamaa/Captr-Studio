import { useRef, useState } from "react";
type Curve = [number, number, number, number];
export function moveBezierHandle(curve: Curve, handle: 0 | 1, x: number, y: number): Curve {
	if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid curve handle");
	const next = [...curve] as Curve;
	next[handle * 2] = Math.max(0, Math.min(1, x));
	next[handle * 2 + 1] = Math.max(-1, Math.min(2, y));
	return next;
}
export function KeyframeCurveEditor({
	value,
	disabled,
	onChange,
}: {
	value?: Curve;
	disabled?: boolean;
	onChange: (value: Curve) => void;
}) {
	const [draft, setDraft] = useState<Curve | null>(null),
		active = useRef<{ handle: 0 | 1; curve: Curve; pointerId: number } | null>(null);
	const curve = draft ?? value ?? [0.42, 0, 0.58, 1];
	return (
		<svg
			className="story-keyframe-curve"
			aria-label="Editable Bezier easing curve"
			role="group"
			viewBox="-10 -10 120 120"
		>
			<path
				d="M0 0V100H100V0Z M0 50H100 M50 0V100"
				fill="none"
				stroke="currentColor"
				opacity=".15"
			/>
			<path
				d={`M0 100L${curve[0] * 100} ${100 - curve[1] * 100} M100 0L${curve[2] * 100} ${100 - curve[3] * 100}`}
				stroke="currentColor"
				opacity=".45"
			/>
			<path
				d={`M0 100C${curve[0] * 100} ${100 - curve[1] * 100},${curve[2] * 100} ${100 - curve[3] * 100},100 0`}
				fill="none"
				stroke="var(--editor-accent,#7c8fff)"
				strokeWidth="2"
			/>
			{([0, 1] as const).map((handle) => (
				<circle
					key={handle}
					cx={curve[handle * 2] * 100}
					cy={100 - curve[handle * 2 + 1] * 100}
					r="5"
					role="button"
					tabIndex={disabled ? -1 : 0}
					aria-label={`Bezier control ${handle + 1}: ${curve[handle * 2].toFixed(2)}, ${curve[handle * 2 + 1].toFixed(2)}`}
					aria-disabled={disabled}
					fill="var(--editor-accent,#7c8fff)"
					onPointerDown={(e) => {
						if (disabled) return;
						e.preventDefault();
						e.currentTarget.setPointerCapture(e.pointerId);
						active.current = { handle, curve: [...curve], pointerId: e.pointerId };
					}}
					onPointerMove={(e) => {
						const a = active.current;
						if (!a || a.pointerId !== e.pointerId) return;
						const svg = e.currentTarget.ownerSVGElement!,
							point = svg.createSVGPoint();
						point.x = e.clientX;
						point.y = e.clientY;
						const matrix = svg.getScreenCTM();
						if (!matrix) return;
						const local = point.matrixTransform(matrix.inverse());
						a.curve = moveBezierHandle(
							a.curve,
							a.handle,
							local.x / 100,
							1 - local.y / 100,
						);
						setDraft(a.curve);
					}}
					onPointerUp={(e) => {
						const a = active.current;
						if (!a || a.pointerId !== e.pointerId) return;
						active.current = null;
						setDraft(null);
						onChange(a.curve);
					}}
					onPointerCancel={() => {
						active.current = null;
						setDraft(null);
					}}
					onKeyDown={(e) => {
						if (
							disabled ||
							!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
						)
							return;
						e.preventDefault();
						e.stopPropagation();
						const step = e.shiftKey ? 0.1 : 0.01;
						onChange(
							moveBezierHandle(
								curve,
								handle,
								curve[handle * 2] +
									(e.key === "ArrowRight"
										? step
										: e.key === "ArrowLeft"
											? -step
											: 0),
								curve[handle * 2 + 1] +
									(e.key === "ArrowUp"
										? step
										: e.key === "ArrowDown"
											? -step
											: 0),
							),
						);
					}}
				/>
			))}
		</svg>
	);
}
