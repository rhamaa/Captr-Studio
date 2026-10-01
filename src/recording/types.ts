import type { ProjectEditorState } from "@/components/video-editor/projectNormalization";
import type { RecordSlideMeta } from "@/slides/record/schema";

export type RecordingSettings = Omit<Partial<ProjectEditorState>, keyof RecordSlideMeta> & Partial<RecordSlideMeta>;
export interface MediaSource { path: string; durationUs: number; offsetUs: number }
export interface RecordingPackage {
 id: string; captureId: string; schemaVersion: 1; durationUs: number; width: number; height: number;
 screen: MediaSource; webcam?: MediaSource; microphone?: MediaSource; system?: MediaSource;
 cursorPath?: string; settings: RecordingSettings; diagnostics?: Record<string, unknown>;
}
export interface CompletedRecording extends Omit<RecordingPackage, "id" | "schemaVersion"> { name: string }
export interface TimeMapSegment { outputStartUs: number; outputEndUs: number; sourceStartUs: number; rate: number }
export interface RecordComposition { id: string; packageId: string; revision: number; durationUs: number; settings: RecordingSettings; timeMap: TimeMapSegment[] }
