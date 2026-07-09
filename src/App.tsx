import { useCallback, useEffect, useRef, useState } from "react";

import { LeftPane } from "@/components/layout/LeftPane";
import { RouteMap } from "@/components/map/RouteMap";
import { useLocationStore } from "@/stores/locationStore";

const minPaneWidth = 280;
const defaultPaneWidth = 320;

function App() {
  const [paneOpen, setPaneOpen] = useState(true);
  const [paneWidth, setPaneWidth] = useState(defaultPaneWidth);
  const resizingRef = useRef(false);

  const clampPaneWidth = useCallback((width: number) => {
    const maxPaneWidth = Math.max(160, window.innerWidth / 2);
    const minAllowedWidth = Math.min(minPaneWidth, maxPaneWidth);
    return Math.min(Math.max(width, minAllowedWidth), maxPaneWidth);
  }, []);

  const stopResize = useCallback(() => {
    resizingRef.current = false;
    document.body.classList.remove("is-resizing-pane");
  }, []);

  useEffect(() => {
    void useLocationStore.getState().resolveEndpoints();
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizingRef.current) {
        return;
      }

      setPaneWidth(clampPaneWidth(event.clientX));
    };

    const handleResize = () => {
      setPaneWidth((width) => clampPaneWidth(width));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("resize", handleResize);
    };
  }, [clampPaneWidth, stopResize]);

  const startResize = () => {
    resizingRef.current = true;
    document.body.classList.add("is-resizing-pane");
  };

  const mapChromeInsetLeft = paneOpen ? paneWidth + 16 : 16;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-900">
      <div className="fixed inset-0 z-0" aria-label="Route map">
        <RouteMap chromeInsetLeft={mapChromeInsetLeft} />
      </div>

      <button
        type="button"
        className="fixed top-4 z-[4] flex h-[42px] w-[42px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 p-0 shadow-lg transition-[left,background-color] duration-200 ease-out hover:bg-slate-700/80"
        onClick={() => setPaneOpen((value) => !value)}
        aria-label={paneOpen ? "Collapse left pane" : "Expand left pane"}
        style={{ left: mapChromeInsetLeft }}
      >
        <span className="h-0.5 w-4 rounded-full bg-slate-100" />
        <span className="h-0.5 w-4 rounded-full bg-slate-100" />
        <span className="h-0.5 w-4 rounded-full bg-slate-100" />
      </button>

      <LeftPane open={paneOpen} width={paneWidth} onResizeStart={startResize} />
    </div>
  );
}

export default App;
