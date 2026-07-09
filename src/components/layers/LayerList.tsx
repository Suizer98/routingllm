import { theme } from "@/lib/constants";
import { ROUTING_ALGORITHMS } from "@/lib/routingAlgorithms";
import { useLayerStore } from "@/stores/layerStore";
import { useLocationStore } from "@/stores/locationStore";
import { useRoutingStore } from "@/stores/routingStore";

export function LayerList() {
  const layers = useLayerStore((state) => state.layers);
  const toggleLayer = useLayerStore((state) => state.toggleLayer);
  const selectedAlgorithm = useRoutingStore((state) => state.selectedAlgorithm);
  const start = useLocationStore((state) => state.start);
  const end = useLocationStore((state) => state.end);
  const routeColor =
    ROUTING_ALGORITHMS.find((algorithm) => algorithm.id === selectedAlgorithm)
      ?.color ?? theme.accent;

  const layerLabel = (layerId: string, fallback: string) => {
    if (layerId === "start") {
      return `${start.label} (Start)`;
    }
    if (layerId === "end") {
      return `${end.label} (End)`;
    }
    return fallback;
  };

  return (
    <div className="flex flex-col gap-0.5">
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg border-none bg-transparent p-2 text-left transition-colors duration-150 hover:bg-slate-700/60"
          onClick={() => toggleLayer(layer.id)}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-[0.625rem] font-bold ${
              layer.visible
                ? "border-sky-400 bg-sky-400 text-slate-900"
                : "border-slate-700 bg-transparent text-transparent"
            }`}
            aria-hidden
          >
            {layer.visible ? "✓" : ""}
          </span>

          <span
            className={`shrink-0 rounded-full ${
              layer.kind === "line" ? "h-1 w-[18px]" : "h-2.5 w-2.5"
            }`}
            style={{
              background:
                layer.id === "route"
                  ? routeColor
                  : layer.id === "end"
                    ? "#f87171"
                    : "#4ade80",
            }}
          />

          <span className="flex-1 text-sm text-slate-100">
            {layerLabel(layer.id, layer.name)}
          </span>
        </button>
      ))}
    </div>
  );
}
