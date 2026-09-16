import { VoiceoverStudio } from "../../voiceover/VoiceoverStudio";
import { SectionLabel } from "../components/SettingsSectionLabel";
import { AudioTrackSection, type AudioTrackSectionProps } from "./AudioTrackSection";

export interface AudioRecordSectionProps extends AudioTrackSectionProps {
	currentTime?: number;
	onAudioAdded?: (span: { start: number; end: number }, audioPath: string) => void;
}

export function AudioRecordSection({
	currentTime = 0,
	onAudioAdded,
	tSettings,
	...audioTrackProps
}: AudioRecordSectionProps) {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<SectionLabel>{tSettings("sections.audioRecord", "Voiceover & Audio")}</SectionLabel>
				<p className="mt-0.5 text-[10px] text-muted-foreground">
					{tSettings(
						"audioRecord.description",
						"Record microphone voiceover directly or adjust audio track levels",
					)}
				</p>
			</div>

			<VoiceoverStudio
				onAudioRecorded={onAudioAdded}
				currentTime={currentTime}
			/>

			<div className="pt-2 border-t border-foreground/10">
				<AudioTrackSection tSettings={tSettings} {...audioTrackProps} />
			</div>
		</section>
	);
}
