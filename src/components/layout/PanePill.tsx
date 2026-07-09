type PanePillTone = "accent" | "success" | "warning" | "muted";

type PanePillProps = {
  label: string;
  tone?: PanePillTone;
};

const toneClasses: Record<PanePillTone, string> = {
  accent: "border-sky-400 bg-sky-400/10 text-sky-400",
  success: "border-green-500 bg-green-950 text-green-200",
  warning: "border-amber-500 bg-amber-950 text-amber-100",
  muted: "border-slate-700 bg-slate-900 text-slate-400",
};

export function PanePill({ label, tone = "muted" }: PanePillProps) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${toneClasses[tone]}`}>{label}</span>;
}
