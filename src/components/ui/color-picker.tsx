"use client";

import { CaretDown } from "@phosphor-icons/react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface HsvColor {
	hue: number;
	saturation: number;
	value: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const parseHex = (input: string): string | null => {
	const match = input.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
	if (!match) return null;
	const digits = match[1]!;
	return `#${(digits.length === 3 ? [...digits].map((digit) => digit + digit).join("") : digits).toUpperCase()}`;
};

export function normalizeHexColor(input: string, fallback = "#FFFFFF"): string {
	return parseHex(input) ?? parseHex(fallback) ?? "#FFFFFF";
}

export function hexToHsv(input: string): HsvColor {
	const hex = normalizeHexColor(input).slice(1);
	const red = Number.parseInt(hex.slice(0, 2), 16) / 255;
	const green = Number.parseInt(hex.slice(2, 4), 16) / 255;
	const blue = Number.parseInt(hex.slice(4, 6), 16) / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const delta = max - min;
	let hue = 0;

	if (delta !== 0) {
		if (max === red) hue = 60 * (((green - blue) / delta) % 6);
		else if (max === green) hue = 60 * ((blue - red) / delta + 2);
		else hue = 60 * ((red - green) / delta + 4);
	}

	return {
		hue: (hue + 360) % 360,
		saturation: max === 0 ? 0 : delta / max,
		value: max,
	};
}

export function hsvToHex({ hue, saturation, value }: HsvColor): string {
	const safeHue = ((hue % 360) + 360) % 360;
	const safeSaturation = clamp(saturation, 0, 1);
	const safeValue = clamp(value, 0, 1);
	const chroma = safeValue * safeSaturation;
	const secondary = chroma * (1 - Math.abs(((safeHue / 60) % 2) - 1));
	const offset = safeValue - chroma;
	const sector = Math.floor(safeHue / 60);
	const channels: [number, number, number] =
		sector === 0
			? [chroma, secondary, 0]
			: sector === 1
				? [secondary, chroma, 0]
				: sector === 2
					? [0, chroma, secondary]
					: sector === 3
						? [0, secondary, chroma]
						: sector === 4
							? [secondary, 0, chroma]
							: [chroma, 0, secondary];

	return `#${channels
		.map((channel) =>
			Math.round((channel + offset) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")
		.toUpperCase()}`;
}

export interface ColorPickerProps {
	label: string;
	value: string;
	onChange: (hex: string) => void;
	compact?: boolean;
	triggerClassName?: string;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	usePortal?: boolean;
}

