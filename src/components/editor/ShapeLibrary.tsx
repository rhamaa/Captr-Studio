import { MagnifyingGlass, X } from "@phosphor-icons/react";
import React, { useMemo, useState } from "react";
import type { ShapeDefinition } from "@/core/timeline/types";

export interface ShapeLibraryProps {
	onAddShape: (shape: ShapeDefinition) => void;
	onClose?: () => void;
	activeTab?: "assets" | "shapes";
	onSelectTab?: (tab: "assets" | "shapes") => void;
}

export type ShapeCategory = "all" | "highlights" | "arrows" | "callouts" | "privacy";

export interface ShapePresetItem {
	id: string;
	title: string;
	category: ShapeCategory;
	createDefinition: (color: string, strokeWidth: number) => ShapeDefinition;
	renderPreview: (color: string, strokeWidth: number) => React.ReactNode;
}

export const PRESET_COLORS = [
	{ label: "Captr Blue", value: "#6FA8FF" },
	{ label: "Red", value: "#FF6B81" },
	{ label: "Yellow", value: "#F6C768" },
	{ label: "Green", value: "#8DDB9B" },
	{ label: "Purple", value: "#A879F5" },
	{ label: "White", value: "#FFFFFF" },
	{ label: "Dark", value: "#1C1F26" },
];

export const STROKE_WEIGHTS = [
	{ label: "Thin", value: 3 },
	{ label: "Medium", value: 6 },
	{ label: "Bold", value: 10 },
];

