import { useState } from "react";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { LayerList } from "@/components/layers/LayerList";
import { RouteControls } from "@/components/layers/RouteControls";
import {
  PaneCard,
  PaneDivider,
  PaneHeader,
  PaneTabs,
  type PaneTab,
} from "@/components/layout/PaneTabs";

type LeftPaneProps = {
  open: boolean;
  width: number;
  onResizeStart: () => void;
};

export function LeftPane({ open, width, onResizeStart }: LeftPaneProps) {
  const [activeTab, setActiveTab] = useState<PaneTab>("layers");

  return (
    <div
      className="fixed top-0 left-0 z-[2] box-border flex h-screen flex-col px-4 pt-[4.25rem] pb-4 font-sans text-slate-100 transition-[transform,opacity,box-shadow] duration-200 ease-out"
      aria-hidden={!open}
      style={{
        width,
        maxWidth: "50vw",
        background: "#0f172a",
        borderRight: "1px solid #334155",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        boxShadow: open ? "0 12px 40px rgba(0, 0, 0, 0.55)" : "none",
      }}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4">
        <PaneHeader />
        <PaneTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="scrollbar-pane flex min-h-0 w-full flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pb-2">
          {activeTab === "layers" ? (
            <>
              <PaneCard title="Map layers">
                <LayerList />
              </PaneCard>
              <PaneDivider />
              <PaneCard title="Algorithms">
                <RouteControls />
              </PaneCard>
            </>
          ) : (
            <PaneCard title="Assistant">
              <ChatPanel />
            </PaneCard>
          )}
        </div>
      </div>

      <div
        className="absolute top-0 right-[-6px] h-full w-3 cursor-col-resize"
        onPointerDown={(event) => {
          event.preventDefault();
          onResizeStart();
        }}
        role="separator"
        aria-label="Resize left pane"
      />
    </div>
  );
}
