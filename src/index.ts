#!/usr/bin/env node

import { TailscaleClient } from './cli/tailscale-client';
import { MockTailscaleClient } from './cli/mock-client';
import { TailscaleTUI } from './components/ui';
import { TUIState, ExitNodeInfo } from './models/tailscale';

class TailscaleTUIApp {
  private client: TailscaleClient | MockTailscaleClient;
  private ui: TailscaleTUI;
  private state: TUIState;
  private refreshInterval: NodeJS.Timeout | null = null;
  private refreshIntervalMs: number = 3000; // 3 seconds
  private isMockMode: boolean = false;

  constructor() {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const refreshFlag = args.find(arg => arg.startsWith('--refresh-interval='));
    if (refreshFlag) {
      this.refreshIntervalMs = parseInt(refreshFlag.split('=')[1]) * 1000;
    }

    const tailscalePath = args.find(arg => arg.startsWith('--tailscale-path='))?.split('=')[1] || 'tailscale';
    this.isMockMode = args.includes('--mock');
    
    this.client = this.isMockMode 
      ? new MockTailscaleClient()
      : new TailscaleClient(tailscalePath);
    this.ui = new TailscaleTUI();
    
    this.state = {
      status: null,
      exitNodes: [],
      lastRefresh: null,
      isStale: false,
      currentView: 'local',
      isLoading: false,
      error: null,
      notifications: []
    };

    this.setupCallbacks();
  }

  private setupCallbacks() {
    this.ui.setCallbacks({
      onRefresh: () => this.refresh(),
      onExitNodeSelect: (nodeId: string) => this.handleExitNodeSelection(nodeId),
      onQuit: () => this.quit()
    });

    // Handle process termination
    process.on('SIGINT', () => this.quit());
    process.on('SIGTERM', () => this.quit());
  }

  async start() {
    try {
      const modeMsg = this.isMockMode ? 'Starting Tailscale TUI (Mock Mode)...' : 'Starting Tailscale TUI...';
      this.addNotification(modeMsg);
      await this.refresh();
      this.startAutoRefresh();
      this.ui.render();
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  private async refresh() {
    this.updateState({ isLoading: true, error: null });
    
    try {
      // Fetch status and exit nodes concurrently
      const [status, exitNodes] = await Promise.all([
        this.client.getStatus(),
        this.client.getExitNodes()
      ]);

      this.updateState({
        status,
        exitNodes,
        lastRefresh: new Date(),
        isStale: false,
        isLoading: false,
        error: status ? null : 'Failed to connect to Tailscale'
      });

      if (status) {
        this.addNotification(`Refreshed at ${new Date().toLocaleTimeString()}`);
      }
    } catch (error) {
      this.updateState({
        isLoading: false,
        isStale: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.addNotification(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleExitNodeSelection(nodeId: string) {
    const node = this.state.exitNodes.find(n => n.id === nodeId);
    if (!node) {
      this.addNotification('Selected node not found');
      return;
    }

    this.addNotification(`Setting exit node to ${node.hostname}...`);
    this.updateState({ isLoading: true });

    try {
      const result = node.isActive 
        ? await this.client.unsetExitNode()
        : await this.client.setExitNode(nodeId);

      if (result.success) {
        this.addNotification(
          node.isActive 
            ? 'Exit node unset successfully'
            : `Exit node set to ${node.hostname} successfully`
        );
        // Wait a moment then refresh to see the change
        setTimeout(() => this.refresh(), 1000);
      } else {
        this.addNotification(`Failed to change exit node: ${result.error || 'Unknown error'}`);
        this.updateState({ isLoading: false });
      }
    } catch (error) {
      this.addNotification(`Error changing exit node: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.updateState({ isLoading: false });
    }
  }

  private startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.refresh().catch(() => {
        // Mark as stale on refresh failure
        this.updateState({ isStale: true });
      });
    }, this.refreshIntervalMs);
  }

  private updateState(updates: Partial<TUIState>) {
    this.state = { ...this.state, ...updates };
    this.ui.updateState(this.state);
  }

  private addNotification(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const notification = `[${timestamp}] ${message}`;
    
    this.state.notifications.push(notification);
    
    // Keep only the last 50 notifications
    if (this.state.notifications.length > 50) {
      this.state.notifications = this.state.notifications.slice(-50);
    }
    
    this.updateState({ notifications: this.state.notifications });
  }

  private quit() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.ui.destroy();
    process.exit(0);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Tailscale TUI - Terminal User Interface for Tailscale

Usage: tailscale-tui [options]

Options:
  --refresh-interval=N  Set refresh interval in seconds (default: 3)
  --tailscale-path=PATH Set path to tailscale binary (default: tailscale)
  --mock               Run in mock mode (not yet implemented)
  --help, -h           Show this help message

Key Controls:
  1             Show local node information
  2             Show tailnet peers
  E             Show exit nodes
  L             Show logs/diagnostics
  R             Manual refresh
  Enter         Select exit node (in exit nodes view)
  Q, Ctrl+C     Quit
  `);
  process.exit(0);
}

// Mock mode is now implemented

// Start the application
const app = new TailscaleTUIApp();
app.start().catch(error => {
  console.error('Application failed:', error);
  process.exit(1);
});
