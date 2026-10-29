/** The one owner of context menu spacing, in BoardUI's menu recipe: padded panel, rounded rows. */
export const menuClasses = {
  panel:
    "flex flex-col gap-1 overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default p-2.5 shadow-dropdown",
  group: "empty:hidden flex flex-col gap-1",
  divider: "-mx-2.5 my-1 h-px shrink-0 bg-border-button-default",
  row: "flex w-full items-center gap-2 rounded-2lg p-2 text-left text-body-medium outline-hidden",
  rowEnabled:
    "text-text-primary hover:bg-dropdown-item-hover-background focus-visible:bg-dropdown-item-hover-background cursor-pointer",
  rowDanger:
    "text-text-destructive hover:bg-dropdown-item-hover-background focus-visible:bg-dropdown-item-hover-background cursor-pointer",
  rowDisabled: "text-text-primary opacity-50 cursor-not-allowed",
} as const;
