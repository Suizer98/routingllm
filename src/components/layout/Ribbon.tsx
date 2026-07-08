import type { ReactNode } from "react";
import {
  Box,
  ChevronDownIcon,
  ChevronUpIcon,
  Heading,
  Pressable,
  Text,
  VStack,
} from "@gluestack-ui/themed";

type RibbonProps = {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  flex?: number;
};

export function Ribbon({
  title,
  expanded,
  onToggle,
  children,
  flex,
}: RibbonProps) {
  return (
    <Box
      flex={flex}
      minHeight={flex ? 0 : undefined}
      borderWidth={1}
      borderColor="$borderLight200"
      borderRadius="$xl"
      overflow="hidden"
      bg="$backgroundLight50"
    >
      <Pressable
        onPress={onToggle}
        px="$3"
        py="$3"
        bg="$white"
        flexDirection="row"
        alignItems="center"
        gap="$2"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        {expanded ? (
          <ChevronUpIcon color="$textLight600" size="sm" />
        ) : (
          <ChevronDownIcon color="$textLight600" size="sm" />
        )}
        <Heading size="sm">{title}</Heading>
      </Pressable>

      {expanded ? (
        <Box
          flex={flex}
          minHeight={flex ? 0 : undefined}
          p="$3"
          borderTopWidth={1}
          borderTopColor="$borderLight200"
          bg="$white"
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );
}

export function PaneHeader() {
  return (
    <VStack space="xs">
      <Heading size="md">Routing LLM</Heading>
      <Text size="sm" color="$textLight500">
        Singapore → Kuala Lumpur
      </Text>
    </VStack>
  );
}
