export interface TailscaleStatus {
  Version: string;
  TUN: boolean;
  BackendState: string;
  AuthURL: string;
  TailscaleIPs: string[];
  Self: TailscaleDevice;
  Peer: Record<string, TailscaleDevice>;
  User: Record<string, TailscaleUser>;
  CurrentTailnet?: TailscaleTailnet;
  CertDomains?: string[];
  MagicDNSSuffix?: string;
  MagicDNSEnabled?: boolean;
}

export interface TailscaleDevice {
  ID: string;
  PublicKey: string;
  HostName: string;
  DNSName: string;
  OS: string;
  UserID: number;
  TailscaleIPs: string[];
  Addrs?: string[];
  CurAddr?: string;
  Relay?: string;
  RxBytes?: number;
  TxBytes?: number;
  Created: string;
  LastSeen: string;
  LastHandshake?: string;
  Online?: boolean;
  ExitNode?: boolean;
  ExitNodeOption?: boolean;
  Active: boolean;
  PeerAPIURL?: string[];
  Capabilities?: string[];
  InNetworkMap?: boolean;
  InMagicSock?: boolean;
  InEngine?: boolean;
  Location?: TailscaleLocation;
}

export interface TailscaleUser {
  ID: number;
  LoginName: string;
  DisplayName: string;
  ProfilePicURL: string;
  Roles?: string[];
}

export interface TailscaleTailnet {
  Name: string;
  MagicDNSSuffix: string;
  MagicDNSEnabled: boolean;
}

export interface TailscaleLocation {
  Country: string;
  CountryCode: string;
  City: string;
  CityCode: string;
  Priority: number;
}

export interface ExitNodeInfo {
  id: string;
  hostname: string;
  owner: string;
  os: string;
  location?: TailscaleLocation;
  online: boolean;
  canRoute: boolean;
  isActive: boolean;
  lastSeen: string;
}

export interface TUIState {
  status: TailscaleStatus | null;
  exitNodes: ExitNodeInfo[];
  lastRefresh: Date | null;
  isStale: boolean;
  currentView: 'local' | 'peers' | 'exitnodes' | 'diagnostics';
  isLoading: boolean;
  error: string | null;
  notifications: string[];
}

export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
}
