# Warlord

A digital implementation of the classic Titan board game.

## Getting Started

### Install dependencies

```bash
pnpm install
```

### Development server

```bash
pnpm dev
```

Start the dev server at `http://localhost:5173`.

### Build

```bash
pnpm build
```

### Lint and typecheck

```bash
pnpm lint
pnpm typecheck
```

## Architecture

The project is organized into three main layers:

- **Models** (`src/game/models/`) — Plain TypeScript game engine. Contains the core `TitanGame` class and supporting types (Player, Stack, Battle, etc.) with no UI dependencies.
- **Stores** (`src/ui/stores/`) — Pinia state management layer. Wraps TitanGame methods as Pinia store actions and getters to make state reactive and accessible to components.
- **Components** (`src/ui/components/`) — Vue UI layer. Renders the game state, handles user input, and dispatches store actions.