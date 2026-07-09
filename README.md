# Routing LLM

Beautiful visualization of how different algorithms expand through road graphs.

![Tech stacks](https://skillicons.dev/icons?i=react,ts,vite,tailwind,docker,nodejs)

Compare Dijkstra, A*, and Greedy Best-First on a live road graph between two cities. Watch each algorithm's wavefront expand node by node, inspect the final route, and see which paths are optimal.

## Features

- Animated wavefront expansion over a real road network
- Side-by-side algorithm comparison with distance, nodes expanded, and runtime
- Toggleable map layers for route, expansion edges, nodes, and endpoints
- Recenter control that fits the full computed route on screen
- Optional chat assistant (Groq) for questions about routing and the current results

## Algorithms

| Algorithm         | Behavior                                                     |
| ----------------- | ------------------------------------------------------------ |
| Dijkstra          | Uniform-cost search. Optimal, but expands many nodes.        |
| A*                | Heuristic-guided. Optimal with fewer expansions in practice. |
| Greedy Best-First | Fastest expansion, but not always optimal.                   |

## Run

```powershell
copy .env.example .env
docker compose up --build
```

Open http://localhost:5173

If dependencies change, rebuild:

```powershell
docker compose up --build
```

### Chat assistant (optional)

Set `VITE_GROQ_API_KEY` in `.env` to enable the Chats tab. Routing and visualization work without it.

### Local dev (without Docker)

```powershell
npm install --legacy-peer-deps
npm run dev
```
