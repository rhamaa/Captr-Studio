import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { slideRegistry } from "./registry";
import type {
	CanvasDimensions,
	ProjectV2Data,
	SlideData,
	SlideTransition,
	SlideType,
	TransitionType,
} from "./types";

interface SlideDeckContextValue {
	project: ProjectV2Data;
	activeSlideId: string | null;
	activeSlide: SlideData | null;
	setActiveSlideId: (id: string) => void;
	addSlide: (type: SlideType, title?: string) => string;
	removeSlide: (id: string) => void;
	reorderSlides: (sourceIndex: number, destinationIndex: number) => void;
	updateSlideMeta: <TMeta = Record<string, unknown>>(
		slideId: string,
		updater: (prev: TMeta) => TMeta,
	) => void;
	updateSlideTitle: (slideId: string, title: string) => void;
	updateSlideDuration: (slideId: string, durationMs: number) => void;
	setTransition: (
		fromSlideId: string,
		toSlideId: string,
		type: TransitionType,
		durationMs?: number,
	) => void;
	removeTransition: (fromSlideId: string, toSlideId: string) => void;
	getTransitionBetween: (fromSlideId: string, toSlideId: string) => SlideTransition | null;
	updateCanvasDimensions: (dimensions: Partial<CanvasDimensions>) => void;
}

const SlideDeckContext = createContext<SlideDeckContextValue | null>(null);

export const DEFAULT_CANVAS: CanvasDimensions = {
	width: 1920,
	height: 1080,
	fps: 60,
	aspectRatio: "16:9",
};

interface SlideDeckProviderProps {
	initialProject?: ProjectV2Data;
	children: React.ReactNode;
}

