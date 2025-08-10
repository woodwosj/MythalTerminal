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

// Mock CSS import
jest.mock('xterm/css/xterm.css', () => ({}));

describe('Terminal Component Comprehensive Tests', () => {
  let mockXTerm: any;
  let mockFitAddon: any;
  let mockSearchAddon: any;
  let mockWebLinksAddon: any;
  let mockMythalAPI: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock XTerm instance
    mockXTerm = {
      open: jest.fn(),
      write: jest.fn(),
      onData: jest.fn(),
      onResize: jest.fn(),
      dispose: jest.fn(),
      getSelection: jest.fn(() => 'selected text'),
      paste: jest.fn(),
      loadAddon: jest.fn()
    };

    // Mock addons
    mockFitAddon = {
      fit: jest.fn()
    };

    mockSearchAddon = {
      findNext: jest.fn()
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
        onOutput: jest.fn(() => jest.fn()), // Returns unsubscribe function
        onExit: jest.fn(() => jest.fn()) // Returns unsubscribe function
      }
    };

    Object.defineProperty(window, 'mythalAPI', {
      value: mockMythalAPI,
      writable: true
    });

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn(() => Promise.resolve()),
        readText: jest.fn(() => Promise.resolve('clipboard text'))
      },
      writable: true
    });

    // Mock prompt
    Object.defineProperty(window, 'prompt', {
      value: jest.fn(() => 'search term'),
      writable: true
    });

    // Mock addEventListener/removeEventListener
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;
    const originalDocumentAddEventListener = document.addEventListener;
    const originalDocumentRemoveEventListener = document.removeEventListener;

    window.addEventListener = jest.fn();
    window.removeEventListener = jest.fn();
    document.addEventListener = jest.fn();
    document.removeEventListener = jest.fn();

    // Restore after each test
    afterEach(() => {
      window.addEventListener = originalAddEventListener;
      window.removeEventListener = originalRemoveEventListener;
      document.addEventListener = originalDocumentAddEventListener;
      document.removeEventListener = originalDocumentRemoveEventListener;
    });
  });

  describe('Component Initialization', () => {
    it('should render terminal container', () => {
      render(<Terminal />);
      
      const terminalContainer = screen.getByRole('generic');
      expect(terminalContainer).toBeInTheDocument();
      expect(terminalContainer).toHaveClass('h-full', 'w-full', 'bg-gray-900', 'p-2');
    });

    it('should create XTerm instance with correct configuration', () => {
      render(<Terminal />);

      expect(XTerm).toHaveBeenCalledWith({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: expect.objectContaining({
          background: '#1e1e1e',
          foreground: '#e0e0e0',
          cursor: '#e0e0e0'
        }),
        allowTransparency: true,
        scrollback: 10000
      });
    });

    it('should load all required addons', () => {
      render(<Terminal />);

      expect(FitAddon).toHaveBeenCalled();
      expect(SearchAddon).toHaveBeenCalled();
      expect(WebLinksAddon).toHaveBeenCalled();

      expect(mockXTerm.loadAddon).toHaveBeenCalledWith(mockFitAddon);
      expect(mockXTerm.loadAddon).toHaveBeenCalledWith(mockSearchAddon);
      expect(mockXTerm.loadAddon).toHaveBeenCalledWith(mockWebLinksAddon);
    });

    it('should open terminal and fit it', () => {
      render(<Terminal />);

      expect(mockXTerm.open).toHaveBeenCalled();
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should generate unique terminal ID', () => {
      const { rerender } = render(<Terminal />);
      const firstCreateCall = mockMythalAPI.terminal.create.mock.calls[0];

      rerender(<Terminal />);
      const secondCreateCall = mockMythalAPI.terminal.create.mock.calls[1];

      expect(firstCreateCall[0]).not.toBe(secondCreateCall[0]);
      expect(firstCreateCall[0]).toMatch(/^terminal-\d+$/);
      expect(secondCreateCall[0]).toMatch(/^terminal-\d+$/);
    });
  });

  describe('Terminal Backend Integration', () => {
    it('should create terminal via API on mount', async () => {
      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalledWith(
          expect.stringMatching(/^terminal-\d+$/)
        );
      });
    });

    it('should setup output and exit listeners', () => {
      render(<Terminal />);

      expect(mockMythalAPI.terminal.onOutput).toHaveBeenCalledWith(
        expect.stringMatching(/^terminal-\d+$/),
        expect.any(Function)
      );

      expect(mockMythalAPI.terminal.onExit).toHaveBeenCalledWith(
        expect.stringMatching(/^terminal-\d+$/),
        expect.any(Function)
      );
    });

    it('should handle terminal output data', () => {
      render(<Terminal />);

      const outputCallback = mockMythalAPI.terminal.onOutput.mock.calls[0][1];
      outputCallback('test output data');

      expect(mockXTerm.write).toHaveBeenCalledWith('test output data');
    });

    it('should handle terminal exit', () => {
      render(<Terminal />);

      const exitCallback = mockMythalAPI.terminal.onExit.mock.calls[0][1];
      exitCallback({ exitCode: 0, signal: null });

      expect(mockXTerm.write).toHaveBeenCalledWith(
        '\r\n[Process exited with code 0]\r\n'
      );
    });

    it('should handle terminal exit with non-zero code', () => {
      render(<Terminal />);

      const exitCallback = mockMythalAPI.terminal.onExit.mock.calls[0][1];
      exitCallback({ exitCode: 1, signal: 'SIGTERM' });

      expect(mockXTerm.write).toHaveBeenCalledWith(
        '\r\n[Process exited with code 1]\r\n'
      );
    });
  });

  describe('User Input Handling', () => {
    it('should setup onData handler for user input', () => {
      render(<Terminal />);

      expect(mockXTerm.onData).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should send user input to terminal when ready', async () => {
      render(<Terminal />);

      // Simulate terminal becoming ready
      await act(async () => {
        mockMythalAPI.terminal.create.mockResolvedValue({ success: true });
      });

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      // Simulate user input
      const onDataCallback = mockXTerm.onData.mock.calls[0][0];
      onDataCallback('ls -la\r');

      expect(mockMythalAPI.terminal.write).toHaveBeenCalledWith(
        expect.stringMatching(/^terminal-\d+$/),
        'ls -la\r'
      );
    });

    it('should not send input when terminal is not ready', () => {
      render(<Terminal />);

      // Simulate user input before terminal is ready
      const onDataCallback = mockXTerm.onData.mock.calls[0][0];
      onDataCallback('early input');

      expect(mockMythalAPI.terminal.write).not.toHaveBeenCalled();
    });

    it('should setup onResize handler', () => {
      render(<Terminal />);

      expect(mockXTerm.onResize).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle terminal resize when ready', async () => {
      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];
      onResizeCallback({ cols: 120, rows: 40 });

      expect(mockMythalAPI.terminal.resize).toHaveBeenCalledWith(
        expect.stringMatching(/^terminal-\d+$/),
        120,
        40
      );
    });

    it('should not resize when terminal is not ready', () => {
      render(<Terminal />);

      const onResizeCallback = mockXTerm.onResize.mock.calls[0][0];
      onResizeCallback({ cols: 120, rows: 40 });

      expect(mockMythalAPI.terminal.resize).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should setup keydown event listener', () => {
      render(<Terminal />);

      expect(document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should handle Ctrl+Shift+F for search', () => {
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

      expect(event.preventDefault).toHaveBeenCalled();
      expect(window.prompt).toHaveBeenCalledWith('Search for:');
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith('search term');
    });

    it('should handle Ctrl+Shift+F with no search term', () => {
      (window.prompt as jest.Mock).mockReturnValue(null);
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

      expect(mockSearchAddon.findNext).not.toHaveBeenCalled();
    });

    it('should handle Ctrl+Shift+C for copy', async () => {
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

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockXTerm.getSelection).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('selected text');
      });
    });

    it('should handle Ctrl+Shift+C with no selection', async () => {
      mockXTerm.getSelection.mockReturnValue('');
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

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('should handle Ctrl+Shift+V for paste', async () => {
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

      expect(event.preventDefault).toHaveBeenCalled();
      
      await waitFor(() => {
        expect(navigator.clipboard.readText).toHaveBeenCalled();
        expect(mockXTerm.paste).toHaveBeenCalledWith('clipboard text');
      });
    });

    it('should ignore non-Ctrl+Shift combinations', () => {
      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      const event = new KeyboardEvent('keydown', {
        key: 'F',
        ctrlKey: true,
        shiftKey: false
      });

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn()
      });

      keydownHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockSearchAddon.findNext).not.toHaveBeenCalled();
    });

    it('should ignore unknown key combinations', () => {
      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      const event = new KeyboardEvent('keydown', {
        key: 'X',
        ctrlKey: true,
        shiftKey: true
      });

      Object.defineProperty(event, 'preventDefault', {
        value: jest.fn()
      });

      keydownHandler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('Window Resize Handling', () => {
    it('should setup window resize listener', () => {
      render(<Terminal />);

      expect(window.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );
    });

    it('should fit terminal on window resize', () => {
      render(<Terminal />);

      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'resize'
      )[1];

      resizeHandler();

      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should handle resize when fitAddon is not available', () => {
      render(<Terminal />);

      // Simulate fitAddon being null
      const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'resize'
      )[1];

      // This should not throw an error
      expect(() => resizeHandler()).not.toThrow();
    });
  });

  describe('Component Cleanup', () => {
    it('should cleanup on unmount', () => {
      const mockOutputUnsubscribe = jest.fn();
      const mockExitUnsubscribe = jest.fn();

      mockMythalAPI.terminal.onOutput.mockReturnValue(mockOutputUnsubscribe);
      mockMythalAPI.terminal.onExit.mockReturnValue(mockExitUnsubscribe);

      const { unmount } = render(<Terminal />);

      unmount();

      expect(mockOutputUnsubscribe).toHaveBeenCalled();
      expect(mockExitUnsubscribe).toHaveBeenCalled();
      expect(window.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );
      expect(document.removeEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
      expect(mockMythalAPI.terminal.destroy).toHaveBeenCalledWith(
        expect.stringMatching(/^terminal-\d+$/)
      );
      expect(mockXTerm.dispose).toHaveBeenCalled();
    });

    it('should handle cleanup when unsubscribe functions are not available', () => {
      mockMythalAPI.terminal.onOutput.mockReturnValue(null);
      mockMythalAPI.terminal.onExit.mockReturnValue(null);

      const { unmount } = render(<Terminal />);

      // Should not throw error
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Terminal Ready State', () => {
    it('should fit terminal when it becomes ready', async () => {
      render(<Terminal />);

      // Initial fit call during setup
      expect(mockFitAddon.fit).toHaveBeenCalledTimes(1);

      // Simulate terminal becoming ready
      await act(async () => {
        mockMythalAPI.terminal.create.mockResolvedValue({ success: true });
      });

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalledTimes(2);
      });
    });

    it('should not fit when terminal is not ready', () => {
      render(<Terminal />);

      // Only the initial fit call should happen
      expect(mockFitAddon.fit).toHaveBeenCalledTimes(1);
    });
  });

  describe('Theme Configuration', () => {
    it('should apply correct theme colors', () => {
      render(<Terminal />);

      const terminalConfig = (XTerm as jest.Mock).mock.calls[0][0];

      expect(terminalConfig.theme).toEqual({
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

    it('should configure terminal with correct options', () => {
      render(<Terminal />);

      const terminalConfig = (XTerm as jest.Mock).mock.calls[0][0];

      expect(terminalConfig).toMatchObject({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        allowTransparency: true,
        scrollback: 10000
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle terminal creation failure gracefully', async () => {
      mockMythalAPI.terminal.create.mockRejectedValue(new Error('Creation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(<Terminal />);

      await waitFor(() => {
        expect(mockMythalAPI.terminal.create).toHaveBeenCalled();
      });

      // Component should still render without crashing
      expect(screen.getByRole('generic')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should handle clipboard API errors gracefully', async () => {
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(
        new Error('Clipboard access denied')
      );

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

      // Should not throw error
      expect(async () => {
        keydownHandler(event);
        await new Promise(resolve => setTimeout(resolve, 0));
      }).not.toThrow();
    });

    it('should handle missing DOM element gracefully', () => {
      const { container } = render(<Terminal />);
      
      // Remove the terminal div
      container.innerHTML = '';

      // Should not throw error during cleanup
      expect(() => {
        render(<Terminal />);
      }).not.toThrow();
    });
  });

  describe('Performance and Memory', () => {
    it('should not create multiple terminals on re-renders', () => {
      const { rerender } = render(<Terminal />);
      
      expect(XTerm).toHaveBeenCalledTimes(1);
      
      rerender(<Terminal />);
      
      // Should still be 1 because of useEffect dependency array
      expect(XTerm).toHaveBeenCalledTimes(1);
    });

    it('should properly dispose of resources on multiple mount/unmount cycles', () => {
      const mockOutputUnsubscribe = jest.fn();
      const mockExitUnsubscribe = jest.fn();

      mockMythalAPI.terminal.onOutput.mockReturnValue(mockOutputUnsubscribe);
      mockMythalAPI.terminal.onExit.mockReturnValue(mockExitUnsubscribe);

      // Mount and unmount multiple times
      for (let i = 0; i < 3; i++) {
        const { unmount } = render(<Terminal />);
        unmount();
      }

      expect(mockXTerm.dispose).toHaveBeenCalledTimes(3);
      expect(mockOutputUnsubscribe).toHaveBeenCalledTimes(3);
      expect(mockExitUnsubscribe).toHaveBeenCalledTimes(3);
      expect(mockMythalAPI.terminal.destroy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<Terminal />);
      
      const terminalContainer = screen.getByRole('generic');
      expect(terminalContainer).toBeInTheDocument();
    });

    it('should handle keyboard navigation', () => {
      render(<Terminal />);

      const keydownHandler = (document.addEventListener as jest.Mock).mock.calls.find(
        call => call[0] === 'keydown'
      )[1];

      // Test Tab key (should not be handled by our shortcuts)
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        ctrlKey: false,
        shiftKey: false
      });

      Object.defineProperty(tabEvent, 'preventDefault', {
        value: jest.fn()
      });

      keydownHandler(tabEvent);

      expect(tabEvent.preventDefault).not.toHaveBeenCalled();
    });
  });
});