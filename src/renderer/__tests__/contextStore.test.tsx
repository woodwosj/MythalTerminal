import { renderHook, act, waitFor } from '@testing-library/react';
import { useContextStore } from '../stores/contextStore';

describe('ContextStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useContextStore.setState({
      layers: [],
      totalTokens: 0,
      starredTokens: 0,
      activeTokens: 0,
      referenceTokens: 0,
      archiveTokens: 0
    });
  });

  describe('loadContext', () => {
    it('should load context layers from API', async () => {
      const mockLayers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active',
          content: 'test',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user'
        }
      ];

      window.mythalAPI.context.get = jest.fn().mockResolvedValue({
        success: true,
        layers: mockLayers
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test');
      });

      expect(result.current.layers).toEqual(mockLayers);
      expect(window.mythalAPI.context.get).toHaveBeenCalledWith('/test');
    });

    it('should calculate tokens after loading', async () => {
      const mockLayers = [
        {
          id: 1,
          layer_type: 'active',
          content: 'test',
          tokens: 100,
          is_starred: false,
          source: 'user'
        },
        {
          id: 2,
          layer_type: 'reference',
          content: 'test2',
          tokens: 200,
          is_starred: true,
          source: 'ai'
        }
      ];

      window.mythalAPI.context.get = jest.fn().mockResolvedValue({
        success: true,
        layers: mockLayers
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test');
      });

      expect(result.current.totalTokens).toBe(300);
      expect(result.current.activeTokens).toBe(100);
      expect(result.current.referenceTokens).toBe(200);
      expect(result.current.starredTokens).toBe(200);
    });
  });

  describe('addLayer', () => {
    it('should add new layer and update tokens', async () => {
      const newLayer = {
        project_path: '/test',
        layer_type: 'active' as const,
        content: 'new content',
        tokens: 150,
        is_starred: true,
        is_immutable: false,
        source: 'user' as const
      };

      window.mythalAPI.context.save = jest.fn().mockResolvedValue({
        success: true,
        id: 3
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.addLayer(newLayer);
      });

      expect(result.current.layers).toHaveLength(1);
      expect(result.current.layers[0]).toMatchObject({
        ...newLayer,
        id: 3
      });
      expect(result.current.totalTokens).toBe(150);
      expect(result.current.starredTokens).toBe(150);
    });
  });

  describe('toggleStar', () => {
    it('should toggle star status and recalculate tokens', async () => {
      const initialLayer = {
        id: 1,
        project_path: '/test',
        layer_type: 'active' as const,
        content: 'test',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      useContextStore.setState({ layers: [initialLayer] });

      window.mythalAPI.context.update = jest.fn().mockResolvedValue({
        success: true
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.toggleStar(1);
      });

      expect(window.mythalAPI.context.update).toHaveBeenCalledWith(1, {
        is_starred: true
      });
      expect(result.current.layers[0].is_starred).toBe(true);
    });
  });

  describe('deleteLayer', () => {
    it('should remove layer and update tokens', async () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'test1',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test',
          layer_type: 'reference' as const,
          content: 'test2',
          tokens: 200,
          is_starred: false,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      useContextStore.setState({ layers });

      window.mythalAPI.context.delete = jest.fn().mockResolvedValue({
        success: true
      });

      const { result } = renderHook(() => useContextStore());

      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(300);

      await act(async () => {
        await result.current.deleteLayer(1);
      });

      expect(result.current.layers).toHaveLength(1);
      expect(result.current.layers[0].id).toBe(2);
      expect(result.current.totalTokens).toBe(200);
    });
  });

  describe('calculateTokens', () => {
    it('should calculate tokens by layer type', () => {
      const layers = [
        {
          id: 1,
          layer_type: 'core' as const,
          tokens: 100,
          is_starred: true,
          source: 'user' as const
        },
        {
          id: 2,
          layer_type: 'active' as const,
          tokens: 200,
          is_starred: false,
          source: 'ai' as const
        },
        {
          id: 3,
          layer_type: 'reference' as const,
          tokens: 300,
          is_starred: false,
          source: 'system' as const
        },
        {
          id: 4,
          layer_type: 'archive' as const,
          tokens: 400,
          is_starred: false,
          source: 'user' as const
        }
      ];

      const { result } = renderHook(() => useContextStore());

      act(() => {
        useContextStore.setState({ layers: layers as any });
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(1000);
      expect(result.current.starredTokens).toBe(200); // core layer counts as starred
      expect(result.current.activeTokens).toBe(200);
      expect(result.current.referenceTokens).toBe(300);
      expect(result.current.archiveTokens).toBe(400);
    });

    it('should use actual_tokens when available', () => {
      const layers = [
        {
          id: 1,
          layer_type: 'active' as const,
          tokens: 100,
          actual_tokens: 95,
          is_starred: false,
          source: 'user' as const
        }
      ];

      const { result } = renderHook(() => useContextStore());

      act(() => {
        useContextStore.setState({ layers: layers as any });
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(95);
    });

    it('should handle starred items correctly', () => {
      const layers = [
        {
          id: 1,
          layer_type: 'active' as const,
          tokens: 100,
          is_starred: true,
          source: 'user' as const
        },
        {
          id: 2,
          layer_type: 'reference' as const,
          tokens: 200,
          is_starred: true,
          source: 'ai' as const
        }
      ];

      const { result } = renderHook(() => useContextStore());

      act(() => {
        useContextStore.setState({ layers: layers as any });
        result.current.calculateTokens();
      });

      expect(result.current.starredTokens).toBe(300);
    });
  });
});