export function SlideDeckProvider({ initialProject, children }: SlideDeckProviderProps) {
	const [project, setProject] = useState<ProjectV2Data>(() => {
		if (initialProject) return initialProject;
		const defaultId = `slide-1-${Date.now()}`;
		return {
			version: 2,
			projectId: `proj-${Date.now()}`,
			title: "Untitled Project",
			canvas: DEFAULT_CANVAS,
			slides: [
				{
					id: defaultId,
					type: "record",
					title: "Slide 1",
					durationMs: 5000,
					order: 0,
					dirName: "slide_01_record",
					meta: slideRegistry.has("record")
						? slideRegistry.get("record").createDefaultMeta()
						: {},
				},
			],
			transitions: [],
			globalAudioTracks: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
	});

	const [activeSlideId, setActiveSlideId] = useState<string | null>(() => {
		return project.slides[0]?.id ?? null;
	});

	const activeSlide = useMemo(() => {
		return project.slides.find((s) => s.id === activeSlideId) ?? project.slides[0] ?? null;
	}, [project.slides, activeSlideId]);

	const addSlide = useCallback((type: SlideType, title?: string) => {
		const newId = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		let defaultMeta: Record<string, unknown> = {};

		if (slideRegistry.has(type)) {
			try {
				defaultMeta = slideRegistry.get(type).createDefaultMeta();
			} catch (e) {
				console.warn(`[SlideDeckContext] Failed to get defaultMeta for ${type}:`, e);
			}
		}

		setProject((prev) => {
			const order = prev.slides.length;
			const slideTitle = title || `Slide ${order + 1}`;
			const newSlide: SlideData = {
				id: newId,
				type,
				title: slideTitle,
				durationMs: 5000,
				order,
				dirName: `slide_${String(order + 1).padStart(2, "0")}_${type}`,
				meta: defaultMeta,
			};

			const newSlides = [...prev.slides, newSlide];

			// Auto create transition from previous slide
			const newTransitions = [...prev.transitions];
			if (prev.slides.length > 0) {
				const prevSlide = prev.slides[prev.slides.length - 1];
				newTransitions.push({
					id: `trans-${prevSlide.id}-${newId}`,
					fromSlideId: prevSlide.id,
					toSlideId: newId,
					type: "crossfade",
					durationMs: 500,
				});
			}

			return {
				...prev,
				slides: newSlides,
				transitions: newTransitions,
				updatedAt: Date.now(),
			};
		});

		setActiveSlideId(newId);
		return newId;
	}, []);

	const removeSlide = useCallback(
		(id: string) => {
			setProject((prev) => {
				if (prev.slides.length <= 1) {
					console.warn("[SlideDeckContext] Cannot remove the only remaining slide.");
					return prev;
				}

				const filteredSlides = prev.slides
					.filter((s) => s.id !== id)
					.map((s, idx) => ({ ...s, order: idx }));

				// Remove transitions involving deleted slide
				const filteredTransitions = prev.transitions.filter(
					(t) => t.fromSlideId !== id && t.toSlideId !== id,
				);

				return {
					...prev,
					slides: filteredSlides,
					transitions: filteredTransitions,
					updatedAt: Date.now(),
				};
			});

			if (activeSlideId === id) {
				const remaining = project.slides.filter((s) => s.id !== id);
				setActiveSlideId(remaining[0]?.id ?? null);
			}
		},
		[activeSlideId, project.slides],
	);

	const reorderSlides = useCallback((sourceIndex: number, destinationIndex: number) => {
		setProject((prev) => {
			if (
				sourceIndex < 0 ||
				sourceIndex >= prev.slides.length ||
				destinationIndex < 0 ||
				destinationIndex >= prev.slides.length
			) {
				return prev;
			}

			const reordered = [...prev.slides];
			const [moved] = reordered.splice(sourceIndex, 1);
			reordered.splice(destinationIndex, 0, moved);

			const updated = reordered.map((slide, idx) => ({
				...slide,
				order: idx,
			}));

			return {
				...prev,
				slides: updated,
				updatedAt: Date.now(),
			};
		});
	}, []);

	const updateSlideMeta = useCallback(
		<TMeta = Record<string, unknown>>(slideId: string, updater: (prev: TMeta) => TMeta) => {
			setProject((prev) => {
				const updated = prev.slides.map((slide) => {
					if (slide.id !== slideId) return slide;
					return {
						...slide,
						meta: updater(slide.meta as TMeta) as Record<string, unknown>,
					};
				});
				return {
					...prev,
					slides: updated,
					updatedAt: Date.now(),
				};
			});
		},
		[],
	);

	const updateSlideTitle = useCallback((slideId: string, title: string) => {
		setProject((prev) => ({
			...prev,
			slides: prev.slides.map((slide) => (slide.id === slideId ? { ...slide, title } : slide)),
			updatedAt: Date.now(),
		}));
	}, []);

	const updateSlideDuration = useCallback((slideId: string, durationMs: number) => {
		setProject((prev) => ({
			...prev,
			slides: prev.slides.map((slide) =>
				slide.id === slideId ? { ...slide, durationMs: Math.max(100, durationMs) } : slide,
			),
			updatedAt: Date.now(),
		}));
	}, []);

	const setTransition = useCallback(
		(fromSlideId: string, toSlideId: string, type: TransitionType, durationMs = 500) => {
			setProject((prev) => {
				const existingIdx = prev.transitions.findIndex(
					(t) => t.fromSlideId === fromSlideId && t.toSlideId === toSlideId,
				);

				const transition: SlideTransition = {
					id: `trans-${fromSlideId}-${toSlideId}`,
					fromSlideId,
					toSlideId,
					type,
					durationMs,
				};

				let newTransitions = [...prev.transitions];
				if (existingIdx >= 0) {
					newTransitions[existingIdx] = transition;
				} else {
					newTransitions.push(transition);
				}

				return {
					...prev,
					transitions: newTransitions,
					updatedAt: Date.now(),
				};
			});
		},
		[],
	);

	const removeTransition = useCallback((fromSlideId: string, toSlideId: string) => {
		setProject((prev) => ({
			...prev,
			transitions: prev.transitions.filter(
				(t) => !(t.fromSlideId === fromSlideId && t.toSlideId === toSlideId),
			),
			updatedAt: Date.now(),
		}));
	}, []);

	const getTransitionBetween = useCallback(
		(fromSlideId: string, toSlideId: string) => {
			return (
				project.transitions.find(
					(t) => t.fromSlideId === fromSlideId && t.toSlideId === toSlideId,
				) ?? null
			);
		},
		[project.transitions],
	);

	const updateCanvasDimensions = useCallback((dimensions: Partial<CanvasDimensions>) => {
		setProject((prev) => ({
			...prev,
			canvas: { ...prev.canvas, ...dimensions },
			updatedAt: Date.now(),
		}));
	}, []);

	const value = useMemo<SlideDeckContextValue>(
		() => ({
			project,
			activeSlideId,
			activeSlide,
			setActiveSlideId,
			addSlide,
			removeSlide,
			reorderSlides,
			updateSlideMeta,
			updateSlideTitle,
			updateSlideDuration,
			setTransition,
			removeTransition,
			getTransitionBetween,
			updateCanvasDimensions,
		}),
		[
			project,
			activeSlideId,
			activeSlide,
			addSlide,
			removeSlide,
			reorderSlides,
			updateSlideMeta,
			updateSlideTitle,
			updateSlideDuration,
			setTransition,
			removeTransition,
			getTransitionBetween,
			updateCanvasDimensions,
		],
	);

	return <SlideDeckContext.Provider value={value}>{children}</SlideDeckContext.Provider>;
}

export function useSlideDeck(): SlideDeckContextValue {
	const context = useContext(SlideDeckContext);
	if (!context) {
		throw new Error("useSlideDeck must be used within a SlideDeckProvider");
	}
	return context;
}
