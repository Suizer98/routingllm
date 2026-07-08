import { useState } from "react";
import { Box, VStack } from "@gluestack-ui/themed";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { LayerList } from "@/components/layers/LayerList";
import { RouteControls } from "@/components/layers/RouteControls";
import { PaneHeader, Ribbon } from "@/components/layout/Ribbon";

type LeftPaneProps = {
  open: boolean;
  width: number;
  onResizeStart: () => void;
};

export function LeftPane({ open, width, onResizeStart }: LeftPaneProps) {
  const [layersExpanded, setLayersExpanded] = useState(true);
  const [chatsExpanded, setChatsExpanded] = useState(false);

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      zIndex={2}
      width={width}
      maxWidth="50vw"
      height="100vh"
      pt={68}
      px="$4"
      pb="$4"
      bg="rgba(255, 255, 255, 0.96)"
      borderRightWidth={1}
      borderRightColor="$borderLight200"
      overflow="scroll"
      opacity={open ? 1 : 0}
      pointerEvents={open ? "auto" : "none"}
      sx={{
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow: open ? "0 24px 60px rgba(15, 23, 42, 0.16)" : "none",
        backdropFilter: "blur(12px)",
      }}
      aria-hidden={!open}
    >
      <VStack space="md" height="100%">
        <PaneHeader />

        <Ribbon
          title="Layers"
          expanded={layersExpanded}
          onToggle={() => setLayersExpanded((value) => !value)}
          flex={1}
        >
          <VStack flex={1} minHeight={260} space="md">
            <Box flex={1} minHeight={0}>
              <LayerList />
            </Box>
            <RouteControls />
          </VStack>
        </Ribbon>

        <Ribbon
          title="Chats"
          expanded={chatsExpanded}
          onToggle={() => setChatsExpanded((value) => !value)}
        >
          <ChatPanel />
        </Ribbon>
      </VStack>

      <Pressable
        position="absolute"
        top={0}
        right={-6}
        width={12}
        height="100%"
        onPointerDown={(event) => {
          event.preventDefault();
          onResizeStart();
        }}
        sx={{ cursor: "col-resize" }}
        accessibilityLabel="Resize left pane"
      />
    </Box>
  );
}
