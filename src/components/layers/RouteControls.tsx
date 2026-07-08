import {
  Box,
  Button,
  ButtonSpinner,
  ButtonText,
  HStack,
  Pressable,
  Text,
  VStack,
} from "@gluestack-ui/themed";

import { ROUTING_ALGORITHMS } from "@/lib/routingAlgorithms";
import {
  getAlgorithmLabel,
  useRoutingStore,
} from "@/stores/routingStore";

export function RouteControls() {
  const selectedAlgorithm = useRoutingStore((state) => state.selectedAlgorithm);
  const isAnimating = useRoutingStore((state) => state.isAnimating);
  const isLoading = useRoutingStore((state) => state.isLoading);
  const routeError = useRoutingStore((state) => state.routeError);
  const route = useRoutingStore((state) => state.route);
  const comparisons = useRoutingStore((state) => state.comparisons);
  const optimalDistanceKm = useRoutingStore((state) => state.optimalDistanceKm);
  const setSelectedAlgorithm = useRoutingStore(
    (state) => state.setSelectedAlgorithm,
  );
  const visualizeRoute = useRoutingStore((state) => state.visualizeRoute);

  return (
    <VStack
      space="sm"
      pt="$3"
      borderTopWidth={1}
      borderTopColor="$borderLight200"
      mt="auto"
    >
      <Text
        size="xs"
        fontWeight="$semibold"
        textTransform="uppercase"
        letterSpacing={1}
        color="$textLight500"
      >
        Pathfinding algorithms
      </Text>

      <VStack space="xs">
        {ROUTING_ALGORITHMS.map((algorithm) => {
          const active = selectedAlgorithm === algorithm.id;
          const comparison = comparisons.find(
            (item) => item.algorithmId === algorithm.id,
          );

          return (
            <Pressable
              key={algorithm.id}
              onPress={() => setSelectedAlgorithm(algorithm.id)}
              p="$3"
              borderWidth={1}
              borderColor={active ? "$primary500" : "$borderLight200"}
              borderRadius="$lg"
              bg={active ? "$primary50" : "$white"}
            >
              <Box flexDirection="row" alignItems="flex-start" gap="$2">
                <Box
                  width={10}
                  height={10}
                  mt="$1"
                  borderRadius="$full"
                  bg={algorithm.color}
                />
                <VStack flex={1} space="xs">
                  <Text fontWeight="$semibold" size="sm">
                    {algorithm.name}
                  </Text>
                  <Text size="xs" color="$textLight500">
                    {algorithm.description}
                  </Text>
                  {comparison ? (
                    <Text size="xs" color="$textLight600">
                      {comparison.route.distanceKm.toFixed(0)} km ·{" "}
                      {comparison.route.nodesExpanded} nodes ·{" "}
                      {comparison.route.elapsedMs.toFixed(1)} ms
                      {optimalDistanceKm !== null &&
                      comparison.route.distanceKm > optimalDistanceKm + 0.5
                        ? " · suboptimal"
                        : " · optimal"}
                    </Text>
                  ) : null}
                </VStack>
              </Box>
            </Pressable>
          );
        })}
      </VStack>

      <Button
        size="md"
        action="primary"
        isDisabled={isAnimating || isLoading}
        onPress={() => {
          void visualizeRoute();
        }}
      >
        {isLoading || isAnimating ? <ButtonSpinner color="white" /> : null}
        <ButtonText>
          {isLoading
            ? "Running comparison…"
            : isAnimating
              ? "Visualizing route…"
              : "Compare & Visualize"}
        </ButtonText>
      </Button>

      {routeError ? (
        <Text size="sm" color="$error600" textAlign="center">
          {routeError}
        </Text>
      ) : null}

      {route ? (
        <VStack space="xs">
          <Text size="sm" color="$textLight600" textAlign="center">
            {getAlgorithmLabel(route.algorithmId)} · {route.distanceKm.toFixed(0)}{" "}
            km · {route.durationHours.toFixed(1)} h
          </Text>
          <HStack justifyContent="center" space="md">
            <Text size="xs" color="$textLight500">
              {route.nodesExpanded} nodes expanded
            </Text>
            <Text size="xs" color="$textLight500">
              {route.elapsedMs.toFixed(1)} ms
            </Text>
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );
}
