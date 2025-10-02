import { TailscaleTUI } from '../components/ui';

// Mock blessed module
jest.mock('blessed', () => ({
  screen: jest.fn(() => ({
    append: jest.fn(),
    render: jest.fn(),
    destroy: jest.fn(),
    key: jest.fn(),
    on: jest.fn()
  })),
  box: jest.fn(() => ({
    append: jest.fn(),
    setContent: jest.fn(),
    hide: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    on: jest.fn()
  })),
  table: jest.fn(() => ({
    setData: jest.fn(),
    hide: jest.fn(),
    show: jest.fn(),
    focus: jest.fn(),
    on: jest.fn(),
    key: jest.fn()
  }))
}));

describe('TailscaleTUI', () => {
  let tui: TailscaleTUI;

  beforeEach(() => {
    jest.clearAllMocks();
    tui = new TailscaleTUI();
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      expect(tui).toBeDefined();
    });
  });

  describe('render', () => {
    it('should render with null status', () => {
      expect(() => tui.render()).not.toThrow();
    });

    it('should call render multiple times', () => {
      expect(() => {
        tui.render();
        tui.render();
        tui.render();
      }).not.toThrow();
    });
  });

  describe('setCallbacks', () => {
    it('should set callback functions', () => {
      const mockRefresh = jest.fn();
      const mockExitNodeSelect = jest.fn();
      const mockQuit = jest.fn();

      expect(() => {
        tui.setCallbacks({
          onRefresh: mockRefresh,
          onExitNodeSelect: mockExitNodeSelect,
          onQuit: mockQuit
        });
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should destroy the screen', () => {
      expect(() => tui.destroy()).not.toThrow();
    });
  });
});
