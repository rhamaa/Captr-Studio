/**
 * Global Feature Flags for Captr Studio.
 * Set features to false to temporarily hide UI/buttons while under re-planning.
 * Hidden features keep their project data: existing `.captr` content is preserved, only the
 * entry points are removed.
 */

/** AI Editor (Ctrl+K command bar, Copilot, AI settings tab, Hyperframe AI agent). */
export const FEATURE_AI_ENABLED = false;

/** Hyperframe code-driven motion graphics cards and editor. */
export const FEATURE_HYPERFRAME_ENABLED = false;
