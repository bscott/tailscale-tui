import { MockTailscaleClient } from '../cli/mock-client';

describe('TailscaleTUIApp', () => {
  let mockClient: MockTailscaleClient;

  beforeEach(() => {
    mockClient = new MockTailscaleClient();
  });

  describe('MockTailscaleClient', () => {
    it('should return mock status', async () => {
      const status = await mockClient.getStatus();

      expect(status).not.toBeNull();
      expect(status?.Version).toContain('mock');
      expect(status?.BackendState).toBe('Running');
      expect(status?.Self).toBeDefined();
    });

    it('should return exit nodes', async () => {
      const exitNodes = await mockClient.getExitNodes();

      expect(exitNodes).toBeDefined();
      expect(Array.isArray(exitNodes)).toBe(true);
      expect(exitNodes.length).toBeGreaterThan(0);
    });

    it('should set exit node', async () => {
      const exitNodes = await mockClient.getExitNodes();
      const firstNode = exitNodes[0];

      const result = await mockClient.setExitNode(firstNode.id);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should fail to set non-existent exit node', async () => {
      const result = await mockClient.setExitNode('invalid-node-id');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBeDefined();
    });

    it('should unset exit node', async () => {
      const result = await mockClient.unsetExitNode();

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should ping target', async () => {
      const result = await mockClient.ping('100.64.1.1');

      expect(result.success).toBe(true);
      expect(result.output).toContain('pong');
    });

    it('should handle command delay', async () => {
      mockClient.setCommandDelay(100);

      const startTime = Date.now();
      await mockClient.getStatus();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should simulate offline node', async () => {
      const exitNodes = await mockClient.getExitNodes();
      const nodeId = exitNodes[0].id;

      // Simulate the node going offline
      mockClient.simulateOfflineNode(nodeId);

      const status = await mockClient.getStatus();
      expect(status).not.toBeNull();
    });

    it('should track active exit node', async () => {
      const exitNodes = await mockClient.getExitNodes();
      const firstNode = exitNodes[0];

      await mockClient.setExitNode(firstNode.id);

      const updatedExitNodes = await mockClient.getExitNodes();
      const activeNode = updatedExitNodes.find(n => n.isActive);

      expect(activeNode).toBeDefined();
      expect(activeNode?.id).toBe(firstNode.id);
    });

    it('should clear active exit node on unset', async () => {
      const exitNodes = await mockClient.getExitNodes();
      await mockClient.setExitNode(exitNodes[0].id);
      await mockClient.unsetExitNode();

      const updatedExitNodes = await mockClient.getExitNodes();
      const activeNode = updatedExitNodes.find(n => n.isActive);

      expect(activeNode).toBeUndefined();
    });
  });
});
