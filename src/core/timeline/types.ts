import type { MediaSource, RecordingPackage, RecordComposition } from "@/recording/types";
export type { MediaSource, RecordingPackage, RecordComposition, CompletedRecording } from "@/recording/types";
export interface MediaAsset { id: string; kind: "video" | "image" | "audio" | "recording"; name: string; durationUs: number; width: number; height: number; source?: MediaSource; packageId?: string; thumbnail?: string }
export interface ClipTransform { x: number; y: number; scale: number; rotation: number; opacity: number }
export interface TimelineClip { id: string; assetId: string; compositionId?: string; startUs: number; sourceInUs: number; sourceOutUs: number; rate: number; transform: ClipTransform; gain: number; enabled: boolean }
export interface TimelineTrack { id: string; name: string; kind: "visual" | "audio"; locked: boolean; muted: boolean; hidden: boolean; clips: TimelineClip[] }
export interface TimelineProject { version: 3; projectId: string; title: string; canvas: { width: number; height: number; fps: number }; assets: MediaAsset[]; packages: RecordingPackage[]; compositions: RecordComposition[]; tracks: TimelineTrack[]; createdAt: string; updatedAt: string }
export const clipDurationUs = (clip: TimelineClip) => Math.round((clip.sourceOutUs - clip.sourceInUs) / clip.rate);
export const projectDurationUs = (project: TimelineProject) => Math.max(0,...project.tracks.flatMap(t=>t.clips.filter(c=>c.enabled).map(c=>c.startUs+clipDurationUs(c))));
