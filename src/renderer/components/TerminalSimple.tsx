import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const TerminalSimple: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const [terminalId] = useState(() => `terminal-${Date.now()}`);
  const [currentLine, setCurrentLine] = useState('');

  // Command helpers
  const isSpecialCommand = (cmd: string): boolean => {
    const trimmed = cmd.trim();
    return trimmed === '/help' || trimmed === '/clear' || trimmed === '/status';
  };

  const handleSpecialCommand = (cmd: string, xterm: XTerm) => {
    const trimmed = cmd.trim();
    
    if (trimmed === '/help') {
      xterm.writeln('\r\n📋 MythalTerminal Commands:');
      xterm.writeln('  /help     - Show this help');
      xterm.writeln('  /clear    - Clear terminal');
      xterm.writeln('  /status   - Show status\r\n');
    } else if (trimmed === '/clear') {
      xterm.clear();
    } else if (trimmed === '/status') {
      xterm.writeln('\r\n✅ Terminal is working!\r\n');
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    console.log('[SIMPLE] Creating terminal...');
    
    // Create xterm
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#e0e0e0',
      }
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    
    // Open in DOM
    xterm.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    
    // Focus immediately
    xterm.focus();
    
    // Create PTY
    window.mythalAPI.terminal.create(terminalId).then((result) => {
      console.log('[SIMPLE] PTY created:', result);
      
      if (result.success) {
        // Set up output from PTY to xterm
        const unsubscribe = window.mythalAPI.terminal.onOutput(terminalId, (data: string) => {
          xterm.write(data);
        });
        
        // Set up input from xterm to PTY
        xterm.onData((data: string) => {
          // Track current line for special commands
          if (data === '\r') {
            // Check for special commands
            if (isSpecialCommand(currentLine)) {
              handleSpecialCommand(currentLine, xterm);
              setCurrentLine('');
              return; // Don't send to PTY
            }
            setCurrentLine('');
          } else if (data === '\x7f') { // Backspace
            setCurrentLine(prev => prev.slice(0, -1));
          } else if (data >= ' ') { // Regular character
            setCurrentLine(prev => prev + data);
          }
          
          // Always send to PTY for normal terminal behavior
          window.mythalAPI.terminal.write(terminalId, data);
        });
        
        // Resize PTY
        const { cols, rows } = xterm;
        window.mythalAPI.terminal.resize(terminalId, cols, rows);
        
        // Show welcome message
        setTimeout(() => {
          xterm.write('\x1b[36m🚀 MythalTerminal - AI-Powered Terminal\x1b[0m\r\n');
          xterm.write('\x1b[33mType /help to see available commands\x1b[0m\r\n');
          xterm.write('\x1b[90mTerminal is ready for use\x1b[0m\r\n\r\n');
        }, 500);
        
        // Handle resize events
        xterm.onResize(({ cols, rows }) => {
          window.mythalAPI.terminal.resize(terminalId, cols, rows);
        });
        
        return () => {
          unsubscribe();
          window.mythalAPI.terminal.destroy(terminalId);
        };
      } else {
        xterm.writeln('Failed to create terminal: ' + result.error);
      }
    }).catch((error) => {
      console.error('[SIMPLE] Error:', error);
      xterm.writeln('Terminal error: ' + error);
    });
    
    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Click to focus
    const handleClick = () => {
      xterm.focus();
    };
    
    terminalRef.current.addEventListener('click', handleClick);
    
    return () => {
      console.log('[SIMPLE] Cleaning up');
      window.removeEventListener('resize', handleResize);
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('click', handleClick);
      }
      window.mythalAPI.terminal.destroy(terminalId);
      xterm.dispose();
    };
  }, []);

  return (
    <div className="h-full w-full bg-gray-900 p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default TerminalSimple;