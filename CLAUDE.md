# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Run application with hot reload (tsx)
npm run build        # Compile TypeScript to JavaScript
npm start            # Run compiled application from dist/
```

### Testing & Quality
```bash
npm test             # Run Jest tests
npm run lint         # Run ESLint on TypeScript files
npm run type-check   # Type check without emitting files
```

### Running the TUI
```bash
npm run dev          # Development mode
npm run dev -- --mock   # Run with mock Tailscale data
node dist/index.js   # Production (after npm run build)
```

## Architecture

### Core Components

**TailscaleTUIApp** (`src/index.ts`): Main application orchestrator that manages state, refresh intervals, and coordinates between the Tailscale client and TUI. Implements 3-second auto-refresh by default.

**TailscaleClient** (`src/cli/tailscale-client.ts`): Abstracts all Tailscale CLI interactions using child_process.spawn(). Handles JSON parsing from `tailscale status --json` and manages exit node operations with automatic sudo fallback. Implements 15-second command timeouts.

**TailscaleTUI** (`src/components/ui.ts`): Blessed.js-based terminal interface with multi-view layout (Local, Peers, Exit Nodes, Diagnostics). Handles all keyboard navigation and user interactions.

### Data Flow
1. TailscaleClient spawns `tailscale` CLI commands and parses JSON responses
2. TailscaleTUIApp maintains application state and refresh logic
3. TailscaleTUI renders state to terminal using Blessed.js components
4. User interactions trigger callbacks that update state through the app layer

### Key Design Patterns
- **Mock Mode**: Use `--mock` flag to run with simulated data for development
- **Error Resilience**: Shows stale data indicators when Tailscale is unreachable
- **Async Command Handling**: All CLI operations are async with proper error boundaries
- **Type Safety**: Comprehensive TypeScript interfaces in `src/models/tailscale.ts`

## Testing Approach

Tests use Jest with ts-jest for TypeScript support. Test files should be placed in `src/tests/` and follow the `*.test.ts` naming convention. Mock the TailscaleClient for UI testing to avoid CLI dependencies.

## Important Implementation Details

- Exit node changes require sudo privileges; the client automatically retries with sudo on permission errors
- The TUI uses Blessed.js screen buffering for smooth updates
- All Tailscale CLI commands have a 15-second timeout to prevent hangs
- The app gracefully handles offline/disconnected Tailscale states
- Keyboard shortcuts are case-insensitive and handled via Blessed.js key events