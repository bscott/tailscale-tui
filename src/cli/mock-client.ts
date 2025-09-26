import { TailscaleStatus, CommandResult, ExitNodeInfo } from '../models/tailscale';

const MOCK_STATUS: TailscaleStatus = {
  Version: "1.72.1-dev-mock",
  TUN: true,
  BackendState: "Running",
  AuthURL: "",
  TailscaleIPs: ["100.64.1.100", "fd7a:115c:a1e0::ab12:4843"],
  Self: {
    ID: "n1234567890abcdef",
    PublicKey: "nodekey:mock1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    HostName: "mock-local-node",
    DNSName: "mock-local.example.ts.net.",
    OS: "linux",
    UserID: 1,
    TailscaleIPs: ["100.64.1.100", "fd7a:115c:a1e0::ab12:4843"],
    Created: new Date(Date.now() - 86400000).toISOString(),
    LastSeen: new Date().toISOString(),
    Online: true,
    ExitNode: false,
    ExitNodeOption: false,
    Active: true,
    InNetworkMap: true,
    InMagicSock: true,
    InEngine: true
  },
  Peer: {
    "nodekey:peer1": {
      ID: "nPeer1234567",
      PublicKey: "nodekey:peer1",
      HostName: "exit-node-us-west",
      DNSName: "exit-us-west.example.ts.net.",
      OS: "linux",
      UserID: 2,
      TailscaleIPs: ["100.64.1.101"],
      Created: new Date(Date.now() - 172800000).toISOString(),
      LastSeen: new Date().toISOString(),
      Online: true,
      ExitNode: false,
      ExitNodeOption: true,
      Active: true,
      Location: {
        Country: "United States",
        CountryCode: "US",
        City: "San Francisco",
        CityCode: "SFO",
        Priority: 1
      },
      InNetworkMap: true,
      InMagicSock: true,
      InEngine: true
    },
    "nodekey:peer2": {
      ID: "nPeer2345678",
      PublicKey: "nodekey:peer2",
      HostName: "server-eu-central",
      DNSName: "server-eu.example.ts.net.",
      OS: "linux", 
      UserID: 2,
      TailscaleIPs: ["100.64.1.102"],
      Created: new Date(Date.now() - 259200000).toISOString(),
      LastSeen: new Date(Date.now() - 3600000).toISOString(),
      Online: true,
      ExitNode: false,
      ExitNodeOption: true,
      Active: false,
      Location: {
        Country: "Germany",
        CountryCode: "DE", 
        City: "Frankfurt",
        CityCode: "FRA",
        Priority: 2
      },
      InNetworkMap: true,
      InMagicSock: true,
      InEngine: false
    },
    "nodekey:peer3": {
      ID: "nPeer3456789",
      PublicKey: "nodekey:peer3",
      HostName: "mobile-device",
      DNSName: "phone.example.ts.net.",
      OS: "iOS",
      UserID: 1,
      TailscaleIPs: ["100.64.1.103"],
      Created: new Date(Date.now() - 86400000).toISOString(),
      LastSeen: new Date(Date.now() - 7200000).toISOString(),
      Online: false,
      ExitNode: false,
      ExitNodeOption: false,
      Active: false,
      InNetworkMap: true,
      InMagicSock: false,
      InEngine: false
    }
  },
  User: {
    "1": {
      ID: 1,
      LoginName: "user@example.com",
      DisplayName: "Test User",
      ProfilePicURL: "https://example.com/avatar.jpg"
    },
    "2": {
      ID: 2,
      LoginName: "admin@example.com", 
      DisplayName: "Admin User",
      ProfilePicURL: "https://example.com/admin.jpg"
    }
  },
  CurrentTailnet: {
    Name: "example.ts.net",
    MagicDNSSuffix: ".example.ts.net.",
    MagicDNSEnabled: true
  },
  MagicDNSSuffix: ".example.ts.net.",
  MagicDNSEnabled: true
};

export class MockTailscaleClient {
  private status: TailscaleStatus = MOCK_STATUS;
  private activeExitNode: string | null = null;
  private commandDelay: number = 500; // Simulate network delay

  async getStatus(): Promise<TailscaleStatus | null> {
    await this.delay();
    
    // Update status based on active exit node
    if (this.activeExitNode && this.status.Peer[this.activeExitNode]) {
      this.status.Self.ExitNode = true;
      // Reset all peers
      Object.values(this.status.Peer).forEach(peer => {
        peer.ExitNode = false;
      });
      // Set active exit node
      this.status.Peer[this.activeExitNode].ExitNode = true;
    } else {
      this.status.Self.ExitNode = false;
      Object.values(this.status.Peer).forEach(peer => {
        peer.ExitNode = false;
      });
    }

    return this.status;
  }

  async getExitNodes(): Promise<ExitNodeInfo[]> {
    await this.delay();
    
    const exitNodes: ExitNodeInfo[] = [];
    
    Object.entries(this.status.Peer).forEach(([key, peer]) => {
      if (peer.ExitNodeOption) {
        const user = this.status.User[peer.UserID];
        exitNodes.push({
          id: key,
          hostname: peer.HostName,
          owner: user?.DisplayName || user?.LoginName || 'Unknown',
          os: peer.OS || 'Unknown',
          location: peer.Location,
          online: peer.Online !== false,
          canRoute: peer.ExitNodeOption || false,
          isActive: this.activeExitNode === key,
          lastSeen: peer.LastSeen || peer.Created
        });
      }
    });

    return exitNodes.sort((a, b) => a.hostname.localeCompare(b.hostname));
  }

  async setExitNode(nodeId: string): Promise<CommandResult> {
    await this.delay();
    
    if (!this.status.Peer[nodeId] || !this.status.Peer[nodeId].ExitNodeOption) {
      return {
        success: false,
        output: '',
        error: 'Exit node not found or not available',
        exitCode: 1
      };
    }

    this.activeExitNode = nodeId;
    
    return {
      success: true,
      output: `Exit node set to ${this.status.Peer[nodeId].HostName}`,
      exitCode: 0
    };
  }

  async unsetExitNode(): Promise<CommandResult> {
    await this.delay();
    
    this.activeExitNode = null;
    
    return {
      success: true,
      output: 'Exit node unset',
      exitCode: 0
    };
  }

  async ping(target: string): Promise<CommandResult> {
    await this.delay();
    
    // Simulate different ping results
    const responses = [
      `pong from ${target} via DERP(lax) in 45ms`,
      `pong from ${target} direct in 12ms`,
      `pong from ${target} via relay in 78ms`
    ];
    
    return {
      success: true,
      output: responses[Math.floor(Math.random() * responses.length)],
      exitCode: 0
    };
  }

  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.commandDelay));
  }

  // Mock-specific methods for testing
  setCommandDelay(ms: number): void {
    this.commandDelay = ms;
  }

  simulateOfflineNode(nodeKey: string): void {
    if (this.status.Peer[nodeKey]) {
      this.status.Peer[nodeKey].Online = false;
      this.status.Peer[nodeKey].LastSeen = new Date(Date.now() - 86400000).toISOString();
    }
  }

  simulateNetworkError(): void {
    // This could be used to test error handling
  }
}
