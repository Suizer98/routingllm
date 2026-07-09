import { PanePill } from "@/components/layout/PanePill";
import { ROUTING_ALGORITHMS } from "@/lib/routingAlgorithms";
import {
  getAlgorithmLabel,
  useRoutingStore,
} from "@/stores/routingStore";

export function RouteControls() {
  const selectedAlgorithm = useRoutingStore((state) => state.selectedAlgorithm);
  const isAnimating = useRoutingStore((state) => state.isAnimating);
  const isAnimationPaused = useRoutingStore((state) => state.isAnimationPaused);
  const isLoading = useRoutingStore((state) => state.isLoading);
  const routeError = useRoutingStore((state) => state.routeError);
  const route = useRoutingStore((state) => state.route);
  const comparisons = useRoutingStore((state) => state.comparisons);
  const optimalDistanceKm = useRoutingStore((state) => state.optimalDistanceKm);
  const setSelectedAlgorithm = useRoutingStore(
    (state) => state.setSelectedAlgorithm,
  );
  const visualizeRoute = useRoutingStore((state) => state.visualizeRoute);
  const pauseAnimation = useRoutingStore((state) => state.pauseAnimation);
  const resumeAnimation = useRoutingStore((state) => state.resumeAnimation);

  return (
    <div className="flex flex-col gap-3">
      {ROUTING_ALGORITHMS.map((algorithm) => {
        const active = selectedAlgorithm === algorithm.id;
        const comparison = comparisons.find(
          (item) => item.algorithmId === algorithm.id,
        );
        const isSuboptimal =
          comparison !== undefined &&
          optimalDistanceKm !== null &&
          comparison.route.distanceKm > optimalDistanceKm + 0.5;

        return (
          <button
            key={algorithm.id}
            type="button"
            className="w-full cursor-pointer border-none bg-transparent p-0 text-left"
            onClick={() => setSelectedAlgorithm(algorithm.id)}
          >
            <div
              className={`rounded-xl border p-3.5 transition-colors duration-150 ${
                active
                  ? "border-sky-400 bg-sky-400/10"
                  : "border-slate-700 bg-slate-900"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ background: algorithm.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-100">
                      {algorithm.name}
                    </span>
                    {comparison ? (
                      <PanePill
                        label={isSuboptimal ? "Suboptimal" : "Optimal"}
                        tone={isSuboptimal ? "warning" : "success"}
                      />
                    ) : null}
                  </div>
                  <p className="m-0 text-xs leading-snug text-slate-400">
                    {algorithm.description}
                  </p>
                  {comparison ? (
                    <p className="mt-1 mb-0 text-xs text-slate-300">
                      {comparison.route.distanceKm.toFixed(0)} km ·{" "}
                      {comparison.route.nodesExpanded} nodes ·{" "}
                      {comparison.route.elapsedMs.toFixed(1)} ms
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </button>
        );
      })}

      <button
        type="button"
        className={`w-full cursor-pointer rounded-xl border-none px-4 py-3 text-[0.9375rem] font-semibold text-white transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
          isAnimating && !isAnimationPaused
            ? "bg-slate-700 hover:bg-slate-600"
            : "bg-sky-600 hover:bg-sky-700"
        }`}
        disabled={isLoading}
        onClick={() => {
          if (isAnimating) {
            if (isAnimationPaused) {
              resumeAnimation();
            } else {
              pauseAnimation();
            }
            return;
          }

          void visualizeRoute();
        }}
      >
        {isLoading
          ? "Running…"
          : isAnimating
            ? isAnimationPaused
              ? "Resume"
              : "Pause"
            : "Visualize"}
      </button>

      {routeError ? (
        <p className="m-0 text-center text-sm text-red-400">{routeError}</p>
      ) : null}

      {route ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
          <p className="mb-2 text-sm text-slate-100">
            {getAlgorithmLabel(route.algorithmId)} ·{" "}
            {route.distanceKm.toFixed(0)} km · {route.durationHours.toFixed(1)} h
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <PanePill label={`${route.nodesExpanded} nodes`} tone="muted" />
            <PanePill label={`${route.elapsedMs.toFixed(1)} ms`} tone="muted" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
