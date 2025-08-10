/**
 * Enhanced comprehensive tests for Terminal component
 * Additional edge cases and scenarios to maximize coverage
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Terminal from '../components/Terminal';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';

// Mock xterm and addons
jest.mock('xterm', () => ({
  Terminal: jest.fn()
}));

jest.mock('xterm-addon-fit', () => ({
  FitAddon: jest.fn()
}));

jest.mock('xterm-addon-search', () => ({
  SearchAddon: jest.fn()
}));

jest.mock('xterm-addon-web-links', () => ({
  WebLinksAddon: jest.fn()
}));

jest.mock('xterm/css/xterm.css', () => ({}));

describe('Terminal Component Enhanced Tests', () => {
  let mockXTerm: any;
  let mockFitAddon: any;
  let mockSearchAddon: any;
  let mockWebLinksAddon: any;
  let mockMythalAPI: any;
  let originalConsoleError: typeof console.error;
  let originalDateNow: typeof Date.now;

  beforeAll(() => {
    originalConsoleError = console.error;
    originalDateNow = Date.now;
  });

  afterAll(() => {
    console.error = originalConsoleError;
    Date.now = originalDateNow;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    
    // Mock Date.now to have predictable terminal IDs
    let mockTime = 1640000000000;
    Date.now = jest.fn(() => mockTime++);

    // Mock XTerm instance with comprehensive methods
    mockXTerm = {
      open: jest.fn(),
      write: jest.fn(),
      onData: jest.fn(),
      onResize: jest.fn(),
      dispose: jest.fn(),
      getSelection: jest.fn(() => 'selected text'),
      paste: jest.fn(),
      loadAddon: jest.fn(),
      cols: 80,
      rows: 24
    };

    // Mock addons
    mockFitAddon = {
      fit: jest.fn()
    };

    mockSearchAddon = {
      findNext: jest.fn(),
      findPrevious: jest.fn()
    };

    mockWebLinksAddon = {};

    // Mock constructors
    (XTerm as jest.Mock).mockImplementation(() => mockXTerm);
    (FitAddon as jest.Mock).mockImplementation(() => mockFitAddon);
    (SearchAddon as jest.Mock).mockImplementation(() => mockSearchAddon);
    (WebLinksAddon as jest.Mock).mockImplementation(() => mockWebLinksAddon);

    // Mock mythalAPI
    mockMythalAPI = {
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
      configurable: true
    });

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn(() => Promise.resolve()),
        readText: jest.fn(() => Promise.resolve('clipboard text'))
      },
      configurable: true
    });

    // Mock window.prompt
    Object.defineProperty(window, 'prompt', {
      value: jest.fn(() => 'search term'),
      configurable: true
    });

    // Mock event listeners
    global.addEventListener = jest.fn();
    global.removeEventListener = jest.fn();
    document.addEventListener = jest.fn();
    document.removeEventListener = jest.fn();
    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
  });

  describe('Terminal ID Generation and Consistency', () => {
    it('should generate unique terminal IDs based on timestamp', () => {
      const { unmount: unmount1 } = render(<Terminal />);
      const firstId = mockMythalAPI.terminal.create.mock.calls[0][0];
      unmount1();

      jest.clearAllMocks();
      const { unmount: unmount2 } = render(<Terminal />);
      const secondId = mockMythalAPI.terminal.create.mock.calls[0][0];
      unmount2();

      expect(firstId).toBe('terminal-1640000000000');
      expect(secondId).toBe('terminal-1640000000001');
      expect(firstId).not.toBe(secondId);
    });

    it('should use consistent terminal ID throughout component lifecycle', async () => {
      render(<Terminal />);

      const terminalId = mockMythalAPI.terminal.create.mock.calls[0][0];

      // Simulate user input
      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const onDataCallback = mockXTerm.onData.mock.calls[0][0];
      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];

      // Simulate ready state
      act(() => {
        mockMythalAPI.terminal.create.mock.results[0].value.then(() => {});
      });

      await waitFor(() => {
        onDataCallback('test input');
        onResizeCallback({ cols: 100, rows: 30 });
      });

      expect(mockMythalAPI.terminal.write).toHaveBeenCalledWith(terminalId, 'test input');
      expect(mockMythalAPI.terminal.resize).toHaveBeenCalledWith(terminalId, 100, 30);
    });

    it('should maintain terminal ID consistency during event handling', async () => {
      render(<Terminal />);

      const terminalId = mockMythalAPI.terminal.create.mock.calls[0][0];

      // Check output listener
      expect(mockMythalAPI.terminal.onOutput).toHaveBeenCalledWith(terminalId, expect.any(Function));

      // Check exit listener
      expect(mockMythalAPI.terminal.onExit).toHaveBeenCalledWith(terminalId, expect.any(Function));
    });
  });

  describe('XTerm Configuration and Setup', () => {
    it('should configure XTerm with all theme colors', () => {
      render(<Terminal />);

      const config = (XTerm as jest.Mock).mock.calls[0][0];
      
      expect(config.theme).toEqual({
        background: '#1e1e1e',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bfbfbf',
        brightBlack: '#4d4d4d',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#7b8dbd',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#e6e6e6'
      });
    });

    it('should configure XTerm with all options', () => {
      render(<Terminal />);

      const config = (XTerm as jest.Mock).mock.calls[0][0];
      
      expect(config).toEqual({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: expect.any(Object),
        allowTransparency: true,
        scrollback: 10000
      });
    });

    it('should load addons in correct order', () => {
      render(<Terminal />);

      expect(mockXTerm.loadAddon).toHaveBeenCalledTimes(3);
      expect(mockXTerm.loadAddon).toHaveBeenNthCalledWith(1, mockFitAddon);
      expect(mockXTerm.loadAddon).toHaveBeenNthCalledWith(2, mockSearchAddon);
      expect(mockXTerm.loadAddon).toHaveBeenNthCalledWith(3, mockWebLinksAddon);
    });

    it('should open terminal with DOM element', () => {
      render(<Terminal />);

      expect(mockXTerm.open).toHaveBeenCalledWith(expect.any(HTMLElement));
    });

    it('should fit terminal after opening', () => {
      render(<Terminal />);

      expect(mockFitAddon.fit).toHaveBeenCalled();
    });
  });

  describe('Advanced Event Handling', () => {
    it('should handle complex output data with special characters', () => {
      render(<Terminal />);

      const outputCallback = mockMythalAPI.terminal.onOutput.mock.calls[0][1];

      const testData = [
        'simple output',
        'output\nwith\nnewlines',
        'output\twith\ttabs',
        'output with unicode: 你好 🚀 ñáéíóú',
        'output with ANSI codes: \u001b[31mred text\u001b[0m',
        'output with special chars: !@#$%^&*()[]{}|\\:";\'<>?,./',
        '\r\n\r\n\r\n', // multiple carriage returns and newlines
        '', // empty output
        ' '.repeat(1000), // very long spaces
        'a'.repeat(10000) // very long output
      ];

      testData.forEach(data => {
        mockXTerm.write.mockClear();
        outputCallback(data);
        expect(mockXTerm.write).toHaveBeenCalledWith(data);
      });
    });

    it('should handle various exit codes and signals', () => {
      render(<Terminal />);

      const exitCallback = mockMythalAPI.terminal.onExit.mock.calls[0][1];

      const exitTestCases = [
        { exitCode: 0, signal: null, expected: '\r\n[Process exited with code 0]\r\n' },
        { exitCode: 1, signal: null, expected: '\r\n[Process exited with code 1]\r\n' },
        { exitCode: 127, signal: null, expected: '\r\n[Process exited with code 127]\r\n' },
        { exitCode: -1, signal: 'SIGKILL', expected: '\r\n[Process exited with code -1]\r\n' },
        { exitCode: 130, signal: 'SIGINT', expected: '\r\n[Process exited with code 130]\r\n' },
        { exitCode: undefined, signal: 'SIGTERM', expected: '\r\n[Process exited with code undefined]\r\n' },
        { exitCode: null, signal: null, expected: '\r\n[Process exited with code null]\r\n' }
      ];

      exitTestCases.forEach(({ exitCode, signal, expected }) => {
        mockXTerm.write.mockClear();
        exitCallback({ exitCode, signal });
        expect(mockXTerm.write).toHaveBeenCalledWith(expected);
      });
    });

    it('should handle user input with various data types', async () => {
      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const onDataCallback = mockXTerm.onData.mock.calls[0][0];

      const inputTestCases = [
        'simple command',
        'command with spaces and special chars !@#$%^&*()',
        'command\nwith\nnewlines',
        'command\twith\ttabs',
        'unicode command: 你好 🌟',
        'very long command ' + 'x'.repeat(1000),
        '', // empty input
        '\r', // carriage return
        '\n', // newline
        '\u0003', // Ctrl+C
        '\u0004', // Ctrl+D
        '\u001b', // Escape
        String.fromCharCode(127) // DEL
      ];

      for (const input of inputTestCases) {
        mockMythalAPI.terminal.write.mockClear();
        onDataCallback(input);
        expect(mockMythalAPI.terminal.write).toHaveBeenCalledWith(expect.stringMatching(/^terminal-\d+$/), input);
      }
    });

    it('should handle resize with various dimensions', async () => {
      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];

      const resizeTestCases = [
        { cols: 80, rows: 24 },  // standard
        { cols: 1, rows: 1 },    // minimum
        { cols: 300, rows: 100 }, // large
        { cols: 0, rows: 0 },    // edge case
        { cols: -1, rows: -1 },  // negative (edge case)
        { cols: 1.5, rows: 2.7 }, // non-integers
        { cols: null, rows: null }, // null values
        { cols: undefined, rows: undefined } // undefined values
      ];

      for (const { cols, rows } of resizeTestCases) {
        mockMythalAPI.terminal.resize.mockClear();
        onResizeCallback({ cols, rows });
        expect(mockMythalAPI.terminal.resize).toHaveBeenCalledWith(
          expect.stringMatching(/^terminal-\d+$/), 
          cols, 
          rows
        );
      }
    });
  });

  describe('Keyboard Shortcuts Edge Cases', () => {
    it('should handle search with various search terms', () => {
      const searchTerms = [
        'simple search',
        'search with spaces',
        'search-with-dashes',
        'search_with_underscores',
        'search.with.dots',
        'UPPERCASE SEARCH',
        'MiXeD cAsE sEaRcH',
        '123456789',
        '!@#$%^&*()',
        'unicode: 你好 🚀',
        '', // empty string
        ' ', // single space
        '  multiple  spaces  ',
        '\n', // newline
        '\t', // tab
        'very long search term that goes on and on and on and on'
      ];

      searchTerms.forEach(term => {
        (window.prompt as jest.Mock).mockReturnValue(term);
        
        render(<Terminal />);

        const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === 'keydown'
        )[1];

        const event = new KeyboardEvent('keydown', {
          key: 'F',
          ctrlKey: true,
          shiftKey: true
        });

        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn()
        });

        keydownHandler(event);

        if (term) {
          expect(mockSearchAddon.findNext).toHaveBeenCalledWith(term);
        } else {
          expect(mockSearchAddon.findNext).not.toHaveBeenCalled();
        }

        // Clean up for next iteration
        jest.clearAllMocks();
      });
    });

    it('should handle copy with various selection states', async () => {
      const selectionStates = [
        'normal selection',
        'selection with newlines\nand\nmore\nlines',
        'selection\twith\ttabs',
        'unicode selection: 你好 🌟 ñáéíóú',
        'very long selection ' + 'x'.repeat(1000),
        '', // empty selection
        ' ', // single space
        '   ', // multiple spaces
        null, // null selection
        undefined // undefined selection
      ];

      for (const selection of selectionStates) {
        mockXTerm.getSelection.mockReturnValue(selection);
        
        render(<Terminal />);

        const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === 'keydown'
        )[1];

        const event = new KeyboardEvent('keydown', {
          key: 'C',
          ctrlKey: true,
          shiftKey: true
        });

        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn()
        });

        keydownHandler(event);

        if (selection) {
          await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(selection);
          });
        } else {
          expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
        }

        // Clean up for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle paste with various clipboard content', async () => {
      const clipboardContents = [
        'simple paste',
        'paste\nwith\nnewlines',
        'paste\twith\ttabs',
        'unicode paste: 你好 🚀 ñáéíóú',
        'paste with special chars: !@#$%^&*()[]{}|\\:";\'<>?,./',
        'very long paste ' + 'x'.repeat(1000),
        '', // empty clipboard
        ' ', // single space
        '   ', // multiple spaces
        '\r\n\r\n\r\n' // multiple line endings
      ];

      for (const content of clipboardContents) {
        (navigator.clipboard.readText as jest.Mock).mockResolvedValue(content);
        
        render(<Terminal />);

        const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === 'keydown'
        )[1];

        const event = new KeyboardEvent('keydown', {
          key: 'V',
          ctrlKey: true,
          shiftKey: true
        });

        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn()
        });

        await act(async () => {
          keydownHandler(event);
        });

        await waitFor(() => {
          expect(mockXTerm.paste).toHaveBeenCalledWith(content);
        });

        // Clean up for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle all possible key combinations', () => {
      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      // Test all possible key combinations with Ctrl+Shift
      const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
                    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
                    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
                    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
                    'Tab', 'Enter', 'Escape', 'Space', 'Backspace', 'Delete',
                    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                    'Home', 'End', 'PageUp', 'PageDown', 'Insert'];

      keys.forEach(key => {
        const event = new KeyboardEvent('keydown', {
          key,
          ctrlKey: true,
          shiftKey: true
        });

        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn()
        });

        // Reset mocks
        mockSearchAddon.findNext.mockClear();
        (navigator.clipboard.writeText as jest.Mock).mockClear();
        (navigator.clipboard.readText as jest.Mock).mockClear();

        keydownHandler(event);

        // Only F, C, and V should be handled
        if (key === 'F') {
          expect(event.preventDefault).toHaveBeenCalled();
        } else if (key === 'C') {
          expect(event.preventDefault).toHaveBeenCalled();
        } else if (key === 'V') {
          expect(event.preventDefault).toHaveBeenCalled();
        } else {
          expect(event.preventDefault).not.toHaveBeenCalled();
        }
      });
    });

    it('should handle modifier key combinations', () => {
      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      const modifierCombinations = [
        { key: 'F', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
        { key: 'F', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false },
        { key: 'F', ctrlKey: true, shiftKey: true, altKey: true, metaKey: false },
        { key: 'F', ctrlKey: true, shiftKey: true, altKey: false, metaKey: true },
        { key: 'F', ctrlKey: false, shiftKey: false, altKey: true, metaKey: false },
        { key: 'F', ctrlKey: false, shiftKey: false, altKey: false, metaKey: true },
        { key: 'C', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
        { key: 'V', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }
      ];

      modifierCombinations.forEach(({ key, ctrlKey, shiftKey, altKey, metaKey }) => {
        const event = new KeyboardEvent('keydown', {
          key,
          ctrlKey,
          shiftKey,
          altKey,
          metaKey
        });

        Object.defineProperty(event, 'preventDefault', {
          value: jest.fn()
        });

        keydownHandler(event);

        // Should only handle Ctrl+Shift combinations
        if (ctrlKey && shiftKey && (key === 'F' || key === 'C' || key === 'V')) {
          expect(event.preventDefault).toHaveBeenCalled();
        } else {
          expect(event.preventDefault).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('Window Resize Edge Cases', () => {
    it('should handle rapid resize events', () => {
      render(<Terminal />);

      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'resize'
      )[1];

      // Simulate rapid resize events
      for (let i = 0; i < 100; i++) {
        resizeHandler();
      }

      expect(mockFitAddon.fit).toHaveBeenCalledTimes(101); // 1 initial + 100 resize events
    });

    it('should handle resize when fitAddon is null or undefined', () => {
      render(<Terminal />);

      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'resize'
      )[1];

      // Simulate fitAddon being null/undefined
      mockFitAddon.fit.mockImplementation(() => {
        throw new Error('fitAddon is null');
      });

      // Should not crash
      expect(() => resizeHandler()).not.toThrow();
    });

    it('should handle resize during component unmounting', () => {
      const { unmount } = render(<Terminal />);

      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'resize'
      )[1];

      unmount();

      // Resize after unmount should not crash
      expect(() => resizeHandler()).not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle XTerm constructor failure', () => {
      (XTerm as jest.Mock).mockImplementation(() => {
        throw new Error('XTerm creation failed');
      });

      expect(() => render(<Terminal />)).not.toThrow();
    });

    it('should handle addon loading failures', () => {
      mockXTerm.loadAddon.mockImplementation(() => {
        throw new Error('Addon loading failed');
      });

      expect(() => render(<Terminal />)).not.toThrow();
    });

    it('should handle terminal.open failure', () => {
      mockXTerm.open.mockImplementation(() => {
        throw new Error('Terminal open failed');
      });

      expect(() => render(<Terminal />)).not.toThrow();
    });

    it('should handle fitAddon.fit failure', () => {
      mockFitAddon.fit.mockImplementation(() => {
        throw new Error('Fit failed');
      });

      expect(() => render(<Terminal />)).not.toThrow();
    });

    it('should handle API failures gracefully', async () => {
      mockMythalAPI.terminal.create.mockRejectedValue(new Error('Create failed'));
      mockMythalAPI.terminal.write.mockRejectedValue(new Error('Write failed'));
      mockMythalAPI.terminal.resize.mockRejectedValue(new Error('Resize failed'));
      mockMythalAPI.terminal.destroy.mockRejectedValue(new Error('Destroy failed'));

      const { unmount } = render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const onDataCallback = mockXTerm.onData.mock.calls[0][0];
      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];

      // These should not throw
      expect(() => onDataCallback('test')).not.toThrow();
      expect(() => onResizeCallback({ cols: 80, rows: 24 })).not.toThrow();
      expect(() => unmount()).not.toThrow();
    });

    it('should handle clipboard API not available', async () => {
      // Remove clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });

      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      const copyEvent = new KeyboardEvent('keydown', {
        key: 'C',
        ctrlKey: true,
        shiftKey: true
      });

      Object.defineProperty(copyEvent, 'preventDefault', {
        value: jest.fn()
      });

      const pasteEvent = new KeyboardEvent('keydown', {
        key: 'V',
        ctrlKey: true,
        shiftKey: true
      });

      Object.defineProperty(pasteEvent, 'preventDefault', {
        value: jest.fn()
      });

      // Should not throw
      expect(() => keydownHandler(copyEvent)).not.toThrow();
      expect(() => keydownHandler(pasteEvent)).not.toThrow();
    });

    it('should handle prompt API not available', () => {
      Object.defineProperty(window, 'prompt', {
        value: undefined,
        configurable: true
      });

      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      const event = new KeyboardEvent('keydown', {
        key: 'F',
        ctrlKey: true,
        shiftKey: true
      });

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn()
      });

      expect(() => keydownHandler(event)).not.toThrow();
    });

    it('should handle missing DOM reference', () => {
      const { container } = render(<div />);
      
      // Remove all children
      container.innerHTML = '';

      expect(() => render(<Terminal />)).not.toThrow();
    });
  });

  describe('Memory Management and Performance', () => {
    it('should properly clean up all event listeners', () => {
      const { unmount } = render(<Terminal />);

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should dispose XTerm instance on unmount', () => {
      const { unmount } = render(<Terminal />);

      unmount();

      expect(mockXTerm.dispose).toHaveBeenCalled();
    });

    it('should unsubscribe from API events', () => {
      const mockOutputUnsubscribe = jest.fn();
      const mockExitUnsubscribe = jest.fn();

      mockMythalAPI.terminal.onOutput.mockReturnValue(mockOutputUnsubscribe);
      mockMythalAPI.terminal.onExit.mockReturnValue(mockExitUnsubscribe);

      const { unmount } = render(<Terminal />);

      unmount();

      expect(mockOutputUnsubscribe).toHaveBeenCalled();
      expect(mockExitUnsubscribe).toHaveBeenCalled();
    });

    it('should destroy terminal via API on unmount', () => {
      const { unmount } = render(<Terminal />);

      unmount();

      expect(mockMythalAPI.terminal.destroy).toHaveBeenCalledWith(
        expect.stringMatching(/^terminal-\d+$/)
      );
    });

    it('should handle multiple rapid mount/unmount cycles', () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<Terminal />);
        unmount();
      }

      expect(mockXTerm.dispose).toHaveBeenCalledTimes(10);
      expect(mockMythalAPI.terminal.destroy).toHaveBeenCalledTimes(10);
    });

    it('should not create duplicate event listeners on re-render', () => {
      const { rerender } = render(<Terminal />);

      const initialEventListenerCount = (document.addEventListener as jest.Mock).mock.calls.length;

      rerender(<Terminal />);

      // Should not add more event listeners
      expect((document.addEventListener as jest.Mock).mock.calls.length).toBe(initialEventListenerCount);
    });
  });

  describe('Component State Management', () => {
    it('should handle isReady state transitions', async () => {
      render(<Terminal />);

      // Initially not ready
      const initialOnDataCallback = mockXTerm.onData.mock.calls[0][0];
      const initialOnResizeCallback = mockXTerm.onResize.mock.calls[0][0];

      initialOnDataCallback('early input');
      initialOnResizeCallback({ cols: 80, rows: 24 });

      expect(mockMythalAPI.terminal.write).not.toHaveBeenCalled();
      expect(mockMythalAPI.terminal.resize).not.toHaveBeenCalled();

      // Simulate becoming ready
      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      // Now should handle input
      initialOnDataCallback('ready input');
      initialOnResizeCallback({ cols: 100, rows: 30 });

      await waitFor(() => {
        expect(mockMythalAPI.terminal.write).toHaveBeenCalledWith(
          expect.stringMatching(/^terminal-\d+$/), 
          'ready input'
        );
        expect(mockMythalAPI.terminal.resize).toHaveBeenCalledWith(
          expect.stringMatching(/^terminal-\d+$/), 
          100, 
          30
        );
      });
    });

    it('should fit terminal when becoming ready', async () => {
      render(<Terminal />);

      // Initial fit call
      expect(mockFitAddon.fit).toHaveBeenCalledTimes(1);

      // Wait for ready state
      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      // Should fit again when ready
      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle ready state with fit addon failure', async () => {
      mockFitAddon.fit.mockImplementation(() => {
        throw new Error('Fit failed');
      });

      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      // Should not crash even if fit fails
      expect(() => {
        // Trigger another fit
        const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
          call => call[0] === 'resize'
        )[1];
        resizeHandler();
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete terminal workflow', async () => {
      render(<Terminal />);

      // Wait for creation
      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const terminalId = mockMythalAPI.terminal.create.mock.calls[0][0];

      // Get callbacks
      const outputCallback = mockMythalAPI.terminal.onOutput.mock.calls[0][1];
      const exitCallback = mockMythalAPI.terminal.onExit.mock.calls[0][1];
      const onDataCallback = mockXTerm.onData.mock.calls[0][0];
      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];

      // Simulate output
      outputCallback('Welcome to terminal');
      expect(mockXTerm.write).toHaveBeenCalledWith('Welcome to terminal');

      // Simulate user input
      onDataCallback('ls -la\r');
      expect(mockMythalAPI.terminal.write).toHaveBeenCalledWith(terminalId, 'ls -la\r');

      // Simulate resize
      onResizeCallback({ cols: 120, rows: 30 });
      expect(mockMythalAPI.terminal.resize).toHaveBeenCalledWith(terminalId, 120, 30);

      // Simulate more output
      outputCallback('total 4\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\n');

      // Simulate process exit
      exitCallback({ exitCode: 0, signal: null });
      expect(mockXTerm.write).toHaveBeenCalledWith('\r\n[Process exited with code 0]\r\n');
    });

    it('should handle concurrent operations', async () => {
      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const outputCallback = mockMythalAPI.terminal.onOutput.mock.calls[0][1];
      const onDataCallback = mockXTerm.onData.mock.calls[0][0];
      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];

      // Simulate concurrent operations
      const operations = [
        () => outputCallback('output1'),
        () => onDataCallback('input1'),
        () => outputCallback('output2'),
        () => onResizeCallback({ cols: 90, rows: 25 }),
        () => outputCallback('output3'),
        () => onDataCallback('input2')
      ];

      // Execute all operations
      operations.forEach(op => op());

      // All should complete without issues
      expect(mockXTerm.write).toHaveBeenCalledTimes(3);
      expect(mockMythalAPI.terminal.write).toHaveBeenCalledTimes(2);
      expect(mockMythalAPI.terminal.resize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have appropriate CSS classes for styling', () => {
      render(<Terminal />);

      const outerContainer = screen.getByRole('generic');
      expect(outerContainer).toHaveClass('h-full', 'w-full', 'bg-gray-900', 'p-2');
      
      const innerContainer = outerContainer.firstChild as HTMLElement;
      expect(innerContainer).toHaveClass('h-full', 'w-full');
    });

    it('should provide terminal element for XTerm to attach', () => {
      render(<Terminal />);

      expect(mockXTerm.open).toHaveBeenCalledWith(expect.any(HTMLDivElement));
      
      const terminalElement = (mockXTerm.open as jest.Mock).mock.calls[0][0];
      expect(terminalElement).toBeInstanceOf(HTMLDivElement);
      expect(terminalElement.className).toContain('h-full w-full');
    });

    it('should handle focus and blur events gracefully', () => {
      render(<Terminal />);

      const terminalElement = screen.getByRole('generic').firstChild as HTMLElement;

      // Simulate focus/blur events
      fireEvent.focus(terminalElement);
      fireEvent.blur(terminalElement);

      // Should not crash
      expect(terminalElement).toBeInTheDocument();
    });
  });
});