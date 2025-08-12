import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useTerminalStore } from '../stores/terminalStore';
import { useContextStore } from '../stores/contextStore';
import 'xterm/css/xterm.css';

const TerminalFull: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId] = useState(() => `terminal-${Date.now()}`);
  const [currentLine, setCurrentLine] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string; timestamp: Date }>>([]);
  
  const { sendToClaude, claudeInstances } = useTerminalStore();
  const { addLayer, autoArchiveOldLayers } = useContextStore();

  // Command detection helpers
  const isClaudeCommand = (cmd: string): boolean => {
    const trimmed = cmd.trim();
    return trimmed.startsWith('claude:') || 
           trimmed.startsWith('/claude ') || 
           trimmed.startsWith('ai:') ||
           trimmed.startsWith('/ai ');
  };

  const isSpecialCommand = (cmd: string): boolean => {
    const trimmed = cmd.trim();
    return trimmed === '/help' || 
           trimmed === '/clear' || 
           trimmed === '/status' ||
           trimmed === '/history' ||
           trimmed === '/archive';
  };

  const parseClaudeCommand = (command: string): { instance: string; message: string } => {
    const trimmed = command.trim();
    
    if (trimmed.startsWith('claude:')) {
      return { instance: 'main', message: trimmed.substring(7).trim() };
    } else if (trimmed.startsWith('/claude ')) {
      return { instance: 'main', message: trimmed.substring(8).trim() };
    } else if (trimmed.startsWith('ai:')) {
      return { instance: 'main', message: trimmed.substring(3).trim() };
    } else if (trimmed.startsWith('/ai ')) {
      return { instance: 'main', message: trimmed.substring(4).trim() };
    }
    
    return { instance: 'main', message: trimmed };
  };

  const handleSpecialCommand = async (cmd: string, xterm: XTerm) => {
    const trimmed = cmd.trim();
    
    switch(trimmed) {
      case '/help':
        xterm.writeln('\r\n📋 MythalTerminal Commands:');
        xterm.writeln('  claude: <message>  - Send message to Claude AI');
        xterm.writeln('  /claude <message>  - Alternative Claude syntax');
        xterm.writeln('  /help              - Show this help');
        xterm.writeln('  /clear             - Clear terminal and archive conversation');
        xterm.writeln('  /status            - Show Claude instances status');
        xterm.writeln('  /history           - Show command history');
        xterm.writeln('  /archive           - Archive current conversation\r\n');
        xterm.writeln('Keyboard Shortcuts:');
        xterm.writeln('  ↑/↓                - Navigate command history');
        xterm.writeln('  Ctrl+L             - Clear screen');
        xterm.writeln('  Ctrl+C             - Cancel current input');
        xterm.writeln('  Ctrl+Shift+C       - Copy selection');
        xterm.writeln('  Ctrl+Shift+V       - Paste from clipboard');
        xterm.writeln('  Ctrl+Shift+F       - Search in terminal\r\n');
        break;
        
      case '/clear':
        // Archive conversation before clearing
        if (conversationHistory.length > 0) {
          const conversation = conversationHistory.map(h => 
            `[${h.role}]: ${h.content}`
          ).join('\n');
          
          await addLayer({
            project_path: '/home/stephen-woodworth/Desktop/MythalTerminal',
            layer_type: 'archive',
            content: conversation,
            source: 'terminal-conversation',
            tokens: conversation.length, // Rough estimate
            created_at: new Date(),
            is_starred: false
          });
          
          setConversationHistory([]);
          xterm.writeln('\r\n💾 Conversation archived to context store');
        }
        xterm.clear();
        break;
        
      case '/status':
        xterm.writeln('\r\n🤖 Claude Instances Status:');
        Object.entries(claudeInstances).forEach(([key, status]) => {
          const statusIcon = status === 'running' ? '🟢' : status === 'crashed' ? '🔴' : '🟡';
          xterm.writeln(`  ${statusIcon} ${key}: ${status}`);
        });
        xterm.writeln('');
        break;
        
      case '/history':
        xterm.writeln('\r\n📜 Command History:');
        const recentHistory = commandHistory.slice(-10);
        if (recentHistory.length === 0) {
          xterm.writeln('  (empty)');
        } else {
          recentHistory.forEach((cmd, i) => {
            xterm.writeln(`  ${i + 1}. ${cmd}`);
          });
        }
        xterm.writeln('');
        break;
        
      case '/archive':
        if (conversationHistory.length > 0) {
          const conversation = conversationHistory.map(h => 
            `[${h.role}]: ${h.content}`
          ).join('\n');
          
          await addLayer({
            project_path: '/home/stephen-woodworth/Desktop/MythalTerminal',
            layer_type: 'archive',
            content: conversation,
            source: 'terminal-conversation',
            tokens: conversation.length,
            created_at: new Date(),
            is_starred: false
          });
          
          xterm.writeln('\r\n💾 Conversation archived to context store');
          setConversationHistory([]);
        } else {
          xterm.writeln('\r\n📭 No conversation to archive');
        }
        break;
    }
  };

  const handleClaudeCommand = async (cmd: string, xterm: XTerm) => {
    const { instance, message } = parseClaudeCommand(cmd);
    
    // Add to conversation history
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date()
    }]);
    
    xterm.writeln('\r\n🤖 Sending to Claude...');
    
    try {
      const response = await sendToClaude(instance, message);
      
      // Add response to conversation history
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }]);
      
      // Display response
      xterm.writeln('\r\n💬 Claude Response:');
      xterm.writeln('');
      response.split('\n').forEach(line => {
        xterm.writeln('  ' + line);
      });
      xterm.writeln('');
      
    } catch (error: any) {
      xterm.writeln(`\r\n❌ Error: ${error.message || 'Failed to send to Claude'}\r\n`);
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    console.log('[FULL] Creating terminal with full features...');
    
    // Create xterm with enhanced configuration
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selection: '#4d4d4d',
      },
      scrollback: 10000,
      convertEol: true,
    });

    // Load addons
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(webLinksAddon);
    
    // Open terminal in DOM
    xterm.open(terminalRef.current);
    fitAddon.fit();
    
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    
    // Focus terminal
    xterm.focus();
    
    // Create PTY
    window.mythalAPI.terminal.create(terminalId).then((result) => {
      console.log('[FULL] PTY created:', result);
      
      if (result.success) {
        // Set up output from PTY to xterm
        const unsubscribe = window.mythalAPI.terminal.onOutput(terminalId, (data: string) => {
          xterm.write(data);
        });
        
        // Set up input from xterm to PTY with command tracking
        xterm.onData((data: string) => {
          // Handle special keys
          if (data === '\r') { // Enter
            const trimmedLine = currentLine.trim();
            
            // Add non-empty commands to history
            if (trimmedLine && !isSpecialCommand(trimmedLine)) {
              setCommandHistory(prev => [...prev, trimmedLine]);
              setHistoryIndex(-1);
            }
            
            // Check for special/Claude commands
            if (isSpecialCommand(trimmedLine)) {
              handleSpecialCommand(trimmedLine, xterm);
              setCurrentLine('');
              return; // Don't send to PTY
            } else if (isClaudeCommand(trimmedLine)) {
              handleClaudeCommand(trimmedLine, xterm);
              setCurrentLine('');
              return; // Don't send to PTY
            }
            
            setCurrentLine('');
            setHistoryIndex(-1);
          } else if (data === '\x7f') { // Backspace
            setCurrentLine(prev => prev.slice(0, -1));
          } else if (data === '\x03') { // Ctrl+C
            setCurrentLine('');
            setHistoryIndex(-1);
          } else if (data === '\x0c') { // Ctrl+L (clear screen)
            xterm.clear();
            return; // Don't send to PTY
          } else if (data === '\x1b[A') { // Up arrow
            if (commandHistory.length > 0) {
              const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
              if (newIndex !== historyIndex) {
                setHistoryIndex(newIndex);
                const historyCmd = commandHistory[commandHistory.length - 1 - newIndex];
                
                // Clear current line and show history command
                window.mythalAPI.terminal.write(terminalId, '\r\x1b[K');
                window.mythalAPI.terminal.write(terminalId, historyCmd);
                setCurrentLine(historyCmd);
              }
            }
            return; // Don't send arrow key to PTY
          } else if (data === '\x1b[B') { // Down arrow
            if (historyIndex > -1) {
              const newIndex = historyIndex - 1;
              setHistoryIndex(newIndex);
              
              if (newIndex === -1) {
                // Back to empty line
                window.mythalAPI.terminal.write(terminalId, '\r\x1b[K');
                setCurrentLine('');
              } else {
                const historyCmd = commandHistory[commandHistory.length - 1 - newIndex];
                window.mythalAPI.terminal.write(terminalId, '\r\x1b[K');
                window.mythalAPI.terminal.write(terminalId, historyCmd);
                setCurrentLine(historyCmd);
              }
            }
            return; // Don't send arrow key to PTY
          } else if (data >= ' ') { // Regular character
            setCurrentLine(prev => prev + data);
          }
          
          // Send to PTY for normal terminal behavior
          window.mythalAPI.terminal.write(terminalId, data);
        });
        
        // Resize PTY
        const { cols, rows } = xterm;
        window.mythalAPI.terminal.resize(terminalId, cols, rows);
        
        // Handle resize events
        xterm.onResize(({ cols, rows }) => {
          window.mythalAPI.terminal.resize(terminalId, cols, rows);
        });
        
        // Show welcome message
        setTimeout(() => {
          xterm.write('\x1b[36m🚀 MythalTerminal - AI-Powered Terminal\x1b[0m\r\n');
          xterm.write('\x1b[33mType /help to see all commands and shortcuts\x1b[0m\r\n');
          xterm.write('\x1b[90mConversations are auto-archived on /clear\x1b[0m\r\n\r\n');
        }, 500);
        
        // Handle Claude output (if available)
        window.mythalAPI.claude?.onOutput?.('main', (data: string) => {
          setConversationHistory(prev => [...prev, {
            role: 'assistant',
            content: data,
            timestamp: new Date()
          }]);
        });
        
        return () => {
          unsubscribe();
          window.mythalAPI.terminal.destroy(terminalId);
        };
      } else {
        xterm.writeln('Failed to create terminal: ' + result.error);
      }
    }).catch((error) => {
      console.error('[FULL] Error:', error);
      xterm.writeln('Terminal error: ' + error);
    });
    
    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key) {
          case 'F':
            e.preventDefault();
            const searchTerm = prompt('Search for:');
            if (searchTerm) {
              searchAddon.findNext(searchTerm);
            }
            break;
          case 'C':
            e.preventDefault();
            const selection = xterm.getSelection();
            if (selection) {
              navigator.clipboard.writeText(selection);
              xterm.writeln('\r\n📋 Copied to clipboard');
            }
            break;
          case 'V':
            e.preventDefault();
            navigator.clipboard.readText().then(text => {
              if (text) {
                xterm.paste(text);
              }
            });
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Click to focus
    const handleClick = () => {
      xterm.focus();
    };
    
    terminalRef.current.addEventListener('click', handleClick);
    
    return () => {
      console.log('[FULL] Cleaning up');
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
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

export default TerminalFull;