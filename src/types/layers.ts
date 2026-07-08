export type LayerKind = "line" | "circle" | "symbol" | "fill" | "raster";

export type MapLayer = {
  id: string;
  name: string;
  visible: boolean;
  kind: LayerKind;
  mapLayerIds: string[];
};