export function ColorPicker({
	label,
	value,
	onChange,
	compact = false,
	triggerClassName,
	open,
	defaultOpen,
	onOpenChange,
	usePortal = true,
}: ColorPickerProps) {
	const hex = normalizeHexColor(value);
	const [hsv, setHsv] = useState(() => hexToHsv(hex));
	const [hexDraft, setHexDraft] = useState(hex);

	useEffect(() => {
		setHsv(hexToHsv(hex));
		setHexDraft(hex);
	}, [hex]);

	const commitHsv = useCallback(
		(next: HsvColor) => {
			const normalized = {
				hue: ((next.hue % 360) + 360) % 360,
				saturation: clamp(next.saturation, 0, 1),
				value: clamp(next.value, 0, 1),
			};
			const nextHex = hsvToHex(normalized);
			setHsv(normalized);
			setHexDraft(nextHex);
			onChange(nextHex);
		},
		[onChange],
	);

	const updateSaturationAndValue = (event: ReactPointerEvent<HTMLDivElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return;
		commitHsv({
			...hsv,
			saturation: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
			value: clamp(1 - (event.clientY - bounds.top) / bounds.height, 0, 1),
		});
	};

	const updateHue = (event: ReactPointerEvent<HTMLDivElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		if (bounds.width <= 0) return;
		commitHsv({
			...hsv,
			hue: Math.round(clamp((event.clientX - bounds.left) / bounds.width, 0, 1) * 360),
		});
	};

	const commitHexDraft = () => {
		const normalized = parseHex(hexDraft);
		if (!normalized) {
			setHexDraft(hex);
			return;
		}
		setHexDraft(normalized);
		setHsv(hexToHsv(normalized));
		if (normalized !== hex) onChange(normalized);
	};

	const handleHexChange = (nextValue: string) => {
		const cleaned = nextValue
			.toUpperCase()
			.replace(/[^#\dA-F]/g, "")
			.slice(0, 7);
		setHexDraft(cleaned);
		const normalized = parseHex(cleaned);
		if (!normalized) return;
		setHexDraft(normalized);
		setHsv(hexToHsv(normalized));
		onChange(normalized);
	};

	const handleSvKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const amount = event.shiftKey ? 0.1 : 0.01;
		let next = hsv;
		if (event.key === "ArrowLeft") next = { ...hsv, saturation: hsv.saturation - amount };
		else if (event.key === "ArrowRight") next = { ...hsv, saturation: hsv.saturation + amount };
		else if (event.key === "ArrowDown") next = { ...hsv, value: hsv.value - amount };
		else if (event.key === "ArrowUp") next = { ...hsv, value: hsv.value + amount };
		else return;
		event.preventDefault();
		commitHsv(next);
	};

	const handleHueKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const amount = event.shiftKey ? 10 : 1;
		if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
			event.preventDefault();
			commitHsv({ ...hsv, hue: hsv.hue - amount });
		} else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
			event.preventDefault();
			commitHsv({ ...hsv, hue: hsv.hue + amount });
		}
	};

	return (
		<Popover open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={`Edit ${label}`}
					title={`${label}: ${hex}`}
					className={cn(
						"inline-flex h-8 items-center gap-2 rounded-lg border border-[#343741] bg-[#1b1d23] px-2 text-[11px] text-[#e8eaf0] transition-colors hover:border-[#586078] hover:bg-[#22252d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6FA8FF]/50",
						compact && "h-7 gap-1.5 px-1.5 text-[10px]",
						triggerClassName,
					)}
				>
					<span
						aria-hidden="true"
						className={cn(
							"h-5 w-5 shrink-0 rounded-md border border-white/15 shadow-inner",
							compact && "h-4 w-4 rounded",
						)}
						style={{ backgroundColor: hex }}
					/>
					<span className="font-mono uppercase tracking-wide">{hex}</span>
					{!compact && (
						<CaretDown aria-hidden="true" size={12} className="text-[#8c919d]" />
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={8}
				usePortal={usePortal}
				className="w-72 rounded-xl border-[#353945] bg-[#1b1d23] p-3 text-[#eceef3] shadow-[0_18px_50px_rgba(0,0,0,0.55)]"
			>
				<div data-color-picker-card="true" className="space-y-3">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<p className="truncate text-[12px] font-semibold">{label}</p>
							<p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#818795]">
								Color value
							</p>
						</div>
						<span
							aria-hidden="true"
							className="h-7 w-7 shrink-0 rounded-lg border border-white/15 shadow-inner"
							style={{ backgroundColor: hex }}
						/>
					</div>

					<div
						role="slider"
						tabIndex={0}
						aria-label={`${label} saturation and brightness`}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(hsv.value * 100)}
						aria-valuetext={`Saturation ${Math.round(hsv.saturation * 100)}%, brightness ${Math.round(hsv.value * 100)}%`}
						onKeyDown={handleSvKeyDown}
						onPointerDown={(event) => {
							event.preventDefault();
							event.currentTarget.setPointerCapture(event.pointerId);
							updateSaturationAndValue(event);
						}}
						onPointerMove={(event) => {
							if (event.buttons !== 0) updateSaturationAndValue(event);
						}}
						className="relative h-32 touch-none select-none overflow-hidden rounded-lg border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-[#6FA8FF]/60"
						style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
					>
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0"
							style={{
								background:
									"linear-gradient(to top, #000 0%, transparent 100%), linear-gradient(to right, #fff 0%, transparent 100%)",
							}}
						/>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
							style={{
								left: `${hsv.saturation * 100}%`,
								top: `${(1 - hsv.value) * 100}%`,
							}}
						/>
					</div>

					<div
						role="slider"
						tabIndex={0}
						aria-label={`${label} hue`}
						aria-valuemin={0}
						aria-valuemax={359}
						aria-valuenow={Math.round(hsv.hue) % 360}
						aria-valuetext={`${Math.round(hsv.hue) % 360} degrees`}
						onKeyDown={handleHueKeyDown}
						onPointerDown={(event) => {
							event.preventDefault();
							event.currentTarget.setPointerCapture(event.pointerId);
							updateHue(event);
						}}
						onPointerMove={(event) => {
							if (event.buttons !== 0) updateHue(event);
						}}
						className="relative h-3 touch-none select-none rounded-full border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-[#6FA8FF]/60"
						style={{
							background:
								"linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
						}}
					>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.65)]"
							style={{ left: `${(hsv.hue / 360) * 100}%` }}
						/>
					</div>

					<div className="flex items-center gap-2 rounded-lg border border-[#353945] bg-[#15171c] px-2 py-1.5">
						<span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#818795]">
							HEX
						</span>
						<Input
							type="text"
							aria-label={`${label} HEX value`}
							value={hexDraft}
							maxLength={7}
							spellCheck={false}
							autoComplete="off"
							onChange={(event) => handleHexChange(event.target.value)}
							onBlur={commitHexDraft}
							onKeyDown={(event) => {
								if (event.key === "Enter") event.currentTarget.blur();
							}}
							className="h-7 flex-1 border-0 bg-transparent px-1 py-0 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-[#f4f5f7] shadow-none focus-visible:ring-0"
						/>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
