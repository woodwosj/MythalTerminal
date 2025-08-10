import { renderHook, act } from '@testing-library/react';
import { useTerminalStore } from '../stores/terminalStore';

describe('TerminalStore Tests', () => {
  beforeEach(() => {
    // Reset the store before each test
    useTerminalStore.setState({
      terminals: {},
      activeTerminal: null
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useTerminalStore());

    expect(result.current.terminals).toEqual({});
    expect(result.current.activeTerminal).toBeNull();
  });

  it('should add a terminal', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    expect(result.current.terminals['terminal-1']).toBeDefined();
    expect(result.current.terminals['terminal-1'].id).toBe('terminal-1');
    expect(result.current.terminals['terminal-1'].isConnected).toBe(false);
    expect(result.current.terminals['terminal-1'].output).toBe('');
    expect(result.current.activeTerminal).toBe('terminal-1');
  });

  it('should add multiple terminals', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.addTerminal('terminal-2');
      result.current.addTerminal('terminal-3');
    });

    expect(Object.keys(result.current.terminals)).toHaveLength(3);
    expect(result.current.terminals['terminal-1']).toBeDefined();
    expect(result.current.terminals['terminal-2']).toBeDefined();
    expect(result.current.terminals['terminal-3']).toBeDefined();
    expect(result.current.activeTerminal).toBe('terminal-3'); // Last added becomes active
  });

  it('should remove a terminal', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.addTerminal('terminal-2');
    });

    expect(Object.keys(result.current.terminals)).toHaveLength(2);
    expect(result.current.activeTerminal).toBe('terminal-2');

    act(() => {
      result.current.removeTerminal('terminal-1');
    });

    expect(Object.keys(result.current.terminals)).toHaveLength(1);
    expect(result.current.terminals['terminal-1']).toBeUndefined();
    expect(result.current.terminals['terminal-2']).toBeDefined();
    expect(result.current.activeTerminal).toBe('terminal-2'); // Should remain unchanged
  });

  it('should update active terminal when removing active terminal', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.addTerminal('terminal-2');
      result.current.setActiveTerminal('terminal-1');
    });

    expect(result.current.activeTerminal).toBe('terminal-1');

    act(() => {
      result.current.removeTerminal('terminal-1');
    });

    expect(result.current.activeTerminal).toBe('terminal-2');
  });

  it('should set active terminal to null when removing last terminal', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    expect(result.current.activeTerminal).toBe('terminal-1');

    act(() => {
      result.current.removeTerminal('terminal-1');
    });

    expect(result.current.activeTerminal).toBeNull();
    expect(Object.keys(result.current.terminals)).toHaveLength(0);
  });

  it('should set active terminal', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.addTerminal('terminal-2');
      result.current.setActiveTerminal('terminal-1');
    });

    expect(result.current.activeTerminal).toBe('terminal-1');

    act(() => {
      result.current.setActiveTerminal('terminal-2');
    });

    expect(result.current.activeTerminal).toBe('terminal-2');
  });

  it('should ignore setting active terminal that does not exist', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.setActiveTerminal('nonexistent');
    });

    expect(result.current.activeTerminal).toBe('terminal-1'); // Should remain unchanged
  });

  it('should update terminal connection status', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    expect(result.current.terminals['terminal-1'].isConnected).toBe(false);

    act(() => {
      result.current.updateTerminal('terminal-1', { isConnected: true });
    });

    expect(result.current.terminals['terminal-1'].isConnected).toBe(true);
  });

  it('should update terminal output', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    expect(result.current.terminals['terminal-1'].output).toBe('');

    act(() => {
      result.current.updateTerminal('terminal-1', { output: 'Hello World' });
    });

    expect(result.current.terminals['terminal-1'].output).toBe('Hello World');
  });

  it('should append to terminal output', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.updateTerminal('terminal-1', { output: 'First line\n' });
    });

    expect(result.current.terminals['terminal-1'].output).toBe('First line\n');

    act(() => {
      result.current.appendOutput('terminal-1', 'Second line\n');
    });

    expect(result.current.terminals['terminal-1'].output).toBe('First line\nSecond line\n');
  });

  it('should append multiple outputs', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    act(() => {
      result.current.appendOutput('terminal-1', 'Line 1\n');
      result.current.appendOutput('terminal-1', 'Line 2\n');
      result.current.appendOutput('terminal-1', 'Line 3\n');
    });

    expect(result.current.terminals['terminal-1'].output).toBe('Line 1\nLine 2\nLine 3\n');
  });

  it('should clear terminal output', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.appendOutput('terminal-1', 'Some output\n');
    });

    expect(result.current.terminals['terminal-1'].output).toBe('Some output\n');

    act(() => {
      result.current.clearOutput('terminal-1');
    });

    expect(result.current.terminals['terminal-1'].output).toBe('');
  });

  it('should ignore operations on nonexistent terminals', () => {
    const { result } = renderHook(() => useTerminalStore());

    // These operations should not throw errors
    act(() => {
      result.current.updateTerminal('nonexistent', { isConnected: true });
      result.current.appendOutput('nonexistent', 'output');
      result.current.clearOutput('nonexistent');
    });

    expect(Object.keys(result.current.terminals)).toHaveLength(0);
  });

  it('should handle partial updates correctly', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.updateTerminal('terminal-1', { output: 'initial', isConnected: false });
    });

    const initialTerminal = result.current.terminals['terminal-1'];

    act(() => {
      result.current.updateTerminal('terminal-1', { isConnected: true });
    });

    const updatedTerminal = result.current.terminals['terminal-1'];
    expect(updatedTerminal.isConnected).toBe(true);
    expect(updatedTerminal.output).toBe('initial'); // Should remain unchanged
    expect(updatedTerminal.id).toBe(initialTerminal.id); // Should remain unchanged
  });

  it('should maintain terminal references correctly', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    const terminal1 = result.current.terminals['terminal-1'];

    act(() => {
      result.current.addTerminal('terminal-2');
    });

    const terminal1After = result.current.terminals['terminal-1'];
    
    // Terminal 1 should be the same reference after adding terminal 2
    expect(terminal1).toBe(terminal1After);
  });

  it('should handle concurrent operations', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.addTerminal('terminal-2');
      
      // Simulate concurrent operations
      result.current.updateTerminal('terminal-1', { isConnected: true });
      result.current.appendOutput('terminal-1', 'Output 1\n');
      result.current.updateTerminal('terminal-2', { isConnected: false });
      result.current.appendOutput('terminal-2', 'Output 2\n');
    });

    expect(result.current.terminals['terminal-1'].isConnected).toBe(true);
    expect(result.current.terminals['terminal-1'].output).toBe('Output 1\n');
    expect(result.current.terminals['terminal-2'].isConnected).toBe(false);
    expect(result.current.terminals['terminal-2'].output).toBe('Output 2\n');
  });

  it('should handle terminal IDs with special characters', () => {
    const { result } = renderHook(() => useTerminalStore());

    const specialIds = [
      'terminal-with-dashes',
      'terminal_with_underscores',
      'terminal.with.dots',
      'terminal123',
      'terminal@special'
    ];

    act(() => {
      specialIds.forEach(id => {
        result.current.addTerminal(id);
      });
    });

    specialIds.forEach(id => {
      expect(result.current.terminals[id]).toBeDefined();
      expect(result.current.terminals[id].id).toBe(id);
    });
  });

  it('should handle empty terminal ID', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('');
    });

    expect(result.current.terminals['']).toBeDefined();
    expect(result.current.terminals[''].id).toBe('');
    expect(result.current.activeTerminal).toBe('');
  });

  it('should not duplicate terminals with same ID', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.updateTerminal('terminal-1', { output: 'First content' });
    });

    const firstTerminal = result.current.terminals['terminal-1'];

    act(() => {
      result.current.addTerminal('terminal-1'); // Try to add same ID again
    });

    // Should overwrite the existing terminal
    expect(Object.keys(result.current.terminals)).toHaveLength(1);
    expect(result.current.terminals['terminal-1'].output).toBe(''); // New terminal has empty output
    expect(result.current.terminals['terminal-1']).not.toBe(firstTerminal); // Different object
  });

  it('should handle large output efficiently', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal('terminal-1');
    });

    const largeOutput = 'x'.repeat(10000);

    act(() => {
      result.current.appendOutput('terminal-1', largeOutput);
    });

    expect(result.current.terminals['terminal-1'].output).toBe(largeOutput);
    expect(result.current.terminals['terminal-1'].output.length).toBe(10000);
  });

  it('should maintain state consistency across multiple operations', () => {
    const { result } = renderHook(() => useTerminalStore());

    // Complex sequence of operations
    act(() => {
      result.current.addTerminal('terminal-1');
      result.current.addTerminal('terminal-2');
      result.current.setActiveTerminal('terminal-1');
      result.current.updateTerminal('terminal-1', { isConnected: true });
      result.current.appendOutput('terminal-1', 'Output for terminal 1\n');
      result.current.updateTerminal('terminal-2', { isConnected: false });
      result.current.appendOutput('terminal-2', 'Output for terminal 2\n');
      result.current.setActiveTerminal('terminal-2');
      result.current.removeTerminal('terminal-1');
    });

    // Verify final state
    expect(Object.keys(result.current.terminals)).toHaveLength(1);
    expect(result.current.terminals['terminal-2']).toBeDefined();
    expect(result.current.terminals['terminal-2'].isConnected).toBe(false);
    expect(result.current.terminals['terminal-2'].output).toBe('Output for terminal 2\n');
    expect(result.current.activeTerminal).toBe('terminal-2');
    expect(result.current.terminals['terminal-1']).toBeUndefined();
  });
});