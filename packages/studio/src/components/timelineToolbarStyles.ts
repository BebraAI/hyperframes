// CapCut-flat icon buttons: a transparent 28px hit area with a subtle hover wash.
export const flatBtn = "flex h-7 w-7 items-center justify-center rounded-lg transition-colors";
export const flatIdle = `${flatBtn} text-text-2 hover:bg-hover hover:text-text-0 active:bg-press active:scale-[0.98]`;
export const flatActive = `${flatBtn} bg-on text-text-0 hover:bg-on-hover active:scale-[0.98]`;
export const flatDisabled = `${flatBtn} text-text-off cursor-not-allowed`;
// A toggle that shows text (the zoom readout): same states as flatIdle and flatActive, sized to its text.
const flatText = "flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 transition-colors";
export const flatTextIdle = `${flatText} text-text-2 hover:bg-hover hover:text-text-0 active:bg-press`;
export const flatTextActive = `${flatText} bg-on text-text-0 hover:bg-on-hover`;
