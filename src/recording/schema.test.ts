import { describe, expect, it } from "vitest";
import { createDefaultRecordingSettings, isValidRecordingSettings, resolveRecordingFrameAppearances, type RecordingFrameAppearance } from "./schema";
import { changeRecordingSettings, resolveRecordingSettings } from "./editor/compositionAdapter";
import type { RecordComposition, RecordingPackage } from "./types";

const appearance = (cornerRadius = 18): RecordingFrameAppearance => ({
 framePadding: 8, borderWidth: 2, borderColor: "#123456", borderOpacity: 0.8,
 cornerRadius, surfaceColor: "#abcdef", surfaceOpacity: 0.2, backdropBlur: 12,
 shadow: { color: "#000000", opacity: 0.3, blur: 14, offsetX: -2, offsetY: 4 },
});

describe("recording frame appearances", () => {
 it("resolves neutral new fields and legacy default radius/shadow", () => {
  const resolved = resolveRecordingFrameAppearances({});
  expect(resolved.window).toEqual({ framePadding: 0, borderWidth: 0, borderColor: "#000000", borderOpacity: 0, cornerRadius: 12.5, surfaceColor: "#000000", surfaceOpacity: 0, backdropBlur: 0, shadow: { color: "#000000", opacity: 0, blur: 0, offsetX: 0, offsetY: 0 } });
  expect(resolved.webcam).toEqual({ ...resolved.window, cornerRadius: 50, shadow: { ...resolved.window.shadow, opacity: 0.5 } });
 });
 it("falls back to the current legacy settings without materializing defaults", () => {
  const settings = createDefaultRecordingSettings();
  expect(settings.frameAppearances).toBeUndefined();
  settings.borderRadius = 29;
  settings.webcam.cornerRadius = 37;
  settings.webcam.shadow = 0.75;
  const resolved = resolveRecordingFrameAppearances(settings);
  expect(resolved.window.cornerRadius).toBe(29);
  expect(resolved.webcam.cornerRadius).toBe(37);
  expect(resolved.webcam.shadow.opacity).toBe(0.75);
  expect(isValidRecordingSettings(settings)).toBe(true);
 });
 it("keeps independent explicit target values and returns fresh snapshots", () => {
  const settings = { frameAppearances: { window: appearance(10), webcam: appearance(32) } };
  const resolved = resolveRecordingFrameAppearances(settings);
  expect(resolved).toEqual(settings.frameAppearances);
  resolved.window.shadow.opacity = 0;
  expect(settings.frameAppearances.window.shadow.opacity).toBe(0.3);
  expect(resolved.webcam.shadow.opacity).toBe(0.3);
 });
 it("fills missing nested fields while retaining explicit zero values", () => {
  const settings = { borderRadius: 29, frameAppearances: { window: { cornerRadius: 0, shadow: { offsetX: -3 } } } };
  const resolved = resolveRecordingFrameAppearances(settings as never);
  expect(resolved.window.cornerRadius).toBe(0);
  expect(resolved.window.shadow).toEqual({ color: "#000000", opacity: 0, blur: 0, offsetX: -3, offsetY: 0 });
  expect(resolved.webcam.cornerRadius).toBe(50);
 });
 it("fills explicitly undefined nested fields", () => {
  const settings = { frameAppearances: { window: { framePadding: undefined, cornerRadius: undefined, shadow: { opacity: undefined } } } };
  const resolved = resolveRecordingFrameAppearances(settings as never);
  expect(resolved.window.framePadding).toBe(0);
  expect(resolved.window.cornerRadius).toBe(12.5);
  expect(resolved.window.shadow.opacity).toBe(0);
 });
 it("accepts complete styles and rejects malformed nested values", () => {
  const settings = { ...createDefaultRecordingSettings(), frameAppearances: { window: appearance(), webcam: appearance(35) } };
  expect(isValidRecordingSettings(settings)).toBe(true);
  for (const patch of [{ framePadding: -1 }, { borderWidth: Infinity }, { cornerRadius: NaN }, { backdropBlur: -1 }, { borderOpacity: 1.01 }, { surfaceOpacity: -0.1 }, { borderColor: 5 }, { surfaceColor: "" }, { shadow: null }, { shadow: { ...appearance().shadow, opacity: 2 } }, { shadow: { ...appearance().shadow, blur: -1 } }, { shadow: { ...appearance().shadow, offsetY: Infinity } }]) {
   expect(isValidRecordingSettings({ ...settings, frameAppearances: { ...settings.frameAppearances, window: { ...appearance(), ...patch } } })).toBe(false);
  }
  expect(isValidRecordingSettings({ ...settings, frameAppearances: {} })).toBe(false);
  expect(isValidRecordingSettings({ ...settings, frameAppearances: null })).toBe(false);
 });
 it("keeps legacy appearance absence on unrelated composition edits", () => {
  const pkg = { durationUs: 1000000, settings: {}, screen: { path: "screen.mp4" } } as RecordingPackage;
  const composition = { settings: {} } as RecordComposition;
  expect(changeRecordingSettings(pkg, composition, { wallpaper: "custom.jpg" }).settings.frameAppearances).toBeUndefined();
  const styles = { window: appearance(), webcam: appearance(32) };
  expect(changeRecordingSettings(pkg, composition, { frameAppearances: styles }).settings.frameAppearances).toEqual(styles);
 });
 it("resolves composition overrides and retains package paths and other settings", () => {
  const pkg = { settings: { borderRadius: 22, shadowIntensity: 0.9 }, screen: { path: "screen.mp4" }, webcam: { path: "camera.mp4", offsetUs: 2000 } } as RecordingPackage;
  const composition = { settings: { wallpaper: "custom.jpg", frameAppearances: { window: appearance(6), webcam: appearance(24) } } } as RecordComposition;
  const resolved = resolveRecordingSettings(pkg, composition);
  expect(resolved.frameAppearances).toEqual(composition.settings.frameAppearances);
  expect(resolved).toMatchObject({ borderRadius: 22, shadowIntensity: 0.9, wallpaper: "custom.jpg", videoPath: "screen.mp4", webcamPath: "camera.mp4", webcam: { sourcePath: "camera.mp4", timeOffsetMs: 2, mirror: true } });
  expect(resolveRecordingSettings(pkg, { settings: {} } as RecordComposition).frameAppearances.window.cornerRadius).toBe(22);
 });
});
