import { spawn } from 'child_process';
import { TailscaleStatus, CommandResult, ExitNodeInfo } from '../models/tailscale';

export class TailscaleClient {
  private tailscalePath: string;

  constructor(tailscalePath = 'tailscale') {
    this.tailscalePath = tailscalePath;
  }

  async getStatus(): Promise<TailscaleStatus | null> {
    try {
      const result = await this.executeCommand(['status', '--json']);
      if (result.success && result.output) {
        return JSON.parse(result.output) as TailscaleStatus;
      }
      // Log error for debugging
      console.error('Tailscale status failed:', result.error || 'No output');
      return null;
    } catch (error) {
      console.error('Failed to parse tailscale status:', error);
      return null;
    }
  }

  async getExitNodes(): Promise<ExitNodeInfo[]> {
    try {
      const status = await this.getStatus();
      if (!status) return [];

      const exitNodes: ExitNodeInfo[] = [];
      
      // Process self if it can be an exit node
      if (status.Self.ExitNodeOption) {
        exitNodes.push(this.deviceToExitNode(status.Self, status));
      }

      // Process peers that can be exit nodes
      Object.values(status.Peer || {}).forEach(peer => {
        if (peer.ExitNodeOption) {
          exitNodes.push(this.deviceToExitNode(peer, status));
        }
      });

      return exitNodes.sort((a, b) => a.hostname.localeCompare(b.hostname));
    } catch (error) {
      console.error('Failed to get exit nodes:', error);
      return [];
    }
  }

  async setExitNode(nodeId: string): Promise<CommandResult> {
    const result = await this.executeCommand(['exit-node', 'set', nodeId]);
    
    // If permission denied, try with sudo
    if (!result.success && result.error?.includes('permission denied')) {
      return this.executeCommandWithSudo(['exit-node', 'set', nodeId]);
    }
    
    return result;
  }

  async unsetExitNode(): Promise<CommandResult> {
    const result = await this.executeCommand(['exit-node', 'unset']);
    
    // If permission denied, try with sudo
    if (!result.success && result.error?.includes('permission denied')) {
      return this.executeCommandWithSudo(['exit-node', 'unset']);
    }
    
    return result;
  }

  async ping(target: string): Promise<CommandResult> {
    return this.executeCommand(['ping', '--c', '1', target]);
  }

  private deviceToExitNode(device: any, status: TailscaleStatus): ExitNodeInfo {
    const user = status.User?.[device.UserID] || null;
    return {
      id: device.ID,
      hostname: device.HostName,
      owner: user?.DisplayName || user?.LoginName || 'Unknown',
      os: device.OS || 'Unknown',
      location: device.Location,
      online: device.Online !== false,
      canRoute: device.ExitNodeOption || false,
      isActive: device.ExitNode || false,
      lastSeen: device.LastSeen || device.Created
    };
  }

  private executeCommand(args: string[]): Promise<CommandResult> {
    return this.executeProcess(this.tailscalePath, args);
  }

  private executeCommandWithSudo(args: string[]): Promise<CommandResult> {
    return this.executeProcess('sudo', [this.tailscalePath, ...args]);
  }

  private executeProcess(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve) => {
      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout.trim(),
          error: stderr.trim() || undefined,
          exitCode: code || 0
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message,
          exitCode: 1
        });
      });

      // Set a timeout for commands
      setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          output: '',
          error: 'Command timed out',
          exitCode: 1
        });
      }, 15000); // 15 second timeout for sudo commands
    });
  }
}
