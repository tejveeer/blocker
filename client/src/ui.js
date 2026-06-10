// Reusable Tailwind class compositions shared across components.

export const card = "rounded-xl border border-border bg-surface p-5";

export const input =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-text outline-none transition focus:border-primary";

export const fieldLabel = "flex flex-col gap-1.5 text-xs text-muted";

const btnBase =
  "cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export const btn = {
  primary: `${btnBase} bg-primary text-white hover:bg-primary-hover`,
  warn: `${btnBase} bg-warn text-[#1a1205] hover:brightness-95`,
  ghost: `${btnBase} border border-border bg-transparent text-text hover:bg-surface2`,
  danger: `${btnBase} border border-danger/40 bg-transparent text-danger hover:bg-danger/10`,
};
