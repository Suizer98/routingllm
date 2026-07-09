import type { ReactNode } from "react";

import { PanePill } from "@/components/layout/PanePill";
import { useLocationStore } from "@/stores/locationStore";

export type PaneTab = "layers" | "chats";

type PaneTabsProps = {
  activeTab: PaneTab;
  onTabChange: (tab: PaneTab) => void;
};

const tabs: Array<{ id: PaneTab; label: string }> = [
  { id: "layers", label: "Layers" },
  { id: "chats", label: "Chats" },
];

export function PaneTabs({ activeTab, onTabChange }: PaneTabsProps) {
  return (
    <div
      className="flex gap-1 rounded-full border border-slate-700 bg-slate-800 p-1"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`flex-1 cursor-pointer rounded-full border-none px-3 py-2 text-sm font-medium transition-colors duration-150 ${
            activeTab === tab.id
              ? "bg-slate-900 font-semibold text-slate-100"
              : "bg-transparent text-slate-400 hover:text-slate-100"
          }`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function PaneHeader() {
  const start = useLocationStore((state) => state.start);
  const end = useLocationStore((state) => state.end);

  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-xl font-bold text-slate-100">Routing LLM</h1>
        <PanePill label={`${start.shortLabel} → ${end.shortLabel}`} tone="accent" />
      </div>
      <p className="m-0 text-sm leading-snug text-slate-400">
        {start.label} to {end.label} on a live road graph
      </p>
    </header>
  );
}

type PaneCardProps = {
  title: string;
  children: ReactNode;
};

export function PaneCard({ title, children }: PaneCardProps) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
      <h2 className="m-0 mb-3 text-[0.6875rem] font-bold tracking-widest text-slate-400 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PaneDivider() {
  return <hr className="m-0 h-px border-0 bg-slate-700" />;
}
