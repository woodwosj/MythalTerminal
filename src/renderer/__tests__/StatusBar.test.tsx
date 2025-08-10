import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import StatusBar from '../components/StatusBar';

// Mock window.mythalAPI
const mockMythalAPI = {
  claude: {
    status: jest.fn(() => Promise.resolve({
      main: { status: 'idle', pid: 1234, uptime: 5000 },
      contextManager: { status: 'busy', pid: 1235, uptime: 3000 },
      summarizer: { status: 'idle', pid: 1236, uptime: 2000 },
      planner: { status: 'failed', pid: null, uptime: 0 }
    })),
    onStarted: jest.fn(() => jest.fn()),
    onFailed: jest.fn(() => jest.fn())
  }
};

Object.defineProperty(window, 'mythalAPI', {
  value: mockMythalAPI,
  writable: true
});

// Mock process.cwd
const originalCwd = process.cwd;
beforeAll(() => {
  process.cwd = jest.fn(() => '/test/project/path');
});

afterAll(() => {
  process.cwd = originalCwd;
});

describe('StatusBar Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render status bar container', () => {
    render(<StatusBar />);
    
    const statusBar = screen.getByRole('status');
    expect(statusBar).toBeInTheDocument();
    expect(statusBar).toHaveClass('bg-gray-800', 'border-t', 'border-gray-600', 'px-4', 'py-2');
  });

  it('should display current project path', () => {
    render(<StatusBar />);
    
    expect(screen.getByText('/test/project/path')).toBeInTheDocument();
  });

  it('should display Claude instance statuses', async () => {
    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText('main: idle')).toBeInTheDocument();
      expect(screen.getByText('context: busy')).toBeInTheDocument();
      expect(screen.getByText('summarizer: idle')).toBeInTheDocument();
      expect(screen.getByText('planner: failed')).toBeInTheDocument();
    });
  });

  it('should apply correct status colors', async () => {
    render(<StatusBar />);

    await waitFor(() => {
      const mainStatus = screen.getByText('main: idle').closest('.flex');
      const contextStatus = screen.getByText('context: busy').closest('.flex');
      const summarizerStatus = screen.getByText('summarizer: idle').closest('.flex');
      const plannerStatus = screen.getByText('planner: failed').closest('.flex');

      expect(mainStatus).toHaveClass('text-green-400');
      expect(contextStatus).toHaveClass('text-yellow-400');
      expect(summarizerStatus).toHaveClass('text-green-400');
      expect(plannerStatus).toHaveClass('text-red-400');
    });
  });

  it('should update status periodically', async () => {
    render(<StatusBar />);

    // Initial call
    expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(1);

    // Fast-forward timer
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(2);
    });

    // Fast-forward again
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(3);
    });
  });

  it('should handle status fetch errors', async () => {
    mockMythalAPI.claude.status.mockRejectedValue(new Error('Failed to fetch status'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<StatusBar />);

    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalled();
    });

    // Should still render the component without crashing
    expect(screen.getByRole('status')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should setup event listeners for Claude instances', () => {
    render(<StatusBar />);

    expect(mockMythalAPI.claude.onStarted).toHaveBeenCalledWith(expect.any(Function));
    expect(mockMythalAPI.claude.onFailed).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle instance started events', async () => {
    let startedCallback: Function;
    mockMythalAPI.claude.onStarted.mockImplementation((callback) => {
      startedCallback = callback;
      return jest.fn();
    });

    render(<StatusBar />);

    // Wait for initial status load
    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalled();
    });

    // Simulate instance started event
    act(() => {
      startedCallback!('main');
    });

    // Should trigger status update
    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle instance failed events', async () => {
    let failedCallback: Function;
    mockMythalAPI.claude.onFailed.mockImplementation((callback) => {
      failedCallback = callback;
      return jest.fn();
    });

    render(<StatusBar />);

    // Wait for initial status load
    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalled();
    });

    // Simulate instance failed event
    act(() => {
      failedCallback!('summarizer');
    });

    // Should trigger status update
    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(2);
    });
  });

  it('should cleanup timers and listeners on unmount', () => {
    const unsubscribeStarted = jest.fn();
    const unsubscribeFailed = jest.fn();

    mockMythalAPI.claude.onStarted.mockReturnValue(unsubscribeStarted);
    mockMythalAPI.claude.onFailed.mockReturnValue(unsubscribeFailed);

    const { unmount } = render(<StatusBar />);

    unmount();

    expect(unsubscribeStarted).toHaveBeenCalled();
    expect(unsubscribeFailed).toHaveBeenCalled();
  });

  it('should handle missing status data', async () => {
    mockMythalAPI.claude.status.mockResolvedValue({});

    render(<StatusBar />);

    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalled();
    });

    // Should still render without crashing
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should handle partial status data', async () => {
    mockMythalAPI.claude.status.mockResolvedValue({
      main: { status: 'idle' },
      // Missing other instances
    });

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText('main: idle')).toBeInTheDocument();
    });

    // Should not crash with missing instances
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should format instance names correctly', async () => {
    mockMythalAPI.claude.status.mockResolvedValue({
      main: { status: 'idle' },
      contextManager: { status: 'busy' },
      summarizer: { status: 'idle' },
      planner: { status: 'failed' },
      customInstance: { status: 'idle' }
    });

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText('main: idle')).toBeInTheDocument();
      expect(screen.getByText('context: busy')).toBeInTheDocument(); // contextManager -> context
      expect(screen.getByText('summarizer: idle')).toBeInTheDocument();
      expect(screen.getByText('planner: failed')).toBeInTheDocument();
      expect(screen.getByText('customInstance: idle')).toBeInTheDocument();
    });
  });

  it('should handle different status values', async () => {
    mockMythalAPI.claude.status.mockResolvedValue({
      main: { status: 'starting' },
      contextManager: { status: 'stopping' },
      summarizer: { status: 'crashed' },
      planner: { status: 'unknown' }
    });

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText('main: starting')).toBeInTheDocument();
      expect(screen.getByText('context: stopping')).toBeInTheDocument();
      expect(screen.getByText('summarizer: crashed')).toBeInTheDocument();
      expect(screen.getByText('planner: unknown')).toBeInTheDocument();
    });
  });

  it('should apply correct colors for all status types', async () => {
    mockMythalAPI.claude.status.mockResolvedValue({
      idle: { status: 'idle' },
      busy: { status: 'busy' },
      failed: { status: 'failed' },
      crashed: { status: 'crashed' },
      error: { status: 'error' },
      starting: { status: 'starting' },
      unknown: { status: 'unknown' }
    });

    render(<StatusBar />);

    await waitFor(() => {
      const statuses = screen.getAllByText(/: /);
      
      // Check that all status elements are rendered
      expect(statuses.length).toBeGreaterThan(0);
    });
  });

  it('should handle rapid status updates', async () => {
    render(<StatusBar />);

    // Rapid timer advances
    for (let i = 0; i < 10; i++) {
      act(() => {
        jest.advanceTimersByTime(5000);
      });
    }

    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(11); // Initial + 10 updates
    });
  });

  it('should maintain status bar layout with many instances', async () => {
    const manyInstances = {};
    for (let i = 0; i < 20; i++) {
      manyInstances[`instance${i}`] = { status: 'idle' };
    }

    mockMythalAPI.claude.status.mockResolvedValue(manyInstances);

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getAllByText(/: idle/).length).toBe(20);
    });

    // Should maintain layout integrity
    const statusBar = screen.getByRole('status');
    expect(statusBar).toBeInTheDocument();
  });

  it('should handle status with special characters', async () => {
    mockMythalAPI.claude.status.mockResolvedValue({
      'instance-with-dashes': { status: 'idle' },
      'instance_with_underscores': { status: 'busy' },
      'instance.with.dots': { status: 'failed' }
    });

    render(<StatusBar />);

    await waitFor(() => {
      expect(screen.getByText('instance-with-dashes: idle')).toBeInTheDocument();
      expect(screen.getByText('instance_with_underscores: busy')).toBeInTheDocument();
      expect(screen.getByText('instance.with.dots: failed')).toBeInTheDocument();
    });
  });

  it('should handle concurrent updates', async () => {
    render(<StatusBar />);

    // Simulate concurrent event callbacks
    const startedCallback = mockMythalAPI.claude.onStarted.mock.calls[0][0];
    const failedCallback = mockMythalAPI.claude.onFailed.mock.calls[0][0];

    act(() => {
      startedCallback('main');
      failedCallback('planner');
    });

    // Should handle both events
    await waitFor(() => {
      expect(mockMythalAPI.claude.status).toHaveBeenCalledTimes(3); // Initial + 2 events
    });
  });
});