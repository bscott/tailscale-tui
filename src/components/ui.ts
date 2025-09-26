import blessed from 'blessed';
import { TUIState, ExitNodeInfo } from '../models/tailscale';

export class TailscaleTUI {
  private screen: blessed.Widgets.Screen;
  private headerBox!: blessed.Widgets.BoxElement;
  private mainBox!: blessed.Widgets.BoxElement;
  private footerBox!: blessed.Widgets.BoxElement;
  private statusTable!: blessed.Widgets.TableElement;
  private peersTable!: blessed.Widgets.TableElement;
  private exitNodesTable!: blessed.Widgets.TableElement;
  private logBox!: blessed.Widgets.BoxElement;
  private helpModal!: blessed.Widgets.BoxElement;
  private currentView: string = 'local';
  private state: TUIState;
  private onRefresh: () => void = () => {};
  private onExitNodeSelect: (nodeId: string) => void = () => {};
  private onQuit: () => void = () => {};

  constructor() {
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

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Tailscale TUI'
    });

    this.createLayout();
    this.setupKeyHandlers();
  }

  private createLayout() {
    // Header
    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'blue',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Main content area
    this.mainBox = blessed.box({
      top: 3,
      left: 0,
      width: '100%',
      height: '100%-6',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    // Footer
    this.footerBox = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{bold}[E]{/bold} Exit Nodes  {bold}[R]{/bold} Refresh  {bold}[L]{/bold} Logs  {bold}[Q]{/bold} Quit',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      }
    });

    // Status table for local node
    this.statusTable = blessed.table({
      parent: this.mainBox,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        },
        header: {
          fg: 'white',
          bold: true
        }
      },
      columnSpacing: 2,
      columnWidth: [20, 40]
    });

    // Peers table
    this.peersTable = blessed.table({
      parent: this.mainBox,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        },
        header: {
          fg: 'white',
          bold: true
        }
      },
      columnSpacing: 1,
      columnWidth: [30, 12, 35, 8, 15],
      tags: true
    });

    // Exit nodes table
    this.exitNodesTable = blessed.table({
      parent: this.mainBox,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        },
        header: {
          fg: 'white',
          bold: true
        },
        cell: {
          selected: {
            bg: 'blue',
            fg: 'white'
          }
        }
      },
      columnSpacing: 2,
      columnWidth: [25, 18, 12, 8, 25, 12],
      keys: true,
      vi: true,
      mouse: true,
      interactive: true,
      focusable: true,
      tags: true
    });

    // Log box
    this.logBox = blessed.box({
      parent: this.mainBox,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      tags: true,
      content: ''
    });

    // Help modal (hidden by default)
    this.helpModal = blessed.box({
      top: 'center',
      left: 'center',
      width: 60,
      height: 20,
      content: this.getHelpContent(),
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      hidden: true
    });

    this.screen.append(this.headerBox);
    this.screen.append(this.mainBox);
    this.screen.append(this.footerBox);
    this.screen.append(this.helpModal);

    this.showView('local');
  }

  private setupKeyHandlers() {
    this.screen.key(['q', 'C-c'], () => {
      this.onQuit();
    });

    this.screen.key(['r', 'F5'], () => {
      this.onRefresh();
    });

    // Navigation keys
    this.screen.key(['1', 'l'], () => this.showView('local'));
    this.screen.key(['2', 'p'], () => this.showView('peers'));
    this.screen.key(['3', 'e'], () => this.showView('exitnodes'));
    this.screen.key(['4', 'd'], () => this.showView('logs'));

    // Tab navigation
    this.screen.key('tab', () => {
      const views = ['local', 'peers', 'exitnodes', 'logs'];
      const current = views.indexOf(this.currentView);
      const next = (current + 1) % views.length;
      this.showView(views[next]);
    });

    this.screen.key('S-tab', () => {
      const views = ['local', 'peers', 'exitnodes', 'logs'];
      const current = views.indexOf(this.currentView);
      const prev = current === 0 ? views.length - 1 : current - 1;
      this.showView(views[prev]);
    });

    // Exit node selection
    this.exitNodesTable.key(['enter', 'space'], () => {
      // Get currently focused row (blessed tables are 0-indexed but first row is header)
      const selected = (this.exitNodesTable as any).selected || 0;
      if (selected >= 1 && this.state.exitNodes.length > selected - 1) {
        const node = this.state.exitNodes[selected - 1];
        this.onExitNodeSelect(node.id);
      }
    });

    // Help key
    this.screen.key(['?', 'h'], () => {
      this.showHelpModal();
    });

    // Close help modal
    this.screen.key('escape', () => {
      if (!this.helpModal.hidden) {
        this.hideHelpModal();
      }
    });
  }

  private showView(view: string) {
    this.currentView = view;
    this.state.currentView = view as any;

    // Hide all views
    this.statusTable.hide();
    this.peersTable.hide();
    this.exitNodesTable.hide();
    this.logBox.hide();

    // Show selected view
    switch (view) {
      case 'local':
        this.statusTable.show();
        break;
      case 'peers':
        this.peersTable.show();
        break;
      case 'exitnodes':
        this.exitNodesTable.show();
        break;
      case 'logs':
        this.logBox.show();
        break;
    }

    this.updateFooter();
    this.screen.render();
  }

  private updateFooter() {
    const viewName = {
      'local': 'Local Node',
      'peers': 'Peers',
      'exitnodes': 'Exit Nodes',
      'logs': 'Diagnostics'
    }[this.currentView] || 'Unknown';

    const keybinds = this.currentView === 'exitnodes' 
      ? `{bold}[↑↓]{/bold} Navigate  {bold}[Enter/Space]{/bold} Toggle Exit Node  {bold}[Tab]{/bold} Switch View  {bold}[R/F5]{/bold} Refresh  {bold}[H/?]{/bold} Help  {bold}[Q]{/bold} Quit`
      : `{bold}[1-4/L,P,E,D]{/bold} Views  {bold}[Tab]{/bold} Navigate  {bold}[R/F5]{/bold} Refresh  {bold}[H/?]{/bold} Help  {bold}[Q]{/bold} Quit`;

    this.footerBox.setContent(`{bold}${viewName}{/bold}  |  ${keybinds}`);
  }

  updateState(state: TUIState) {
    this.state = { ...this.state, ...state };
    this.updateHeader();
    this.updateContent();
    this.updateFooter(); // Make sure footer is updated too
    this.screen.render();
  }

  private updateHeader() {
    const status = this.state.status;
    if (!status) {
      this.headerBox.setContent('{bold}Tailscale TUI{/bold} - No connection');
      return;
    }

    const staleIndicator = this.state.isStale ? '[STALE] ' : '';
    const loadingIndicator = this.state.isLoading ? '[REFRESHING...] ' : '';
    const lastRefresh = this.state.lastRefresh ? 
      `Last: ${this.state.lastRefresh.toLocaleTimeString()}` : 'Never';

    const tailnetName = status.CurrentTailnet?.Name || 'Unknown Tailnet';
    const deviceName = status.Self?.HostName || 'Unknown Device';
    const backendState = status.BackendState || 'Unknown';

    this.headerBox.setContent(
      `{bold}${tailnetName}{/bold} - {bold}${deviceName}{/bold}  |  ` +
      `State: ${backendState}  |  ${staleIndicator}${loadingIndicator}${lastRefresh}`
    );
  }

  private updateContent() {
    switch (this.currentView) {
      case 'local':
        this.updateLocalView();
        break;
      case 'peers':
        this.updatePeersView();
        break;
      case 'exitnodes':
        this.updateExitNodesView();
        break;
      case 'logs':
        this.updateLogsView();
        break;
    }
  }

  private updateLocalView() {
    const status = this.state.status;
    if (!status) {
      this.statusTable.setData([['Property', 'Value'], ['Status', 'Not connected']]);
      return;
    }

    const data = [
      ['Property', 'Value'],
      ['Hostname', status.Self?.HostName || 'Unknown'],
      ['Tailscale IPs', (status.Self?.TailscaleIPs || []).join(', ')],
      ['OS', status.Self?.OS || 'Unknown'],
      ['Backend State', status.BackendState || 'Unknown'],
      ['Magic DNS', status.MagicDNSEnabled ? 'Enabled' : 'Disabled'],
      ['Exit Node', status.Self?.ExitNode ? 'Active' : 'None'],
      ['Can Route', status.Self?.ExitNodeOption ? 'Yes' : 'No'],
      ['Online', status.Self?.Online !== false ? 'Yes' : 'No'],
      ['Version', status.Version || 'Unknown']
    ];

    this.statusTable.setData(data);
  }

  private updatePeersView() {
    const status = this.state.status;
    if (!status || !status.Peer) {
      this.peersTable.setData([['Hostname', 'OS', 'Tailscale IPs', 'Online', 'Last Seen']]);
      return;
    }

    const data = [['Hostname', 'OS', 'Tailscale IPs', 'Online', 'Last Seen']];
    
    // Sort peers by hostname for consistent display
    const sortedPeers = Object.values(status.Peer).sort((a, b) => 
      (a.HostName || '').localeCompare(b.HostName || '')
    );
    
    sortedPeers.forEach(peer => {
      const lastSeen = peer.LastSeen === '0001-01-01T00:00:00Z' || !peer.LastSeen 
        ? 'Never' 
        : new Date(peer.LastSeen).toLocaleString();
      
      const hostname = peer.HostName || 'Unknown';
      const os = peer.OS || 'Unknown';
      const ips = (peer.TailscaleIPs || []).slice(0, 2).join(', '); // Show max 2 IPs
      const online = peer.Online !== false ? 'Yes' : 'No';
      
      data.push([hostname, os, ips, online, lastSeen]);
    });

    this.peersTable.setData(data);
  }

  private updateExitNodesView() {
    const data = [['Hostname', 'Owner', 'OS', 'Online', 'Location', 'Status']];
    
    if (this.state.exitNodes.length === 0) {
      data.push(['No exit nodes available', '', '', '', '', '']);
    } else {
      this.state.exitNodes.forEach(node => {
        const location = node.location ? 
          `${node.location.City}, ${node.location.Country}` : 'Unknown';
        const onlineStatus = node.online ? 'Yes' : 'No';
        const nodeStatus = node.isActive ? '● ACTIVE' : 
                          node.online ? '○ Available' : '× Offline';
        
        data.push([
          node.hostname,
          node.owner,
          node.os,
          onlineStatus,
          location,
          nodeStatus
        ]);
      });
    }

    this.exitNodesTable.setData(data);
    
    // Set focus on exit nodes table when in that view
    if (this.currentView === 'exitnodes') {
      this.exitNodesTable.focus();
    }
  }

  private updateLogsView() {
    let content = '';
    
    // Show recent notifications and errors
    if (this.state.error) {
      content += `{red-fg}ERROR: ${this.state.error}{/red-fg}\n`;
    }
    
    this.state.notifications.forEach(notification => {
      content += `${notification}\n`;
    });

    this.logBox.setContent(content);
  }

  private getHelpContent(): string {
    return `{center}{bold}Tailscale TUI Help{/bold}{/center}

{bold}Navigation:{/bold}
  1, L      Local Node view
  2, P      Peers view  
  3, E      Exit Nodes view
  4, D      Diagnostics/Logs view
  Tab       Next view
  Shift+Tab Previous view

{bold}Actions:{/bold}
  R, F5     Manual refresh
  Enter     Select/Toggle exit node (Exit Nodes view)
  Space     Toggle exit node (Exit Nodes view)
  ↑ ↓       Navigate in tables
  
{bold}Other:{/bold}
  H, ?      Show this help
  Esc       Close help/modals
  Q, Ctrl+C Quit application

{center}Press Esc to close this help{/center}`;
  }

  private showHelpModal() {
    this.helpModal.show();
    this.helpModal.focus();
    this.screen.render();
  }

  private hideHelpModal() {
    this.helpModal.hide();
    this.screen.render();
  }

  setCallbacks(callbacks: {
    onRefresh: () => void;
    onExitNodeSelect: (nodeId: string) => void;
    onQuit: () => void;
  }) {
    this.onRefresh = callbacks.onRefresh;
    this.onExitNodeSelect = callbacks.onExitNodeSelect;
    this.onQuit = callbacks.onQuit;
  }

  render() {
    this.screen.render();
  }

  destroy() {
    this.screen.destroy();
  }
}
