# Routing LLM

Route viewer with interesting algorithms.

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

## Stack

React, Vite, MapLibre, Gluestack UI, Zustand, Dijkstra/A*/GBFS, Mastra (Groq)
