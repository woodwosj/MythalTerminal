/**
 * Comprehensive tests for StatusBar component
 * Testing token display, warning levels, and Claude instance status
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import StatusBar from '../components/StatusBar';
import { useContextStore } from '../stores/contextStore';

// Mock the context store
jest.mock('../stores/contextStore', () => ({
  useContextStore: jest.fn()
}));

// Mock window.mythalAPI
const mockMythalAPI = {
  claude: {
    status: jest.fn(() => Promise.resolve({})),
  },
  tokens: {
    record: jest.fn(() => Promise.resolve())
  }
};

Object.defineProperty(window, 'mythalAPI', {
  value: mockMythalAPI,
  writable: true
});

describe('StatusBar Component Comprehensive Tests', () => {
  let mockUseContextStore: jest.MockedFunction<typeof useContextStore>;

  const defaultContextState = {
    totalTokens: 50000,
    maxTokens: 200000,
    starredTokens: 15000,
    activeTokens: 20000,
    referenceTokens: 10000,
    archiveTokens: 5000
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockUseContextStore = useContextStore as jest.MockedFunction<typeof useContextStore>;
    mockUseContextStore.mockReturnValue(defaultContextState);

    mockMythalAPI.claude.status.mockResolvedValue({
      main: 'running',
      contextManager: 'idle',
      summarizer: 'running',
      planner: 'crashed'
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Token Display', () => {
    it('should render token information correctly', () => {
      render(<StatusBar />);
      
      expect(screen.getByText('Context:')).toBeInTheDocument();
      expect(screen.getByText('50,000/200,000 tokens (25.0%)')).toBeInTheDocument();
    });

    it('should format large token numbers with commas', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 1234567,
        maxTokens: 5000000
      });

      render(<StatusBar />);
      
      expect(screen.getByText('1,234,567/5,000,000 tokens (24.7%)')).toBeInTheDocument();
    });

    it('should display token breakdown in progress bar', () => {
      render(<StatusBar />);
      
      // Find elements with title attributes for tooltips
      expect(screen.getByTitle('⭐ Core: 15,000 tokens')).toBeInTheDocument();
      expect(screen.getByTitle('Active: 20,000 tokens')).toBeInTheDocument();
      expect(screen.getByTitle('Reference: 10,000 tokens')).toBeInTheDocument();
      expect(screen.getByTitle('Archive: 5,000 tokens')).toBeInTheDocument();
    });

    it('should display token counts in abbreviated format', () => {
      render(<StatusBar />);
      
      expect(screen.getByText('⭐ 15.0k')).toBeInTheDocument();
      expect(screen.getByText('Active: 20.0k')).toBeInTheDocument();
      expect(screen.getByText('Ref: 10.0k')).toBeInTheDocument();
      expect(screen.getByText('Arc: 5.0k')).toBeInTheDocument();
    });

    it('should handle zero token counts', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 0,
        starredTokens: 0,
        activeTokens: 0,
        referenceTokens: 0,
        archiveTokens: 0
      });

      render(<StatusBar />);
      
      expect(screen.getByText('0/200,000 tokens (0.0%)')).toBeInTheDocument();
      expect(screen.getByText('⭐ 0.0k')).toBeInTheDocument();
      expect(screen.getByText('Active: 0.0k')).toBeInTheDocument();
      expect(screen.getByText('Ref: 0.0k')).toBeInTheDocument();
      expect(screen.getByText('Arc: 0.0k')).toBeInTheDocument();
    });

    it('should handle very small token counts', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 500,
        starredTokens: 100,
        activeTokens: 200,
        referenceTokens: 150,
        archiveTokens: 50
      });

      render(<StatusBar />);
      
      expect(screen.getByText('⭐ 0.1k')).toBeInTheDocument();
      expect(screen.getByText('Active: 0.2k')).toBeInTheDocument();
      expect(screen.getByText('Ref: 0.2k')).toBeInTheDocument();
      expect(screen.getByText('Arc: 0.1k')).toBeInTheDocument();
    });
  });

  describe('Warning Levels', () => {
    it('should show safe warning level for < 70% usage', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 130000, // 65%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('130,000/200,000 tokens (65.0%)');
      expect(tokenText).not.toHaveClass('text-red-400');
      expect(tokenText).toHaveClass('text-gray-200');
    });

    it('should show warning level for 70-89% usage', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 160000, // 80%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('160,000/200,000 tokens (80.0%)');
      expect(tokenText).not.toHaveClass('text-red-400');
      expect(tokenText).toHaveClass('text-gray-200');
    });

    it('should show critical warning level for >= 90% usage', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 180000, // 90%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('180,000/200,000 tokens (90.0%)');
      expect(tokenText).toHaveClass('text-red-400');
    });

    it('should handle exactly 70% usage boundary', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 140000, // exactly 70%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('140,000/200,000 tokens (70.0%)');
      expect(tokenText).not.toHaveClass('text-red-400');
      expect(tokenText).toHaveClass('text-gray-200');
    });

    it('should handle exactly 90% usage boundary', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 180000, // exactly 90%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('180,000/200,000 tokens (90.0%)');
      expect(tokenText).toHaveClass('text-red-400');
    });

    it('should handle 100% usage', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 200000, // 100%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('200,000/200,000 tokens (100.0%)');
      expect(tokenText).toHaveClass('text-red-400');
    });

    it('should handle over 100% usage', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 250000, // 125%
        maxTokens: 200000
      });

      render(<StatusBar />);
      
      const tokenText = screen.getByText('250,000/200,000 tokens (125.0%)');
      expect(tokenText).toHaveClass('text-red-400');
    });
  });

  describe('Progress Bar Visualization', () => {
    it('should render progress bars with correct widths', () => {
      render(<StatusBar />);
      
      // Check that progress bars exist and have style attributes
      const starredBar = screen.getByTitle('⭐ Core: 15,000 tokens');
      const activeBar = screen.getByTitle('Active: 20,000 tokens');
      const referenceBar = screen.getByTitle('Reference: 10,000 tokens');
      const archiveBar = screen.getByTitle('Archive: 5,000 tokens');

      expect(starredBar).toHaveStyle('width: 7.5%'); // 15000/200000 * 100
      expect(activeBar).toHaveStyle('width: 10%'); // 20000/200000 * 100
      expect(referenceBar).toHaveStyle('width: 5%'); // 10000/200000 * 100
      expect(archiveBar).toHaveStyle('width: 2.5%'); // 5000/200000 * 100
    });

    it('should handle zero token progress bars', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        starredTokens: 0,
        activeTokens: 0,
        referenceTokens: 0,
        archiveTokens: 0
      });

      render(<StatusBar />);
      
      const starredBar = screen.getByTitle('⭐ Core: 0 tokens');
      const activeBar = screen.getByTitle('Active: 0 tokens');
      const referenceBar = screen.getByTitle('Reference: 0 tokens');
      const archiveBar = screen.getByTitle('Archive: 0 tokens');

      expect(starredBar).toHaveStyle('width: 0%');
      expect(activeBar).toHaveStyle('width: 0%');
      expect(referenceBar).toHaveStyle('width: 0%');
      expect(archiveBar).toHaveStyle('width: 0%');
    });

    it('should have correct CSS classes for progress bars', () => {
      render(<StatusBar />);
      
      const starredBar = screen.getByTitle('⭐ Core: 15,000 tokens');
      const activeBar = screen.getByTitle('Active: 20,000 tokens');
      const referenceBar = screen.getByTitle('Reference: 10,000 tokens');
      const archiveBar = screen.getByTitle('Archive: 5,000 tokens');

      expect(starredBar).toHaveClass('bg-yellow-500');
      expect(activeBar).toHaveClass('bg-blue-500');
      expect(referenceBar).toHaveClass('bg-purple-500');
      expect(archiveBar).toHaveClass('bg-gray-500');
    });
  });

  describe('Claude Instance Status', () => {
    it('should display Claude instance statuses', async () => {
      render(<StatusBar />);

      await waitFor(() => {
        expect(screen.getByText('Claude Instances:')).toBeInTheDocument();
      });
    });

    it('should display icons for known instance types', async () => {
      mockMythalAPI.claude.status.mockResolvedValue({
        main: 'running',
        contextManager: 'idle',
        summarizer: 'running',
        planner: 'crashed'
      });

      render(<StatusBar />);

      await waitFor(() => {
        expect(screen.getByText('💻')).toBeInTheDocument(); // main
        expect(screen.getByText('📊')).toBeInTheDocument(); // contextManager
        expect(screen.getByText('📝')).toBeInTheDocument(); // summarizer
        expect(screen.getByText('📋')).toBeInTheDocument(); // planner
      });
    });

    it('should apply correct status colors', async () => {
      mockMythalAPI.claude.status.mockResolvedValue({
        main: 'running',
        contextManager: 'idle',
        summarizer: 'crashed',
        planner: 'restarting'
      });

      render(<StatusBar />);

      await waitFor(() => {
        const mainIcon = screen.getByText('💻');
        const contextIcon = screen.getByText('📊');
        const summarizerIcon = screen.getByText('📝');
        const plannerIcon = screen.getByText('📋');

        expect(mainIcon).toHaveClass('text-green-400'); // running
        expect(contextIcon).toHaveClass('text-gray-400'); // idle
        expect(summarizerIcon).toHaveClass('text-red-400'); // crashed
        expect(plannerIcon).toHaveClass('text-yellow-400'); // restarting
      });
    });

    it('should handle unknown status values', async () => {
      mockMythalAPI.claude.status.mockResolvedValue({
        main: 'unknown-status'
      });

      render(<StatusBar />);

      await waitFor(() => {
        const mainIcon = screen.getByText('💻');
        expect(mainIcon).toHaveClass('text-gray-400'); // default color
      });
    });

    it('should handle empty status response', async () => {
      mockMythalAPI.claude.status.mockResolvedValue({});

      render(<StatusBar />);

      await waitFor(() => {
        expect(screen.getByText('Claude Instances:')).toBeInTheDocument();
      });

      // Should not crash and should still show the label
      expect(screen.queryByText('💻')).not.toBeInTheDocument();
    });

    it('should handle status API errors', async () => {
      mockMythalAPI.claude.status.mockRejectedValue(new Error('API Error'));

      render(<StatusBar />);

      await waitFor(() => {
        expect(screen.getByText('Claude Instances:')).toBeInTheDocument();
      });

      // Should not crash on error
      expect(screen.queryByText('💻')).not.toBeInTheDocument();
    });

    it('should update status every 5 seconds', async () => {
      render(<StatusBar />);

      // Initial call
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(1);

      // Fast-forward 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(2);
      });

      // Fast-forward another 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(3);
      });
    });

    it('should cleanup timer on unmount', () => {
      const { unmount } = render(<StatusBar />);
      
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(1);

      unmount();

      // Fast-forward time after unmount
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Should not call again after unmount
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(1);
    });

    it('should have title attributes for tooltips', async () => {
      mockMythalAPI.claude.status.mockResolvedValue({
        main: 'running',
        contextManager: 'idle'
      });

      render(<StatusBar />);

      await waitFor(() => {
        const mainIcon = screen.getByText('💻');
        const contextIcon = screen.getByText('📊');

        expect(mainIcon).toHaveAttribute('title', 'main: running');
        expect(contextIcon).toHaveAttribute('title', 'contextManager: idle');
      });
    });
  });

  describe('Token Recording', () => {
    it('should record token usage with correct parameters', async () => {
      render(<StatusBar />);

      await waitFor(() => {
        expect(mockMythalAPI.tokens.record).toHaveBeenCalledWith(
          50000,   // totalTokens
          undefined, // actual tokens
          25.0,    // percentage
          'safe'   // warning level
        );
      });
    });

    it('should record different warning levels', async () => {
      // Test safe level
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 130000, // 65%
      });

      const { rerender } = render(<StatusBar />);

      await waitFor(() => {
        expect(mockMythalAPI.tokens.record).toHaveBeenCalledWith(
          130000, undefined, 65.0, 'safe'
        );
      });

      // Test warning level
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 160000, // 80%
      });

      rerender(<StatusBar />);

      await waitFor(() => {
        expect(mockMythalAPI.tokens.record).toHaveBeenCalledWith(
          160000, undefined, 80.0, 'warning'
        );
      });

      // Test critical level
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 180000, // 90%
      });

      rerender(<StatusBar />);

      await waitFor(() => {
        expect(mockMythalAPI.tokens.record).toHaveBeenCalledWith(
          180000, undefined, 90.0, 'critical'
        );
      });
    });

    it('should update token recording when values change', () => {
      const { rerender } = render(<StatusBar />);

      // Initial call
      expect(mockMythalAPI.tokens.record).toHaveBeenCalledWith(
        50000, undefined, 25.0, 'safe'
      );

      // Change token values
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 100000, // 50%
      });

      rerender(<StatusBar />);

      expect(mockMythalAPI.tokens.record).toHaveBeenCalledWith(
        100000, undefined, 50.0, 'safe'
      );
    });
  });

  describe('Component Layout', () => {
    it('should have correct CSS structure', () => {
      render(<StatusBar />);
      
      const statusBar = screen.getByRole('generic');
      expect(statusBar).toHaveClass(
        'flex', 'items-center', 'justify-between', 
        'px-4', 'py-2', 'bg-gray-800', 'border-t', 
        'border-gray-700', 'text-xs'
      );
    });

    it('should contain left and right sections', () => {
      render(<StatusBar />);
      
      // Left section with token info
      expect(screen.getByText('Context:')).toBeInTheDocument();
      
      // Right section with Claude instances
      expect(screen.getByText('Claude Instances:')).toBeInTheDocument();
    });

    it('should maintain layout with long instance names', async () => {
      mockMythalAPI.claude.status.mockResolvedValue({
        'very-long-instance-name-that-could-break-layout': 'running',
        'another-super-long-instance-name': 'idle'
      });

      render(<StatusBar />);

      await waitFor(() => {
        expect(screen.getByText('Claude Instances:')).toBeInTheDocument();
      });

      // Should still maintain the flex layout
      const statusBar = screen.getByRole('generic');
      expect(statusBar).toHaveClass('flex', 'items-center', 'justify-between');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extremely large token numbers', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 999999999,
        maxTokens: 1000000000,
        starredTokens: 250000000,
        activeTokens: 300000000,
        referenceTokens: 200000000,
        archiveTokens: 249999999
      });

      render(<StatusBar />);
      
      expect(screen.getByText('999,999,999/1,000,000,000 tokens (100.0%)')).toBeInTheDocument();
      expect(screen.getByText('⭐ 250000.0k')).toBeInTheDocument();
    });

    it('should handle division by zero with zero maxTokens', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: 100,
        maxTokens: 0
      });

      render(<StatusBar />);
      
      // Should handle Infinity percentage gracefully
      const tokenText = screen.getByText(/tokens \(/);
      expect(tokenText).toBeInTheDocument();
    });

    it('should handle negative token values', () => {
      mockUseContextStore.mockReturnValue({
        ...defaultContextState,
        totalTokens: -1000,
        maxTokens: 200000,
        starredTokens: -500,
        activeTokens: -300,
        referenceTokens: -100,
        archiveTokens: -100
      });

      render(<StatusBar />);
      
      expect(screen.getByText('-1,000/200,000 tokens (-0.5%)')).toBeInTheDocument();
      expect(screen.getByText('⭐ -0.5k')).toBeInTheDocument();
    });

    it('should handle rapid context store updates', async () => {
      const { rerender } = render(<StatusBar />);

      for (let i = 0; i < 10; i++) {
        mockUseContextStore.mockReturnValue({
          ...defaultContextState,
          totalTokens: 50000 + i * 1000
        });
        rerender(<StatusBar />);
      }

      // Should handle rapid updates without crashing
      expect(screen.getByText(/tokens/)).toBeInTheDocument();
    });

    it('should handle concurrent status updates', async () => {
      mockMythalAPI.claude.status
        .mockResolvedValueOnce({ main: 'running' })
        .mockResolvedValueOnce({ main: 'idle' })
        .mockResolvedValueOnce({ main: 'crashed' });

      render(<StatusBar />);

      // Wait for initial status
      await waitFor(() => {
        expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(1);
      });

      // Trigger multiple updates
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should not cause memory leaks with multiple mounts/unmounts', () => {
      const { unmount: unmount1 } = render(<StatusBar />);
      unmount1();

      const { unmount: unmount2 } = render(<StatusBar />);
      unmount2();

      const { unmount: unmount3 } = render(<StatusBar />);
      unmount3();

      // Should not throw or cause issues
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid timer updates efficiently', () => {
      render(<StatusBar />);

      // Fast forward through many intervals
      for (let i = 0; i < 100; i++) {
        act(() => {
          jest.advanceTimersByTime(5000);
        });
      }

      // Should handle without issues
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(101); // 1 initial + 100 intervals
    });
  });
});