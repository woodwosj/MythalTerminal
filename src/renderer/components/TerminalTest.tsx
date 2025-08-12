import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const TerminalTest: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    console.log('[TEST] Initializing test terminal...');
    
    // Create a simple xterm instance
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
    
    // Open terminal in DOM
    xterm.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    
    // Focus immediately
    xterm.focus();
    console.log('[TEST] Terminal opened and focused');
    
    // Write test message
    xterm.writeln('Test Terminal - Type to see if input works');
    xterm.writeln('Your input will echo below:');
    xterm.write('$ ');
    
    // Simple echo handler - just display what user types
    xterm.onData((data: string) => {
      console.log('[TEST] onData received:', JSON.stringify(data), 'charCode:', data.charCodeAt(0));
      
      // Handle special keys
      if (data === '\r') { // Enter
        xterm.write('\r\n$ ');
      } else if (data === '\x7f') { // Backspace
        // Move cursor back, write space, move back again
        xterm.write('\b \b');
      } else if (data >= ' ') { // Regular character
        xterm.write(data);
      }
    });
    
    // Test if we can write programmatically
    setTimeout(() => {
      console.log('[TEST] Writing test text...');
      xterm.write('(test text) ');
    }, 1000);
    
    // Handle clicks
    const handleClick = () => {
      console.log('[TEST] Terminal clicked, focusing...');
      xterm.focus();
    };
    
    terminalRef.current.addEventListener('click', handleClick);
    
    return () => {
      console.log('[TEST] Cleaning up test terminal');
      xterm.dispose();
    };
  }, []);

  return (
    <div className="h-full w-full bg-gray-900 p-4">
      <div className="mb-2 p-2 bg-blue-900 text-blue-200 text-sm rounded">
        🧪 Test Terminal - This is a minimal implementation to test if xterm.js input works
      </div>
      <div 
        ref={terminalRef} 
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default TerminalTest;