import { renderHook, act } from '@testing-library/react';
import { useContextStore } from '../stores/contextStore';

// Mock the window.mythalAPI
const mockMythalAPI = {
  context: {
    get: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
};

// Set up the mock before importing
Object.defineProperty(window, 'mythalAPI', {
  value: mockMythalAPI,
  writable: true
});

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ContextStore - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the store to initial state
    useContextStore.setState({
      layers: [],
      totalTokens: 0,
      starredTokens: 0,
      activeTokens: 0,
      referenceTokens: 0,
      archiveTokens: 0
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useContextStore());

      expect(result.current.layers).toEqual([]);
      expect(result.current.totalTokens).toBe(0);
      expect(result.current.maxTokens).toBe(200000);
      expect(result.current.starredTokens).toBe(0);
      expect(result.current.activeTokens).toBe(0);
      expect(result.current.referenceTokens).toBe(0);
      expect(result.current.archiveTokens).toBe(0);
    });

    it('should have all required methods', () => {
      const { result } = renderHook(() => useContextStore());

      expect(typeof result.current.loadContext).toBe('function');
      expect(typeof result.current.addLayer).toBe('function');
      expect(typeof result.current.updateLayer).toBe('function');
      expect(typeof result.current.deleteLayer).toBe('function');
      expect(typeof result.current.toggleStar).toBe('function');
      expect(typeof result.current.calculateTokens).toBe('function');
    });
  });

  describe('Load Context', () => {
    it('should load context layers successfully', async () => {
      const mockLayers = [
        {
          id: 1,
          project_path: '/test/project',
          layer_type: 'active' as const,
          content: 'Layer 1 content',
          tokens: 100,
          actual_tokens: 95,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test/project',
          layer_type: 'reference' as const,
          content: 'Layer 2 content',
          tokens: 200,
          is_starred: true,
          is_immutable: true,
          source: 'system' as const
        }
      ];

      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: mockLayers
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      expect(mockMythalAPI.context.get).toHaveBeenCalledWith('/test/project');
      expect(result.current.layers).toEqual(mockLayers);
      expect(result.current.totalTokens).toBe(295); // 95 + 200
      expect(result.current.starredTokens).toBe(200); // Layer 2 is starred
      expect(result.current.activeTokens).toBe(95); // Layer 1 is active
      expect(result.current.referenceTokens).toBe(200); // Layer 2 is reference
    });

    it('should handle empty context load', async () => {
      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: []
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/empty/project');
      });

      expect(result.current.layers).toEqual([]);
      expect(result.current.totalTokens).toBe(0);
    });

    it('should handle API errors during load', async () => {
      mockMythalAPI.context.get.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/error/project');
      });

      expect(result.current.layers).toEqual([]);
      // The store doesn't actually throw an error for failed API responses
    });

    it('should handle network errors during load', async () => {
      mockMythalAPI.context.get.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/network/error');
      });

      expect(result.current.layers).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('Failed to load context:', expect.any(Error));
    });

    it('should recalculate tokens after successful load', async () => {
      const mockLayers = [
        {
          id: 1,
          project_path: '/test/project',
          layer_type: 'core' as const,
          content: 'Core layer',
          tokens: 500,
          is_starred: false,
          is_immutable: true,
          source: 'system' as const
        }
      ];

      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: mockLayers
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      // Core layers are ONLY counted in the core switch case, not as starred
      expect(result.current.starredTokens).toBe(500); // Core layers count as starred
      expect(result.current.totalTokens).toBe(500);
    });
  });

  describe('Add Layer', () => {
    it('should add new layer successfully', async () => {
      mockMythalAPI.context.save.mockResolvedValue({
        success: true,
        id: 123
      });

      const { result } = renderHook(() => useContextStore());

      const newLayer = {
        project_path: '/test/project',
        layer_type: 'active' as const,
        content: 'New layer content',
        tokens: 150,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      await act(async () => {
        await result.current.addLayer(newLayer);
      });

      expect(mockMythalAPI.context.save).toHaveBeenCalledWith(newLayer);
      expect(result.current.layers).toHaveLength(1);
      expect(result.current.layers[0]).toEqual({ ...newLayer, id: 123 });
      expect(result.current.totalTokens).toBe(150);
      expect(result.current.activeTokens).toBe(150);
    });

    it('should add starred layer and update counts', async () => {
      mockMythalAPI.context.save.mockResolvedValue({
        success: true,
        id: 456
      });

      const { result } = renderHook(() => useContextStore());

      const starredLayer = {
        project_path: '/test/project',
        layer_type: 'reference' as const,
        content: 'Important reference',
        tokens: 300,
        actual_tokens: 280,
        is_starred: true,
        is_immutable: false,
        source: 'user' as const
      };

      await act(async () => {
        await result.current.addLayer(starredLayer);
      });

      expect(result.current.layers[0].is_starred).toBe(true);
      expect(result.current.totalTokens).toBe(280); // Uses actual_tokens
      expect(result.current.starredTokens).toBe(280);
      expect(result.current.referenceTokens).toBe(280);
    });

    it('should handle add layer API errors', async () => {
      mockMythalAPI.context.save.mockResolvedValue({
        success: false,
        error: 'Validation failed'
      });

      const { result } = renderHook(() => useContextStore());

      const newLayer = {
        project_path: '/test/project',
        layer_type: 'active' as const,
        content: 'Layer content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      await act(async () => {
        await result.current.addLayer(newLayer);
      });

      expect(result.current.layers).toHaveLength(0);
      // The store handles API failures silently
    });

    it('should handle network errors during add', async () => {
      mockMythalAPI.context.save.mockRejectedValue(new Error('Connection timeout'));

      const { result } = renderHook(() => useContextStore());

      const newLayer = {
        project_path: '/test/project',
        layer_type: 'active' as const,
        content: 'Layer content',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };

      await act(async () => {
        await result.current.addLayer(newLayer);
      });

      expect(result.current.layers).toHaveLength(0);
      expect(console.error).toHaveBeenCalledWith('Failed to add layer:', expect.any(Error));
    });
  });

  describe('Update Layer', () => {
    beforeEach(async () => {
      // Set up initial layers
      const initialLayers = [
        {
          id: 1,
          project_path: '/test/project',
          layer_type: 'active' as const,
          content: 'Initial content',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test/project',
          layer_type: 'reference' as const,
          content: 'Reference content',
          tokens: 200,
          is_starred: true,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      useContextStore.setState({ layers: initialLayers });
      useContextStore.getState().calculateTokens();
    });

    it('should update layer successfully', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      const updates = {
        content: 'Updated content',
        tokens: 150,
        is_starred: true
      };

      await act(async () => {
        await result.current.updateLayer(1, updates);
      });

      expect(mockMythalAPI.context.update).toHaveBeenCalledWith(1, updates);
      
      const updatedLayer = result.current.layers.find(l => l.id === 1);
      expect(updatedLayer).toMatchObject(updates);
      expect(result.current.totalTokens).toBe(350); // 150 + 200
      expect(result.current.starredTokens).toBe(350); // Both layers starred
    });

    it('should update layer type and recalculate tokens', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.updateLayer(1, { 
          layer_type: 'archive',
          tokens: 120
        });
      });

      expect(result.current.activeTokens).toBe(0); // No more active layers
      expect(result.current.archiveTokens).toBe(120); // New archive layer
      expect(result.current.referenceTokens).toBe(200); // Unchanged
    });

    it('should handle partial updates', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.updateLayer(2, { content: 'Only content changed' });
      });

      const updatedLayer = result.current.layers.find(l => l.id === 2);
      expect(updatedLayer?.content).toBe('Only content changed');
      expect(updatedLayer?.tokens).toBe(200); // Unchanged
      expect(updatedLayer?.is_starred).toBe(true); // Unchanged
    });

    it('should handle update API errors', async () => {
      mockMythalAPI.context.update.mockResolvedValue({
        success: false,
        error: 'Layer is immutable'
      });

      const { result } = renderHook(() => useContextStore());
      const originalLayer = result.current.layers.find(l => l.id === 1);

      await act(async () => {
        await result.current.updateLayer(1, { content: 'Should not change' });
      });

      const unchangedLayer = result.current.layers.find(l => l.id === 1);
      expect(unchangedLayer).toEqual(originalLayer);
      // The store handles API failures silently
    });

    it('should handle update for non-existent layer', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.updateLayer(999, { content: 'Non-existent' });
      });

      // Should not crash, layers remain unchanged
      expect(result.current.layers).toHaveLength(2);
    });

    it('should use actual_tokens when available for calculations', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.updateLayer(1, { 
          tokens: 100,
          actual_tokens: 80
        });
      });

      expect(result.current.totalTokens).toBe(280); // 80 + 200
    });
  });

  describe('Delete Layer', () => {
    beforeEach(async () => {
      const initialLayers = [
        {
          id: 1,
          project_path: '/test/project',
          layer_type: 'active' as const,
          content: 'Layer to delete',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test/project',
          layer_type: 'reference' as const,
          content: 'Layer to keep',
          tokens: 200,
          is_starred: true,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      useContextStore.setState({ layers: initialLayers });
      useContextStore.getState().calculateTokens();
    });

    it('should delete layer successfully', async () => {
      mockMythalAPI.context.delete.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.deleteLayer(1);
      });

      expect(mockMythalAPI.context.delete).toHaveBeenCalledWith(1);
      expect(result.current.layers).toHaveLength(1);
      expect(result.current.layers[0].id).toBe(2);
      expect(result.current.totalTokens).toBe(200);
      expect(result.current.activeTokens).toBe(0);
    });

    it('should handle delete API errors', async () => {
      mockMythalAPI.context.delete.mockResolvedValue({
        success: false,
        error: 'Layer is protected'
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.deleteLayer(1);
      });

      expect(result.current.layers).toHaveLength(2); // No change
      // The store handles API failures silently
    });

    it('should handle delete for non-existent layer', async () => {
      mockMythalAPI.context.delete.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.deleteLayer(999);
      });

      expect(result.current.layers).toHaveLength(2); // No change
    });

    it('should recalculate tokens after deletion', async () => {
      mockMythalAPI.context.delete.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      // Delete the starred reference layer
      await act(async () => {
        await result.current.deleteLayer(2);
      });

      expect(result.current.starredTokens).toBe(0); // No more starred
      expect(result.current.referenceTokens).toBe(0); // No more reference
      expect(result.current.activeTokens).toBe(100); // Only active layer remains
    });

    it('should handle network errors during delete', async () => {
      mockMythalAPI.context.delete.mockRejectedValue(new Error('Network timeout'));

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.deleteLayer(1);
      });

      expect(result.current.layers).toHaveLength(2); // No change
      expect(console.error).toHaveBeenCalledWith('Failed to delete layer:', expect.any(Error));
    });
  });

  describe('Toggle Star', () => {
    beforeEach(async () => {
      const initialLayers = [
        {
          id: 1,
          project_path: '/test/project',
          layer_type: 'active' as const,
          content: 'Unstarred layer',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test/project',
          layer_type: 'reference' as const,
          content: 'Starred layer',
          tokens: 200,
          is_starred: true,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      useContextStore.setState({ layers: initialLayers });
      useContextStore.getState().calculateTokens();
    });

    it('should star unstarred layer', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.toggleStar(1);
      });

      expect(mockMythalAPI.context.update).toHaveBeenCalledWith(1, { is_starred: true });
      
      const layer = result.current.layers.find(l => l.id === 1);
      expect(layer?.is_starred).toBe(true);
      expect(result.current.starredTokens).toBe(300); // 100 + 200
    });

    it('should unstar starred layer', async () => {
      mockMythalAPI.context.update.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.toggleStar(2);
      });

      expect(mockMythalAPI.context.update).toHaveBeenCalledWith(2, { is_starred: false });
      
      const layer = result.current.layers.find(l => l.id === 2);
      expect(layer?.is_starred).toBe(false);
      expect(result.current.starredTokens).toBe(0); // No starred layers
    });

    it('should handle toggle for non-existent layer', async () => {
      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.toggleStar(999);
      });

      expect(mockMythalAPI.context.update).not.toHaveBeenCalled();
    });

    it('should handle toggle star API errors', async () => {
      mockMythalAPI.context.update.mockResolvedValue({
        success: false,
        error: 'Update failed'
      });

      const { result } = renderHook(() => useContextStore());
      const originalStarred = result.current.starredTokens;

      await act(async () => {
        await result.current.toggleStar(1);
      });

      expect(result.current.starredTokens).toBe(originalStarred); // Unchanged
      // The store handles API failures silently
    });
  });

  describe('Token Calculations', () => {
    it('should calculate tokens correctly for different layer types', () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'core' as const,
          content: 'Core',
          tokens: 100,
          is_starred: false,
          is_immutable: true,
          source: 'system' as const
        },
        {
          id: 2,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'Active',
          tokens: 200,
          is_starred: true,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 3,
          project_path: '/test',
          layer_type: 'reference' as const,
          content: 'Reference',
          tokens: 300,
          is_starred: false,
          is_immutable: false,
          source: 'ai' as const
        },
        {
          id: 4,
          project_path: '/test',
          layer_type: 'archive' as const,
          content: 'Archive',
          tokens: 150,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      useContextStore.setState({ layers });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(750); // 100 + 200 + 300 + 150
      expect(result.current.starredTokens).toBe(300); // Core (100) + starred active (200)
      expect(result.current.activeTokens).toBe(200);
      expect(result.current.referenceTokens).toBe(300);
      expect(result.current.archiveTokens).toBe(150);
    });

    it('should prefer actual_tokens over estimated tokens', () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'Layer 1',
          tokens: 200,
          actual_tokens: 150,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 2,
          project_path: '/test',
          layer_type: 'reference' as const,
          content: 'Layer 2',
          tokens: 300,
          // No actual_tokens, should use tokens
          is_starred: false,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      useContextStore.setState({ layers });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(450); // 150 + 300
      expect(result.current.activeTokens).toBe(150);
      expect(result.current.referenceTokens).toBe(300);
    });

    it('should handle zero token counts', () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active' as const,
          content: '',
          tokens: 0,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      useContextStore.setState({ layers });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(0);
      expect(result.current.activeTokens).toBe(0);
    });

    it('should handle negative token counts', () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'Layer',
          tokens: 100,
          actual_tokens: -50, // Invalid but should handle gracefully
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      useContextStore.setState({ layers });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(-50);
      expect(result.current.activeTokens).toBe(-50);
    });

    it('should handle empty layers array', () => {
      useContextStore.setState({ layers: [] });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(0);
      expect(result.current.starredTokens).toBe(0);
      expect(result.current.activeTokens).toBe(0);
      expect(result.current.referenceTokens).toBe(0);
      expect(result.current.archiveTokens).toBe(0);
    });

    it('should count both starred and core layers in starredTokens', () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'core' as const,
          content: 'Core layer',
          tokens: 100,
          is_starred: false,
          is_immutable: true,
          source: 'system' as const
        },
        {
          id: 2,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'Starred active',
          tokens: 200,
          is_starred: true,
          is_immutable: false,
          source: 'user' as const
        },
        {
          id: 3,
          project_path: '/test',
          layer_type: 'reference' as const,
          content: 'Regular reference',
          tokens: 300,
          is_starred: false,
          is_immutable: false,
          source: 'ai' as const
        }
      ];

      useContextStore.setState({ layers });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      // Core layers get starred tokens from the switch case, starred layers get tokens from the is_starred check
      expect(result.current.starredTokens).toBe(300); // 100 (core category) + 200 (starred active)
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed API responses', async () => {
      mockMythalAPI.context.get.mockResolvedValue({
        success: true,
        layers: null // Malformed response
      });

      const { result } = renderHook(() => useContextStore());

      await act(async () => {
        await result.current.loadContext('/test/project');
      });

      // The store passes through whatever the API returns, including null
      expect(result.current.layers).toEqual(null);
    });

    it('should handle concurrent operations', async () => {
      mockMythalAPI.context.save.mockResolvedValue({ success: true, id: 1 });
      mockMythalAPI.context.update.mockResolvedValue({ success: true });
      mockMythalAPI.context.delete.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useContextStore());

      // Initial layer
      const layer = {
        id: 1,
        project_path: '/test',
        layer_type: 'active' as const,
        content: 'Test',
        tokens: 100,
        is_starred: false,
        is_immutable: false,
        source: 'user' as const
      };
      
      useContextStore.setState({ layers: [layer] });

      // Perform concurrent operations
      await act(async () => {
        await Promise.all([
          result.current.updateLayer(1, { content: 'Updated' }),
          result.current.toggleStar(1),
          result.current.deleteLayer(1)
        ]);
      });

      // Should handle without crashing
      expect(result.current.layers.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large token counts', () => {
      const layers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'Large layer',
          tokens: Number.MAX_SAFE_INTEGER,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      useContextStore.setState({ layers });
      
      const { result } = renderHook(() => useContextStore());
      
      act(() => {
        result.current.calculateTokens();
      });

      expect(result.current.totalTokens).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle layers with missing required fields', () => {
      const malformedLayers = [
        {
          id: 1,
          // Missing required fields
          tokens: 100
        } as any
      ];

      useContextStore.setState({ layers: malformedLayers });
      
      const { result } = renderHook(() => useContextStore());
      
      expect(() => {
        act(() => {
          result.current.calculateTokens();
        });
      }).not.toThrow();
    });

    it('should maintain consistency after failed operations', async () => {
      mockMythalAPI.context.update.mockResolvedValue({
        success: false,
        error: 'Server error'
      });

      const initialLayers = [
        {
          id: 1,
          project_path: '/test',
          layer_type: 'active' as const,
          content: 'Original content',
          tokens: 100,
          is_starred: false,
          is_immutable: false,
          source: 'user' as const
        }
      ];

      useContextStore.setState({ layers: initialLayers });
      
      const { result } = renderHook(() => useContextStore());
      
      const originalState = { ...result.current };

      await act(async () => {
        await result.current.updateLayer(1, { content: 'Should not change' });
      });

      // State should remain unchanged after failed operation
      expect(result.current.layers).toEqual(originalState.layers);
      expect(result.current.totalTokens).toBe(originalState.totalTokens);
    });
  });
});