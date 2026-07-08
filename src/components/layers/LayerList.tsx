import {
  Box,
  Checkbox,
  CheckboxIcon,
  CheckboxIndicator,
  CheckboxLabel,
  CheckIcon,
  HStack,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { ROUTING_ALGORITHMS } from "@/lib/routingAlgorithms";
import { useLayerStore } from "@/stores/layerStore";
import { useRoutingStore } from "@/stores/routingStore";

export function LayerList() {
  const layers = useLayerStore((state) => state.layers);
  const toggleLayer = useLayerStore((state) => state.toggleLayer);
  const selectedAlgorithm = useRoutingStore((state) => state.selectedAlgorithm);
  const routeColor =
    ROUTING_ALGORITHMS.find((algorithm) => algorithm.id === selectedAlgorithm)
      ?.color ?? "#2563eb";

  return (
    <VStack space="sm">
      {layers.map((layer) => (
        <Checkbox
          key={layer.id}
          value={layer.id}
          isChecked={layer.visible}
          onChange={() => toggleLayer(layer.id)}
          size="md"
        >
          <HStack space="sm" alignItems="center" flex={1}>
            <CheckboxIndicator>
              <CheckboxIcon as={CheckIcon} />
            </CheckboxIndicator>
            <Box
              width={layer.kind === "line" ? 16 : 12}
              height={layer.kind === "line" ? 3 : 12}
              borderRadius="$full"
              bg={layer.id === "route" ? routeColor : layer.id === "end" ? "#dc2626" : "#16a34a"}
            />
            <CheckboxLabel flex={1}>{layer.name}</CheckboxLabel>
          </HStack>
        </Checkbox>
      ))}
    </VStack>
  );
}
