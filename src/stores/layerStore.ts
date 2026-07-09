import { create } from "zustand";

import type { MapLayer } from "@/types/layers";
import {
  END_LAYER_ID,
  EXPANSION_GLOW_LAYER_ID,
  EXPANSION_LAYER_ID,
  EXPANSION_NODE_LAYER_ID,
  ROUTE_CORE_LAYER_ID,
  ROUTE_HEAD_LAYER_ID,
  ROUTE_LAYER_ID,
  START_LAYER_ID,
} from "@/lib/constants";

const initialLayers: MapLayer[] = [
  {
    id: "route",
    name: "Route",
    visible: true,
    kind: "line",
    mapLayerIds: [
      ROUTE_LAYER_ID,
      `${ROUTE_LAYER_ID}-glow`,
      ROUTE_CORE_LAYER_ID,
      EXPANSION_GLOW_LAYER_ID,
      EXPANSION_LAYER_ID,
      EXPANSION_NODE_LAYER_ID,
      ROUTE_HEAD_LAYER_ID,
    ],
  },
  {
    id: "start",
    name: "Start",
    visible: true,
    kind: "circle",
    mapLayerIds: [START_LAYER_ID],
  },
  {
    id: "end",
    name: "End",
    visible: true,
    kind: "circle",
    mapLayerIds: [END_LAYER_ID],
  },
];

type LayerStore = {
  layers: MapLayer[];
  toggleLayer: (id: string) => void;
  setLayerVisibility: (id: string, visible: boolean) => void;
};

export const useLayerStore = create<LayerStore>((set) => ({
  layers: initialLayers,
  toggleLayer: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    })),
  setLayerVisibility: (id, visible) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible } : layer,
      ),
    })),
}));
