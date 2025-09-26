# Tailscale Management TUI Prompt

You are building a Terminal User Interface (TUI) to manage a Tailscale deployment running on an Omarchy-based host. The interface must let an operator inspect live network state and manage exit-node selection without leaving the terminal. Ground the UX and terminology in Tailscale concepts (devices, tailnet, exit nodes, DERP regions, ACL policy) while keeping the flow ergonomic for day-to-day operations.

## Objective
Deliver a full-screen, keyboard-first TUI that surfaces current Tailscale status for the local machine and its tailnet, and provides a guided workflow to switch the active exit node.

## Core Capabilities
- **Tailnet Snapshot**: Display device name, tailnet name, auth status, current IPs, DERP region, exit-node setting, connection health, and advertised routes. Include quick visibility into the most recent `tailscale status` summary for peers (hostname, user, reachability, active exit flag).
- **Exit-Node Management**: List available exit nodes (from `tailscale status --json` or `tailscale exit-node list`), showing metadata such as hostname/ID, owner, OS, latency (if available), and whether they’re currently advertising exit capability. Allow selecting an exit node, confirming the change, and rolling back if activation fails.
- **Diagnostics & Notifications**: Surface relevant warnings (e.g., expired auth keys, ACL enforcement, connectivity errors) and show the last few log lines from `tailscale bugreport` or `journalctl -u tailscaled` when available.
- **Manual & Auto Refresh**: Poll Tailscale state at a configurable interval (2–5 seconds) with a manual refresh shortcut. Show the timestamp of the last successful sync and highlight stale data when polling fails.
- **Offline Resilience**: Cache the last known status to keep the UI informative even if `tailscaled` is temporarily unreachable, annotating sections with "stale" markers when data is outdated.

## Data & Integration Guidance
- Use the pre-installed `tailscale` CLI and control socket (`tailscale status --json`, `tailscale exit-node set/unset`, `tailscale ping`, etc.). The tailscale CLI is already installed and configured on the host. Do not prompt for credentials; reuse existing authentication.
- Parse JSON output once per poll cycle and map it into strongly typed models to avoid ad-hoc string parsing in the UI layer.
- When applying an exit-node change, reflect intermediate states: requested → applying → confirmed/failed. Update status based on CLI responses and any follow-up polling results.
- Prefer non-blocking subprocess handling so the UI remains responsive while commands execute.

## Layout Recommendations
- **Header**: Tailnet/device identity, connection indicator, DERP region, last refresh time, and a hint for the help panel (`?`).
- **Main Pane**: Tabbed or sectioned layout for: (1) Local Node (IPs, routes, exit state), (2) Tailnet Peers table, (3) Exit Nodes list, (4) Diagnostics/logs.
- **Footer Bar**: Contextual actions (`E` edit exit node, `R` refresh, `L` view logs, `Q` quit) and the latest notification message.
- Provide a modal or side panel for exit-node selection with filters (reachable, alphabetical, latency) and clear highlighting for the active vs. candidate node.

## Error Handling Expectations
- Gracefully handle CLI timeouts, permission issues, or malformed JSON. Present actionable messages and keep navigation available.
- Disable conflicting actions (e.g., prevent a second exit change while one is in-flight). If a change fails, restore prior state and display the reason from CLI stderr.
- Log unexpected errors with sufficient context (command, exit code, stderr) for troubleshooting without crashing the TUI.

## Implementation Suggestions
- Choose a modern TUI toolkit with async/event support (e.g., `Blessed`, `Ink`, `prompt_toolkit`, `ratatui`, `textual`).
- Abstract CLI interactions into a client module that can be mocked for tests. Provide a simulated data mode for development on non-Tailscale hosts.
- Add unit tests around JSON parsing, exit-node workflows, and state reducers. Use snapshot or golden tests for key render states if supported.
- Supply a CLI entrypoint (e.g., `tailscale-tui`) that accepts flags for refresh interval, mock mode, or custom tailscale binary path.

## Deliverables
- Operational TUI application executable from the terminal.
- README documenting installation, key shortcuts, and troubleshooting tips. (Note: Tailscale CLI is pre-installed on the host)
- Automated tests covering status parsing and exit-node change flows.

Ensure the final experience aligns with Tailscale operator expectations while running smoothly within the Omarchy environment.
