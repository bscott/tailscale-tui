# Tailscale TUI Agent Guidelines

## Project Overview
This project is a Terminal User Interface (TUI) for managing Tailscale deployments on Omarchy-based hosts. The application provides a keyboard-first interface for inspecting network state and managing exit nodes.

## Technology Stack
- **Language**: TypeScript/JavaScript (recommended based on TUI toolkit suggestions)
- **TUI Framework**: Choose from `Blessed`, `Ink`, `prompt_toolkit`, `ratatui`, or `textual`
- **Integration**: Pre-installed Tailscale CLI (`tailscale` command) via subprocess calls
- **Data Format**: JSON parsing from `tailscale status --json` and related commands

## Architecture Patterns
- **Client Module**: Abstract CLI interactions into a separate client module for testability
- **State Management**: Use strongly typed models to avoid ad-hoc string parsing
- **Async Handling**: Non-blocking subprocess handling to keep UI responsive
- **Caching**: Cache last known status for offline resilience

## Key Components
1. **Header**: Tailnet/device identity, connection status, DERP region, refresh time
2. **Main Pane**: Tabbed layout for Local Node, Tailnet Peers, Exit Nodes, Diagnostics
3. **Footer Bar**: Contextual actions (E, R, L, Q keys) and notifications
4. **Modal/Side Panel**: Exit-node selection with filtering capabilities

## Commands & Scripts
```bash
# Development
npm run dev          # Start development server
npm run build        # Build application
npm run test         # Run unit tests
npm run lint         # Run linter
npm run type-check   # TypeScript type checking

# Application usage
tailscale-tui        # Start TUI application
tailscale-tui --mock # Run in mock mode for development
```

## Testing Strategy
- **Unit Tests**: JSON parsing, exit-node workflows, state reducers
- **Integration Tests**: CLI interactions with mocked tailscale commands
- **Snapshot Tests**: Key render states and UI components
- **Mock Mode**: Simulated data for development on non-Tailscale hosts

## Key Features to Implement
1. **Tailnet Status Display**: Device info, connection health, peer visibility
2. **Exit Node Management**: List, select, confirm, rollback functionality  
3. **Real-time Updates**: Configurable polling (2-5 seconds) with manual refresh
4. **Error Handling**: Graceful degradation, actionable error messages
5. **Offline Mode**: Stale data indicators when tailscaled unreachable

## CLI Integration Requirements
- Use existing Tailscale authentication (no credential prompts)
- Parse `tailscale status --json` for structured data
- Execute `tailscale exit-node set/unset` for changes
- Monitor command states: requested → applying → confirmed/failed
- Handle CLI timeouts, permissions, malformed JSON gracefully

## Code Style & Conventions
- Use TypeScript for type safety
- Abstract CLI calls into testable modules
- Implement proper error boundaries
- Follow async/await patterns for subprocess calls
- Use descriptive variable names aligned with Tailscale terminology

## File Structure
```
src/
├── cli/           # Tailscale CLI integration
├── components/    # TUI components and layouts
├── models/        # TypeScript interfaces and types
├── utils/         # Helper functions and utilities
└── tests/         # Test files
```

## Deployment & Distribution
- Provide single executable: `tailscale-tui`
- Include README with shortcuts and usage (tailscale CLI is pre-installed)
- Support flags: `--refresh-interval`, `--mock`, `--tailscale-path`
- Target Omarchy environment compatibility
