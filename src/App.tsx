import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Pressable } from "@gluestack-ui/themed";

import { LeftPane } from "@/components/layout/LeftPane";
import { RouteMap } from "@/components/map/RouteMap";

import "./App.css";

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

  return (
    <Box width="100%" height="100%" position="relative" overflow="hidden">
      <Box className="map-pane" aria-label="Route map" width="100%" height="100%">
        <RouteMap />
      </Box>

      <Pressable
        position="fixed"
        top="$4"
        left="$4"
        zIndex={4}
        width={40}
        height={40}
        borderWidth={1}
        borderColor="$borderLight200"
        borderRadius="$lg"
        bg="$backgroundLight50"
        alignItems="center"
        justifyContent="center"
        onPress={() => setPaneOpen((value) => !value)}
        accessibilityLabel={paneOpen ? "Collapse left pane" : "Expand left pane"}
        sx={{
          boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
        }}
      >
        <Box gap="$1" alignItems="center">
          <Box width={16} height={2} bg="$textLight900" borderRadius="$full" />
          <Box width={16} height={2} bg="$textLight900" borderRadius="$full" />
          <Box width={16} height={2} bg="$textLight900" borderRadius="$full" />
        </Box>
      </Pressable>

      <LeftPane
        open={paneOpen}
        width={paneWidth}
        onResizeStart={startResize}
      />
    </Box>
  );
}

export default App;
