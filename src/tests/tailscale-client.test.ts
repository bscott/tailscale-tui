import { TailscaleClient } from '../cli/tailscale-client';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');

interface MockProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
}

describe('TailscaleClient', () => {
  let client: TailscaleClient;
  let mockProcess: MockProcess;

  beforeEach(() => {
    client = new TailscaleClient();
    mockProcess = new EventEmitter() as MockProcess;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();

    (spawn as jest.Mock).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return parsed status on success', async () => {
      const mockStatus = {
        Version: '1.72.1',
        BackendState: 'Running',
        Self: {
          ID: 'test-node',
          HostName: 'test-host',
          Online: true
        },
        Peer: {},
        User: {}
      };

      const statusPromise = client.getStatus();

      mockProcess.stdout!.emit('data', JSON.stringify(mockStatus));
      (mockProcess as any).emit('close', 0);

      const result = await statusPromise;
      expect(result).toEqual(mockStatus);
      expect(spawn).toHaveBeenCalledWith('tailscale', ['status', '--json']);
    });

    it('should return null on command failure', async () => {
      const statusPromise = client.getStatus();

      mockProcess.stderr!.emit('data', 'error occurred');
      (mockProcess as any).emit('close', 1);

      const result = await statusPromise;
      expect(result).toBeNull();
    });

    it('should return null on invalid JSON', async () => {
      const statusPromise = client.getStatus();

      mockProcess.stdout!.emit('data', 'invalid json {');
      (mockProcess as any).emit('close', 0);

      const result = await statusPromise;
      expect(result).toBeNull();
    });
  });

  describe('getExitNodes', () => {
    it('should return exit nodes from status', async () => {
      const mockStatus = {
        Version: '1.72.1',
        TUN: true,
        BackendState: 'Running',
        AuthURL: '',
        TailscaleIPs: ['100.64.1.1'],
        Self: {
          ID: 'self-node',
          PublicKey: 'nodekey:self',
          HostName: 'local',
          DNSName: 'local.ts.net.',
          OS: 'linux',
          UserID: 1,
          TailscaleIPs: ['100.64.1.1'],
          ExitNodeOption: false,
          Online: true,
          Active: true,
          Created: '2024-01-01T00:00:00Z',
          LastSeen: '2024-01-01T00:00:00Z'
        },
        Peer: {
          'peer1': {
            ID: 'peer1-id',
            PublicKey: 'nodekey:peer1',
            HostName: 'exit-us',
            DNSName: 'exit-us.ts.net.',
            UserID: 2,
            OS: 'linux',
            TailscaleIPs: ['100.64.1.2'],
            ExitNodeOption: true,
            ExitNode: false,
            Online: true,
            Active: true,
            Created: '2024-01-01T00:00:00Z',
            LastSeen: '2024-01-01T00:00:00Z',
            Location: {
              Country: 'United States',
              CountryCode: 'US',
              City: 'San Francisco',
              CityCode: 'SFO',
              Priority: 1
            }
          }
        },
        User: {
          '1': { ID: 1, LoginName: 'user@example.com', DisplayName: 'User', ProfilePicURL: '' },
          '2': { ID: 2, LoginName: 'admin@example.com', DisplayName: 'Admin', ProfilePicURL: '' }
        }
      };

      const exitNodesPromise = client.getExitNodes();

      // Wait for the getStatus call within getExitNodes
      await new Promise(resolve => setTimeout(resolve, 0));
      mockProcess.stdout.emit('data', JSON.stringify(mockStatus));
      mockProcess.emit('close', 0);

      const exitNodes = await exitNodesPromise;

      expect(exitNodes).toHaveLength(1);
      expect(exitNodes[0]).toMatchObject({
        id: 'peer1-id',
        hostname: 'exit-us',
        owner: 'Admin',
        os: 'linux',
        online: true,
        canRoute: true,
        isActive: false
      });
    });

    it('should return empty array when status fails', async () => {
      const exitNodesPromise = client.getExitNodes();

      await new Promise(resolve => setTimeout(resolve, 0));
      mockProcess.emit('close', 1);

      const exitNodes = await exitNodesPromise;
      expect(exitNodes).toEqual([]);
    });
  });

  describe('setExitNode', () => {
    it('should set exit node successfully', async () => {
      const setPromise = client.setExitNode('node-id-123');

      mockProcess.stdout!.emit('data', 'Success');
      (mockProcess as any).emit('close', 0);

      const result = await setPromise;
      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalledWith('tailscale', ['exit-node', 'set', 'node-id-123']);
    });

    it('should retry with sudo on permission denied', async () => {
      let callCount = 0;
      (spawn as jest.Mock).mockImplementation(() => {
        const process = new EventEmitter() as MockProcess;
        process.stdout = new EventEmitter();
        process.stderr = new EventEmitter();
        process.kill = jest.fn();

        setTimeout(() => {
          if (callCount === 0) {
            process.stderr.emit('data', 'permission denied');
            process.emit('close', 1);
          } else {
            process.stdout.emit('data', 'Success with sudo');
            process.emit('close', 0);
          }
          callCount++;
        }, 0);

        return process;
      });

      const result = await client.setExitNode('node-id-123');

      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalledTimes(2);
      expect(spawn).toHaveBeenNthCalledWith(1, 'tailscale', ['exit-node', 'set', 'node-id-123']);
      expect(spawn).toHaveBeenNthCalledWith(2, 'sudo', ['tailscale', 'exit-node', 'set', 'node-id-123']);
    });
  });

  describe('unsetExitNode', () => {
    it('should unset exit node successfully', async () => {
      const unsetPromise = client.unsetExitNode();

      mockProcess.stdout!.emit('data', 'Exit node unset');
      (mockProcess as any).emit('close', 0);

      const result = await unsetPromise;
      expect(result.success).toBe(true);
      expect(spawn).toHaveBeenCalledWith('tailscale', ['exit-node', 'unset']);
    });
  });

  describe('ping', () => {
    it('should ping target successfully', async () => {
      const pingPromise = client.ping('100.64.1.1');

      mockProcess.stdout!.emit('data', 'pong from 100.64.1.1');
      (mockProcess as any).emit('close', 0);

      const result = await pingPromise;
      expect(result.success).toBe(true);
      expect(result.output).toContain('pong from 100.64.1.1');
      expect(spawn).toHaveBeenCalledWith('tailscale', ['ping', '--c', '1', '100.64.1.1']);
    });
  });

  describe('command timeout', () => {
    it('should timeout after 15 seconds', async () => {
      jest.useFakeTimers();

      const statusPromise = client.getStatus();

      // Fast-forward time by 15 seconds
      jest.advanceTimersByTime(15000);

      const result = await statusPromise;
      expect(result).toBeNull();
      expect(mockProcess.kill).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