export const SHAPE_PRESETS: ShapePresetItem[] = [
	// 1. Highlights & Frames
	{
		id: "focus-frame",
		title: "Focus Box",
		category: "highlights",
		createDefinition: (color, width) => ({
			kind: "rectangle",
			width: 360,
			height: 220,
			style: { fill: null, stroke: { color, width } },
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<rect
					x="8"
					y="8"
					width="64"
					height="34"
					rx="4"
					fill="none"
					stroke={color}
					strokeWidth={Math.min(width, 6)}
				/>
			</svg>
		),
	},
	{
		id: "highlighter-marker",
		title: "Text Highlighter",
		category: "highlights",
		createDefinition: (color) => ({
			kind: "rectangle",
			width: 360,
			height: 60,
			style: { fill: color, stroke: null },
		}),
		renderPreview: (color) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				{/* Background text simulation */}
				<line
					x1="8"
					y1="20"
					x2="72"
					y2="20"
					stroke="#475569"
					strokeWidth="3"
					strokeDasharray="6 3"
				/>
				<line
					x1="8"
					y1="30"
					x2="56"
					y2="30"
					stroke="#475569"
					strokeWidth="3"
					strokeDasharray="6 3"
				/>
				{/* Translucent marker overlay */}
				<rect x="6" y="14" width="68" height="13" rx="2" fill={color} fillOpacity="0.5" />
			</svg>
		),
	},
	{
		id: "attention-dashed-box",
		title: "Attention Frame",
		category: "highlights",
		createDefinition: (color, width) => ({
			kind: "rectangle",
			width: 360,
			height: 220,
			style: { fill: null, stroke: { color, width } },
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<rect
					x="8"
					y="8"
					width="64"
					height="34"
					rx="6"
					fill="none"
					stroke={color}
					strokeWidth={Math.min(width, 6)}
					strokeDasharray="6 4"
				/>
			</svg>
		),
	},
	{
		id: "spotlight-badge",
		title: "Color Badge",
		category: "highlights",
		createDefinition: (color, width) => ({
			kind: "rectangle",
			width: 280,
			height: 120,
			style: {
				fill: color,
				stroke: { color: "#ffffff", width: Math.max(2, Math.round(width / 2)) },
			},
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<rect
					x="14"
					y="12"
					width="52"
					height="26"
					rx="6"
					fill={color}
					stroke="#ffffff"
					strokeWidth={Math.max(1.5, Math.min(width / 2, 4))}
				/>
			</svg>
		),
	},

	// 2. Pointers & Arrows
	{
		id: "arrow-right",
		title: "Right Arrow",
		category: "arrows",
		createDefinition: (color, width) => ({
			kind: "arrow",
			from: { x: 30, y: 110 },
			to: { x: 330, y: 110 },
			headLength: 32,
			style: { stroke: { color, width: Math.max(4, width) } },
		}),
		renderPreview: (color, width) => {
			const strokeW = Math.max(2.5, Math.min(width, 6));
			return (
				<svg viewBox="0 0 80 50" className="w-full h-full">
					<line
						x1="12"
						y1="25"
						x2="62"
						y2="25"
						stroke={color}
						strokeWidth={strokeW}
						strokeLinecap="round"
					/>
					<path
						d="M50 15 L64 25 L50 35"
						fill="none"
						stroke={color}
						strokeWidth={strokeW}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);
		},
	},
	{
		id: "arrow-down",
		title: "Down Arrow",
		category: "arrows",
		createDefinition: (color, width) => ({
			kind: "arrow",
			from: { x: 180, y: 30 },
			to: { x: 180, y: 250 },
			headLength: 32,
			style: { stroke: { color, width: Math.max(4, width) } },
		}),
		renderPreview: (color, width) => {
			const strokeW = Math.max(2.5, Math.min(width, 6));
			return (
				<svg viewBox="0 0 80 50" className="w-full h-full">
					<line
						x1="40"
						y1="10"
						x2="40"
						y2="38"
						stroke={color}
						strokeWidth={strokeW}
						strokeLinecap="round"
					/>
					<path
						d="M30 28 L40 40 L50 28"
						fill="none"
						stroke={color}
						strokeWidth={strokeW}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);
		},
	},
	{
		id: "arrow-diagonal",
		title: "Diagonal Pointer",
		category: "arrows",
		createDefinition: (color, width) => ({
			kind: "arrow",
			from: { x: 40, y: 220 },
			to: { x: 280, y: 40 },
			headLength: 32,
			style: { stroke: { color, width: Math.max(4, width) } },
		}),
		renderPreview: (color, width) => {
			const strokeW = Math.max(2.5, Math.min(width, 6));
			return (
				<svg viewBox="0 0 80 50" className="w-full h-full">
					<line
						x1="18"
						y1="36"
						x2="58"
						y2="14"
						stroke={color}
						strokeWidth={strokeW}
						strokeLinecap="round"
					/>
					<path
						d="M44 12 L60 13 L59 28"
						fill="none"
						stroke={color}
						strokeWidth={strokeW}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			);
		},
	},
	{
		id: "emphasis-underline",
		title: "Underline Bar",
		category: "arrows",
		createDefinition: (color, width) => ({
			kind: "line",
			from: { x: 20, y: 110 },
			to: { x: 340, y: 110 },
			style: { stroke: { color, width: Math.max(6, width) } },
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<line
					x1="12"
					y1="20"
					x2="68"
					y2="20"
					stroke="#475569"
					strokeWidth="3"
					strokeDasharray="4 3"
				/>
				<line
					x1="10"
					y1="32"
					x2="70"
					y2="32"
					stroke={color}
					strokeWidth={Math.max(3, Math.min(width, 7))}
					strokeLinecap="round"
				/>
			</svg>
		),
	},

	// 3. Callout Rings & Circles
	{
		id: "callout-circle",
		title: "Circle Ring",
		category: "callouts",
		createDefinition: (color, width) => ({
			kind: "ellipse",
			width: 220,
			height: 220,
			style: { fill: null, stroke: { color, width } },
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<circle
					cx="40"
					cy="25"
					r="18"
					fill="none"
					stroke={color}
					strokeWidth={Math.min(width, 6)}
				/>
			</svg>
		),
	},
	{
		id: "callout-oval",
		title: "Oval Callout",
		category: "callouts",
		createDefinition: (color, width) => ({
			kind: "ellipse",
			width: 340,
			height: 180,
			style: { fill: null, stroke: { color, width } },
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<ellipse
					cx="40"
					cy="25"
					rx="30"
					ry="16"
					fill="none"
					stroke={color}
					strokeWidth={Math.min(width, 6)}
				/>
			</svg>
		),
	},
	{
		id: "focus-dot",
		title: "Callout Badge",
		category: "callouts",
		createDefinition: (color, width) => ({
			kind: "ellipse",
			width: 100,
			height: 100,
			style: {
				fill: color,
				stroke: { color: "#ffffff", width: Math.max(2, Math.round(width / 2)) },
			},
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<circle
					cx="40"
					cy="25"
					r="14"
					fill={color}
					stroke="#ffffff"
					strokeWidth={Math.max(1.5, Math.min(width / 2, 4))}
				/>
			</svg>
		),
	},

	// 4. Privacy & Redaction
	{
		id: "blur-redact",
		title: "Blur Mask",
		category: "privacy",
		createDefinition: (color, width) => ({
			kind: "blur",
			width: 320,
			height: 140,
			blurRadius: 18,
			style: { fill: null, stroke: { color, width: Math.min(width, 3) } },
		}),
		renderPreview: (color, width) => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<defs>
					<filter id="svg-blur-preview" x="-20%" y="-20%" width="140%" height="140%">
						<feGaussianBlur stdDeviation="3" />
					</filter>
				</defs>
				{/* Simulated background to show blur effect */}
				<g filter="url(#svg-blur-preview)">
					<rect x="10" y="10" width="60" height="30" fill="#334155" />
					<line x1="16" y1="20" x2="64" y2="20" stroke="#94a3b8" strokeWidth="4" />
					<line x1="16" y1="30" x2="52" y2="30" stroke="#94a3b8" strokeWidth="4" />
				</g>
				{/* Frosted border */}
				<rect
					x="10"
					y="10"
					width="60"
					height="30"
					rx="4"
					fill="rgba(255,255,255,0.08)"
					stroke={color}
					strokeWidth={Math.max(1, Math.min(width / 2, 3))}
					strokeDasharray="3 2"
				/>
			</svg>
		),
	},
	{
		id: "blackout-bar",
		title: "Blackout Bar",
		category: "privacy",
		createDefinition: () => ({
			kind: "rectangle",
			width: 340,
			height: 80,
			style: { fill: "#000000", stroke: { color: "#334155", width: 2 } },
		}),
		renderPreview: () => (
			<svg viewBox="0 0 80 50" className="w-full h-full">
				<rect
					x="8"
					y="14"
					width="64"
					height="22"
					rx="3"
					fill="#000000"
					stroke="#334155"
					strokeWidth="1.5"
				/>
				<text
					x="40"
					y="29"
					fill="#64748b"
					fontSize="8"
					fontWeight="600"
					textAnchor="middle"
				>
					REDACT
				</text>
			</svg>
		),
	},
];

export function ShapeLibrary({
	onAddShape,
	onClose,
	activeTab = "shapes",
	onSelectTab,
}: ShapeLibraryProps) {
	const [activeCategory, setActiveCategory] = useState<ShapeCategory>("all");
	const [activeColor, setActiveColor] = useState<string>("#6FA8FF");
	const [activeWeight, setActiveWeight] = useState<number>(6);
	const [searchQuery, setSearchQuery] = useState("");

	const filteredPresets = useMemo(() => {
		return SHAPE_PRESETS.filter((item) => {
			const matchesCategory = activeCategory === "all" || item.category === activeCategory;
			const matchesSearch =
				searchQuery.trim() === "" ||
				item.title.toLowerCase().includes(searchQuery.toLowerCase());
			return matchesCategory && matchesSearch;
		});
	}, [activeCategory, searchQuery]);

	const handleSelectPreset = (preset: ShapePresetItem) => {
		const shapeDef = preset.createDefinition(activeColor, activeWeight);
		onAddShape(shapeDef);
	};

	return (
		<aside className="project-assets project-shapes-panel select-none">
			{/* Panel Header */}
			<header className="project-panel-header">
				{onSelectTab ? (
					<div className="project-sidebar-top-tabs">
						<button
							type="button"
							className={`project-sidebar-top-tab ${activeTab === "assets" ? "active" : ""}`}
							onClick={() => onSelectTab("assets")}
						>
							Assets
						</button>
						<button
							type="button"
							className={`project-sidebar-top-tab ${activeTab === "shapes" ? "active" : ""}`}
							onClick={() => onSelectTab("shapes")}
						>
							Shapes &amp; Highlights
							<span>{filteredPresets.length}</span>
						</button>
					</div>
				) : (
					<h2>
						Highlights &amp; Shapes
						<span>{filteredPresets.length}</span>
					</h2>
				)}
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="project-panel-close-btn"
						title="Close Shapes"
						aria-label="Close Shapes"
					>
						<X size={15} />
					</button>
				)}
			</header>

			{/* SUB MENU AT THE VERY TOP (Category Tabs) */}
			<div className="project-sub-tabs" role="tablist" aria-label="Shape categories">
				{(
					[
						{ id: "all", label: "All" },
						{ id: "highlights", label: "Focus & Box" },
						{ id: "arrows", label: "Arrows" },
						{ id: "callouts", label: "Callouts" },
						{ id: "privacy", label: "Privacy" },
					] as const
				).map((tab) => (
					<button
						key={tab.id}
						type="button"
						role="tab"
						aria-selected={activeCategory === tab.id}
						onClick={() => setActiveCategory(tab.id)}
						className={`project-sub-tab-btn ${activeCategory === tab.id ? "active" : ""}`}
					>
						{tab.label}
					</button>
				))}
			</div>

			{/* Search input */}
			<div className="project-shapes-search">
				<div className="project-shapes-search-inner">
					<MagnifyingGlass size={13} className="text-muted-foreground shrink-0" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search shapes & highlights..."
						aria-label="Search shapes & highlights"
					/>
				</div>
			</div>

			{/* Quick Customization Toolbar: Color Palette & Thickness */}
			<div className="project-shapes-toolbar">
				<div className="project-shapes-toolbar-row">
					<span className="project-shapes-toolbar-label">Preset Color</span>
					<div className="project-shapes-colors">
						{PRESET_COLORS.map((c) => (
							<button
								key={c.value}
								type="button"
								onClick={() => setActiveColor(c.value)}
								className={`project-shape-color-swatch ${
									activeColor.toLowerCase() === c.value.toLowerCase()
										? "active"
										: ""
								}`}
								style={{ backgroundColor: c.value }}
								title={c.label}
								aria-label={`Color ${c.label}`}
							/>
						))}
						<label
							className="project-shape-color-picker-btn relative"
							title="Custom color picker"
							aria-label="Custom color picker"
						>
							<input
								type="color"
								value={activeColor}
								onChange={(e) => setActiveColor(e.target.value)}
								className="w-full h-full p-0 border-0 cursor-pointer opacity-0 absolute inset-0"
								aria-label="Custom color input"
							/>
							<span
								className="w-3 h-3 rounded-sm border border-white/20"
								style={{ backgroundColor: activeColor }}
							/>
						</label>
					</div>
				</div>

				<div className="project-shapes-toolbar-row">
					<span className="project-shapes-toolbar-label">Stroke Width</span>
					<div className="project-shape-weights">
						{STROKE_WEIGHTS.map((w) => (
							<button
								key={w.value}
								type="button"
								onClick={() => setActiveWeight(w.value)}
								className={`project-shape-weight-btn ${
									activeWeight === w.value ? "active" : ""
								}`}
							>
								{w.label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Visual Shapes Grid */}
			<div className="project-shapes-grid">
				{filteredPresets.map((preset) => (
					<button
						key={preset.id}
						type="button"
						onClick={() => handleSelectPreset(preset)}
						className="project-shape-card"
						title={`Add ${preset.title}`}
						aria-label={`Add ${preset.title}`}
					>
						{/* Visual shape rendering */}
						<div className="project-shape-preview-box">
							{preset.renderPreview(activeColor, activeWeight)}
						</div>
						{/* Shape Title */}
						<span className="project-shape-card-title">{preset.title}</span>
					</button>
				))}

				{filteredPresets.length === 0 && (
					<div className="col-span-2 text-center py-8 text-muted-foreground text-xs">
						No matching shapes found
					</div>
				)}
			</div>
		</aside>
	);
}
