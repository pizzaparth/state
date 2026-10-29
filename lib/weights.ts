/**
 * Execution weights (docs/state_desc.md §33). Each level is roughly double the one
 * below; the hint is the rubric shown wherever a weight is chosen.
 */
export const WEIGHT_LEVELS = [
  { value: 1, label: "Small", hint: "A quick, contained change. Under about an hour, no planning needed." },
  { value: 2, label: "Normal", hint: "A typical piece of work, a few hours. Pick this when unsure." },
  { value: 4, label: "Major", hint: "About twice a normal piece of work. A day or more, several steps." },
  { value: 8, label: "Milestone", hint: "A finished outcome, not a step: a release or a shipped feature." },
] as const;

export type Weight = (typeof WEIGHT_LEVELS)[number]["value"];

export const weightLevel = (weight: number) => WEIGHT_LEVELS.find((w) => w.value === weight);

/** "Major" for 4; "Custom" for anything outside the scale. */
export const weightLabel = (weight: number) => weightLevel(weight)?.label ?? "Custom";

/** "Major, 4: About twice a normal piece of work…" */
export const weightHint = (weight: number) => {
  const level = weightLevel(weight);
  return level ? `${level.label}, ${level.value}: ${level.hint}` : `Weight ${weight}`;
};
