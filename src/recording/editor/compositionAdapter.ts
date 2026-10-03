import type { RecordComposition, RecordingPackage, RecordingSettings } from "../types";
import { createDefaultRecordingSettings, type RecordingEffectSettings } from "../schema";
import { compositionTimeMap } from "../packageAdapter";
export type ResolvedRecordingSettings=RecordingEffectSettings & RecordingSettings;
export function resolveRecordingSettings(pkg:RecordingPackage,composition:RecordComposition):ResolvedRecordingSettings {
 const defaults=createDefaultRecordingSettings();const settings={...defaults,...structuredClone(pkg.settings),...structuredClone(composition.settings)};
 return {...settings,videoPath:pkg.screen.path,webcamPath:pkg.webcam?.path??null,microphoneAudioPath:pkg.microphone?.path??null,systemAudioPath:pkg.system?.path??null,cursorTelemetryPath:pkg.cursorPath??null,webcam:{...defaults.webcam,...settings.webcam,sourcePath:pkg.webcam?.path??null,timeOffsetMs:(pkg.webcam?.offsetUs??0)/1000}};
}
export function changeRecordingSettings(pkg:RecordingPackage,composition:RecordComposition,patch:Partial<RecordingSettings>):RecordComposition {
 const proposed={...structuredClone(composition),settings:{...structuredClone(composition.settings),...structuredClone(patch)}};
 proposed.settings=resolveRecordingSettings(pkg,proposed);
 const timeMap=compositionTimeMap(pkg.durationUs,proposed.settings),durationUs=timeMap.at(-1)?.outputEndUs??0;
 if(!durationUs)throw new Error("Recording composition cannot be empty");
 return {...proposed,timeMap,durationUs};
}
