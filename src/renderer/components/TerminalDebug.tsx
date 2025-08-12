import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const TerminalDebug: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const [terminalId] = useState(() => `terminal-${Date.now()}`);
  const [ipcStatus, setIpcStatus] = useState<string>('Not tested');
  const [ptyCreated, setPtyCreated] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    console.log('[DEBUG] Initializing debug terminal...');
    
    // Create xterm instance
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
    xterm.focus();
    
    xterm.writeln('=== Terminal Debug Mode ===');
    xterm.writeln('Testing IPC communication...');
    xterm.writeln('');
    
    // Test 1: Check if window.mythalAPI exists
    if (typeof window.mythalAPI === 'undefined') {
      xterm.writeln('❌ window.mythalAPI is undefined - Preload script not loaded!');
      setIpcStatus('Preload script not loaded');
    } else {
      xterm.writeln('✅ window.mythalAPI exists');
      
      // Test 2: Check if terminal methods exist
      if (typeof window.mythalAPI.terminal === 'undefined') {
        xterm.writeln('❌ window.mythalAPI.terminal is undefined');
        setIpcStatus('Terminal API not available');
      } else {
        xterm.writeln('✅ window.mythalAPI.terminal exists');
        
        // Test 3: Try to create a PTY
        xterm.writeln('Attempting to create PTY...');
        
        window.mythalAPI.terminal.create(terminalId).then((result) => {
          console.log('[DEBUG] PTY create result:', result);
          
          if (result.success) {
            xterm.writeln('✅ PTY created successfully!');
            setPtyCreated(true);
            setIpcStatus('PTY created');
            
            // Set up output listener
            const unsubscribe = window.mythalAPI.terminal.onOutput(terminalId, (data: string) => {
              console.log('[DEBUG] Received PTY output:', data);
              xterm.write(data);
            });
            
            // Now handle input
            xterm.onData((data: string) => {
              console.log('[DEBUG] Sending to PTY:', JSON.stringify(data));
              
              // Try to write to PTY
              window.mythalAPI.terminal.write(terminalId, data).then((writeResult) => {
                console.log('[DEBUG] Write result:', writeResult);
                if (!writeResult.success) {
                  xterm.writeln(`\r\n❌ Write failed: ${writeResult.error}`);
                }
              }).catch((err) => {
                console.error('[DEBUG] Write error:', err);
                xterm.writeln(`\r\n❌ Write exception: ${err}`);
              });
            });
            
            // Test write
            setTimeout(() => {
              xterm.writeln('\r\n--- Testing PTY write ---');
              window.mythalAPI.terminal.write(terminalId, 'echo "PTY test"\r').then((result) => {
                console.log('[DEBUG] Test write result:', result);
              });
            }, 1000);
            
            return () => {
              unsubscribe();
              window.mythalAPI.terminal.destroy(terminalId);
            };
            
          } else {
            xterm.writeln(`❌ PTY creation failed: ${result.error || 'Unknown error'}`);
            setIpcStatus(`PTY failed: ${result.error}`);
          }
        }).catch((error) => {
          console.error('[DEBUG] PTY create error:', error);
          xterm.writeln(`❌ PTY creation exception: ${error}`);
          setIpcStatus(`Exception: ${error}`);
        });
      }
    }
    
    // Simple echo for testing without PTY
    if (!ptyCreated) {
      xterm.writeln('');
      xterm.writeln('Local echo mode (no PTY):');
      xterm.write('$ ');
      
      xterm.onData((data: string) => {
        if (!ptyCreated) {
          console.log('[DEBUG] Local echo:', JSON.stringify(data));
          
          if (data === '\r') {
            xterm.write('\r\n$ ');
          } else if (data === '\x7f') {
            xterm.write('\b \b');
          } else if (data >= ' ') {
            xterm.write(data);
          }
        }
      });
    }
    
    return () => {
      console.log('[DEBUG] Cleaning up debug terminal');
      if (ptyCreated) {
        window.mythalAPI.terminal.destroy(terminalId);
      }
      xterm.dispose();
    };
  }, []);

  return (
    <div className="h-full w-full bg-gray-900 p-4">
      <div className="mb-2 p-2 bg-yellow-900 text-yellow-200 text-sm rounded">
        🔍 Debug Terminal - IPC Status: {ipcStatus} | Terminal ID: {terminalId}
      </div>
      <div 
        ref={terminalRef} 
        className="h-full w-full"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default TerminalDebug;