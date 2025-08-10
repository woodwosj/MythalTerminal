import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Mock child components
jest.mock('../components/Terminal', () => {
  return function MockTerminal() {
    return <div data-testid="terminal">Terminal Component</div>;
  };
});

jest.mock('../components/ContextManager', () => {
  return function MockContextManager({ projectPath }: { projectPath: string }) {
    return <div data-testid="context-manager">Context Manager: {projectPath}</div>;
  };
});

jest.mock('../components/StatusBar', () => {
  return function MockStatusBar() {
    return <div data-testid="status-bar">Status Bar</div>;
  };
});

// Mock window.mythalAPI
const mockMythalAPI = {
  claude: {
    startAll: jest.fn(() => Promise.resolve({ success: true }))
  },
  terminal: {
    create: jest.fn(() => Promise.resolve({ success: true })),
    write: jest.fn(() => Promise.resolve({ success: true })),
    resize: jest.fn(() => Promise.resolve({ success: true })),
    destroy: jest.fn(() => Promise.resolve({ success: true })),
    onOutput: jest.fn(() => jest.fn()),
    onExit: jest.fn(() => jest.fn())
  }
};

Object.defineProperty(window, 'mythalAPI', {
  value: mockMythalAPI,
  writable: true
});

describe('App Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render main layout components', () => {
    render(<App />);

    expect(screen.getByTestId('terminal')).toBeInTheDocument();
    expect(screen.getByTestId('context-manager')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('should have correct layout structure', () => {
    const { container } = render(<App />);

    // Check main container classes
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('flex', 'flex-col', 'h-screen', 'bg-gray-900', 'text-white');
  });

  it('should render header with title and controls', () => {
    render(<App />);

    expect(screen.getByText('Mythal Terminal')).toBeInTheDocument();
    expect(screen.getByText('Start All Claude Instances')).toBeInTheDocument();
  });

  it('should have project path input with default value', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Project path...');
  });

  it('should handle project path changes', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    fireEvent.change(input, { target: { value: '/new/project/path' } });

    expect(screen.getByDisplayValue('/new/project/path')).toBeInTheDocument();
    expect(screen.getByText('Context Manager: /new/project/path')).toBeInTheDocument();
  });

  it('should handle Start All Claude Instances button click', async () => {
    render(<App />);

    const startButton = screen.getByText('Start All Claude Instances');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockMythalAPI.claude.startAll).toHaveBeenCalled();
    });
  });

  it('should handle Start All Claude Instances failure', async () => {
    mockMythalAPI.claude.startAll.mockRejectedValue(new Error('Failed to start'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<App />);

    const startButton = screen.getByText('Start All Claude Instances');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockMythalAPI.claude.startAll).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should have correct responsive layout', () => {
    render(<App />);

    // Check that the main content area uses flex layout
    const mainContent = screen.getByTestId('terminal').closest('.flex-1');
    expect(mainContent).toBeInTheDocument();
  });

  it('should pass correct props to ContextManager', () => {
    render(<App />);

    // Default project path should be passed
    expect(screen.getByText(`Context Manager: ${process.cwd()}`)).toBeInTheDocument();
  });

  it('should update ContextManager when project path changes', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    fireEvent.change(input, { target: { value: '/updated/path' } });

    expect(screen.getByText('Context Manager: /updated/path')).toBeInTheDocument();
  });

  it('should maintain state consistency', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    
    // Change path multiple times
    fireEvent.change(input, { target: { value: '/path1' } });
    expect(screen.getByDisplayValue('/path1')).toBeInTheDocument();
    
    fireEvent.change(input, { target: { value: '/path2' } });
    expect(screen.getByDisplayValue('/path2')).toBeInTheDocument();
    
    fireEvent.change(input, { target: { value: '/path3' } });
    expect(screen.getByDisplayValue('/path3')).toBeInTheDocument();
    
    // Context manager should reflect the final path
    expect(screen.getByText('Context Manager: /path3')).toBeInTheDocument();
  });

  it('should handle empty project path', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    fireEvent.change(input, { target: { value: '' } });

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.getByText('Context Manager: ')).toBeInTheDocument();
  });

  it('should handle special characters in project path', () => {
    render(<App />);

    const specialPath = '/path/with spaces/and-special_chars.test';
    const input = screen.getByDisplayValue(process.cwd());
    fireEvent.change(input, { target: { value: specialPath } });

    expect(screen.getByDisplayValue(specialPath)).toBeInTheDocument();
    expect(screen.getByText(`Context Manager: ${specialPath}`)).toBeInTheDocument();
  });

  it('should maintain button state during async operations', async () => {
    // Make the API call take some time
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    mockMythalAPI.claude.startAll.mockReturnValue(pendingPromise);

    render(<App />);

    const startButton = screen.getByText('Start All Claude Instances');
    fireEvent.click(startButton);

    // Button should still be clickable (no loading state implemented)
    expect(startButton).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({ success: true });
    await waitFor(() => {
      expect(mockMythalAPI.claude.startAll).toHaveBeenCalled();
    });
  });

  it('should have accessible form elements', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('placeholder', 'Project path...');

    const button = screen.getByText('Start All Claude Instances');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('should handle keyboard events on input', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    
    // Test Enter key (should not cause any errors)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(input).toBeInTheDocument();
    
    // Test Escape key
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(input).toBeInTheDocument();
  });

  it('should handle rapid state changes', () => {
    render(<App />);

    const input = screen.getByDisplayValue(process.cwd());
    
    // Rapid changes
    for (let i = 0; i < 10; i++) {
      fireEvent.change(input, { target: { value: `/path${i}` } });
    }
    
    // Should handle the final state correctly
    expect(screen.getByDisplayValue('/path9')).toBeInTheDocument();
    expect(screen.getByText('Context Manager: /path9')).toBeInTheDocument();
  });

  it('should not crash with undefined mythalAPI', () => {
    // Temporarily remove mythalAPI
    const originalAPI = window.mythalAPI;
    delete (window as any).mythalAPI;

    expect(() => render(<App />)).not.toThrow();

    // Restore API
    window.mythalAPI = originalAPI;
  });

  it('should handle component unmounting', () => {
    const { unmount } = render(<App />);
    
    // Should not throw errors on unmount
    expect(() => unmount()).not.toThrow();
  });

  it('should maintain layout integrity with long project paths', () => {
    render(<App />);

    const veryLongPath = '/very/long/project/path/that/might/cause/layout/issues/in/the/interface/' + 'x'.repeat(100);
    const input = screen.getByDisplayValue(process.cwd());
    fireEvent.change(input, { target: { value: veryLongPath } });

    expect(screen.getByDisplayValue(veryLongPath)).toBeInTheDocument();
    expect(screen.getByText(`Context Manager: ${veryLongPath}`)).toBeInTheDocument();
  });
});