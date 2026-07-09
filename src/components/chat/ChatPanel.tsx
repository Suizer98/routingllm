export function ChatPanel() {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 p-4 text-center">
      <p className="m-0 text-sm text-slate-400">
        Chat with the routing assistant will appear here.
      </p>
      <small className="text-xs text-slate-500">
        Ask about routes, algorithms, or travel options.
      </small>
    </div>
  );
}
