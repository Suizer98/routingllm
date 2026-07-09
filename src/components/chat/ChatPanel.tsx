import { useState } from "react";

import { runRoutingAssistant } from "@/lib/routingAssistant";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const hasGroqKey = Boolean(import.meta.env.VITE_GROQ_API_KEY);

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || busy || !hasGroqKey) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setInput("");
    setMessages(nextMessages);
    setBusy(true);
    setError(null);

    try {
      const prompt = nextMessages
        .map((message) =>
          message.role === "user"
            ? `User: ${message.content}`
            : `Assistant: ${message.content}`,
        )
        .join("\n\n");

      const response = await runRoutingAssistant(prompt);

      setMessages((current) => [
        ...current,
        { role: "assistant", content: response },
      ]);
    } catch (sendError: unknown) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Could not reach the routing assistant";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-72 flex-col gap-3">
      {!hasGroqKey ? (
        <p className="m-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Add VITE_GROQ_API_KEY to .env to enable chat.
        </p>
      ) : null}

      <div className="scrollbar-pane flex min-h-48 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-3">
        {messages.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">
            Try: &quot;Route from Singapore to Penang with A*&quot; or
            &quot;Switch to greedy and visualize&quot;
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-[95%] rounded-xl px-3 py-2 text-sm leading-snug ${
                message.role === "user"
                  ? "ml-auto bg-sky-600 text-white"
                  : "mr-auto border border-slate-700 bg-slate-800 text-slate-100"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
        {busy ? (
          <p className="m-0 text-xs text-slate-500">Assistant is thinking…</p>
        ) : null}
      </div>

      {error ? <p className="m-0 text-sm text-red-400">{error}</p> : null}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-500 placeholder:text-slate-500 focus:ring-2"
          placeholder="Ask about routes or algorithms…"
          value={input}
          disabled={!hasGroqKey || busy}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          type="submit"
          className="shrink-0 cursor-pointer rounded-xl border-none bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasGroqKey || busy || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
