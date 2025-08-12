import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useTerminalStore } from '../stores/terminalStore';
import { useContextStore } from '../stores/contextStore';
import { countTokens } from '../stores/contextStore';
import 'xterm/css/xterm.css';

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId] = useState(() => `terminal-${Date.now()}`);
  const [isReady, setIsReady] = useState(false);
  const [currentLine, setCurrentLine] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [inputBuffer, setInputBuffer] = useState<string[]>([]);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const { sendToClaude, claudeInstances } = useTerminalStore();
  const { addLayer, autoArchiveOldLayers } = useContextStore();
  
  // Track conversation history for archiving
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string; timestamp: Date }>>([]);
  const [projectPath] = useState('/home/stephen-woodworth/Desktop/MythalTerminal'); // TODO: Get from props or context

  // Command parsing functions
  const isClaudeCommand = (command: string): boolean => {
    const trimmed = command.trim();
    return trimmed.startsWith('claude:') || 
           trimmed.startsWith('/claude ') || 
           trimmed.startsWith('ai:') ||
           trimmed.startsWith('/ai ');
  };

  const isSpecialCommand = (command: string): boolean => {
    const trimmed = command.trim();
    return trimmed === '/help' || 
           trimmed === '/clear' || 
           trimmed === '/status' ||
           trimmed === '/history';
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

  const handleSpecialCommand = async (command: string) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    switch (command.trim()) {
      case '/help':
        xterm.writeln('\r\n📋 MythalTerminal Commands:');
        xterm.writeln('  claude: <message>     - Send message to main Claude instance');
        xterm.writeln('  /claude <message>     - Send message to main Claude instance');
        xterm.writeln('  ai: <message>         - Send message to main Claude instance');
        xterm.writeln('  /ai <message>         - Send message to main Claude instance');
        xterm.writeln('  /help                 - Show this help');
        xterm.writeln('  /clear                - Clear terminal');
        xterm.writeln('  /status               - Show Claude instances status');
        xterm.writeln('  /history              - Show command history\r\n');
        break;
      
      case '/clear':
        await handleClearCommand(xterm);
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
        commandHistory.slice(-10).forEach((cmd, i) => {
          xterm.writeln(`  ${i + 1}. ${cmd}`);
        });
        xterm.writeln('');
        break;
    }
  };

  const handleClearCommand = async (xterm: XTerm) => {
    // Archive current conversation if it has content
    if (conversationHistory.length > 0) {
      const conversationText = conversationHistory
        .map(msg => `[${msg.timestamp.toLocaleString()}] ${msg.role}: ${msg.content}`)
        .join('\n\n');
      
      const tokens = countTokens(conversationText);
      
      // Create conversation summary for archiving
      const summary = await generateConversationSummary(conversationHistory);
      const archiveContent = `# Conversation Archive - ${new Date().toISOString()}

## Summary
${summary}

## Full Conversation
${conversationText}`;
      
      try {
        // Add to context layers as archive
        await addLayer({
          project_path: projectPath,
          layer_type: 'archive',
          content: archiveContent,
          tokens: countTokens(archiveContent),
          is_starred: false,
          is_immutable: false,
          source: 'system'
        });
        
        // Also save to chat_archives table
        await window.mythalAPI.chat.archive(
          projectPath,
          conversationText,
          tokens,
          { 
            summary,
            message_count: conversationHistory.length,
            archived_reason: 'terminal_clear'
          }
        );
        
        xterm.writeln('\r\n📦 Conversation archived successfully');
      } catch (error) {
        console.error('Failed to archive conversation:', error);
        xterm.writeln('\r\n⚠️  Failed to archive conversation');
      }
    }
    
    // Auto-archive old layers while we're at it
    try {
      await autoArchiveOldLayers();
    } catch (error) {
      console.warn('Failed to auto-archive old layers:', error);
    }
    
    // Clear the terminal and reset conversation history
    xterm.clear();
    setConversationHistory([]);
    
    xterm.writeln('\r\n✨ Terminal cleared and conversation archived');
  };
  
  const generateConversationSummary = async (history: Array<{ role: string; content: string; timestamp: Date }>): Promise<string> => {
    if (history.length === 0) return 'Empty conversation';
    
    const messageCount = history.length;
    const userMessages = history.filter(m => m.role === 'user').length;
    const aiMessages = history.filter(m => m.role === 'assistant').length;
    
    // Try to get AI to generate a summary if Claude is available
    try {
      const conversationText = history.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');
      const summaryPrompt = `Summarize this terminal conversation in 1-2 sentences:\n\n${conversationText}`;
      
      const result = await sendToClaude('summarizer', summaryPrompt);
      // Since sendToClaude is void, we'll just try and fallback if it fails
      return 'AI-generated summary pending...'
    } catch (error) {
      console.warn('AI summary generation failed, using fallback');
    }
    
    // Fallback to simple summary
    const timeSpan = history.length > 1 ? 
      `${Math.round((history[history.length - 1].timestamp.getTime() - history[0].timestamp.getTime()) / 60000)} minutes` : 
      'brief session';
      
    return `Terminal session with ${messageCount} messages (${userMessages} user, ${aiMessages} AI) over ${timeSpan}. Topics discussed: ${extractTopics(history).join(', ')}.`;
  };
  
  const extractTopics = (history: Array<{ role: string; content: string }>): string[] => {
    const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
    const topics: string[] = [];
    
    // Simple keyword extraction for common terminal/dev topics
    const keywords = {
      'coding': ['code', 'function', 'class', 'variable', 'programming'],
      'files': ['file', 'directory', 'folder', 'path', 'ls', 'cd'],
      'git': ['git', 'commit', 'branch', 'merge', 'pull', 'push'],
      'testing': ['test', 'spec', 'jest', 'cypress', 'playwright'],
      'debugging': ['error', 'bug', 'debug', 'fix', 'issue'],
      'claude': ['claude', 'ai', 'assistant', 'help']
    };
    
    for (const [topic, words] of Object.entries(keywords)) {
      if (words.some(word => userMessages.some(msg => msg.includes(word)))) {
        topics.push(topic);
      }
    }
    
    return topics.length > 0 ? topics : ['general terminal usage'];
  };

  const handleClaudeCommand = async (command: string) => {
    const xterm = xtermRef.current;
    if (!xterm) return;

    const { instance, message } = parseClaudeCommand(command);
    
    if (!message) {
      xterm.writeln('\r\n❌ No message provided to Claude\r\n');
      return;
    }

    // Add to history and conversation tracking
    setCommandHistory(prev => [...prev, command]);
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date()
    }]);
    
    xterm.writeln(`\r\n🤖 Sending to Claude (${instance}): ${message}`);
    xterm.writeln('💭 Thinking...\r\n');

    try {
      await sendToClaude(instance, message);
    } catch (error) {
      xterm.writeln(`❌ Error communicating with Claude: ${error}\r\n`);
    }
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
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
        brightWhite: '#e6e6e6',
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(searchAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Get the actual terminal dimensions after fitting
    const { cols, rows } = xterm;
    
    window.mythalAPI.terminal.create(terminalId).then((result) => {
      console.log('Terminal created successfully:', result, 'terminalId:', terminalId);
      
      // IMMEDIATE - Set ready right away since PTY is created
      setIsReady(true);
      console.log('Terminal is now ready for input');
      
      // Resize the pty to match the xterm dimensions (non-blocking)
      window.mythalAPI.terminal.resize(terminalId, cols, rows).catch((err: any) => {
        console.warn('Failed to resize terminal (non-critical):', err);
      });
      
      // Focus the terminal
      xterm.focus();
      
      // Show welcome message after a brief delay
      setTimeout(() => {
        xterm.write('\x1b[36m🚀 MythalTerminal - AI-Powered Terminal\x1b[0m\r\n');
        xterm.write('\x1b[33mType /help to see Claude AI commands\x1b[0m\r\n');
        xterm.write('\x1b[90mConversations are auto-archived on /clear\x1b[0m\r\n\r\n');
      }, 1000);
    }).catch(error => {
      console.error('Failed to create terminal:', error, 'terminalId:', terminalId);
      setTerminalError(`Failed to initialize terminal: ${error.message || JSON.stringify(error)}`);
      
      xterm.write('\r\n\x1b[31mError: Failed to initialize terminal\x1b[0m\r\n');
      xterm.write(`\r\n\x1b[31mDetails: ${JSON.stringify(error)}\x1b[0m\r\n`);
      xterm.write('\r\n\x1b[33mTip: Try refreshing the page or restarting the application\x1b[0m\r\n');
      
      // Still allow input for Claude commands even if terminal fails
      setIsReady(true);
    });

    const outputUnsubscribe = window.mythalAPI.terminal.onOutput(terminalId, (data: string) => {
      xterm.write(data);
    });

    const exitUnsubscribe = window.mythalAPI.terminal.onExit(terminalId, (data: any) => {
      xterm.write(`\r\n[Process exited with code ${data.exitCode}]\r\n`);
    });

    // Claude output listeners for streaming responses
    const claudeOutputUnsubscribes = Object.keys(claudeInstances).map(instanceKey => {
      return window.mythalAPI.claude.onOutput(instanceKey, (data: string) => {
        // Track AI responses in conversation history
        setConversationHistory(prev => [...prev, {
          role: 'assistant',
          content: data,
          timestamp: new Date()
        }]);
        
        // Format Claude response with proper styling
        xterm.write('\r\n🤖 Claude Response:\r\n');
        xterm.write('\x1b[32m'); // Green color for response
        
        // Split response into lines for better formatting
        const lines = data.split('\n');
        lines.forEach((line, index) => {
          if (line.trim()) {
            xterm.write('  ' + line);
            if (index < lines.length - 1) xterm.write('\r\n');
          }
        });
        
        xterm.write('\x1b[0m'); // Reset color
        xterm.write('\r\n\r\n');
      });
    });

    const claudeErrorUnsubscribes = Object.keys(claudeInstances).map(instanceKey => {
      return window.mythalAPI.claude.onError(instanceKey, (error: string) => {
        xterm.write('\r\n❌ Claude Error:\r\n');
        xterm.write('\x1b[31m'); // Red color for error
        xterm.write('  ' + error);
        xterm.write('\x1b[0m'); // Reset color
        xterm.write('\r\n\r\n');
      });
    });

    xterm.onData((data: string) => {
      // Direct pass-through when ready
      if (!isReady) {
        console.log('Terminal not ready, buffering:', data);
        return; // Just drop input if not ready (should be very brief)
      }

      // Handle Enter key (carriage return)
      if (data === '\r') {
        const command = currentLine.trim();
        console.log('Enter pressed, command:', command);
        
        if (isSpecialCommand(command)) {
          handleSpecialCommand(command);
          setCurrentLine('');
          return;
        }
        
        if (isClaudeCommand(command)) {
          handleClaudeCommand(command);
          setCurrentLine('');
          return;
        }
        
        // Regular shell command - pass through
        setCurrentLine('');
        window.mythalAPI.terminal.write(terminalId, data).catch((err: any) => {
          console.error('Failed to write to terminal:', err);
        });
        return;
      }

      // Handle backspace
      if (data === '\x7f') {
        if (currentLine.length > 0) {
          setCurrentLine(prev => prev.slice(0, -1));
        }
        window.mythalAPI.terminal.write(terminalId, data);
        return;
      }

      // Handle Ctrl+C
      if (data === '\x03') {
        setCurrentLine('');
        window.mythalAPI.terminal.write(terminalId, data);
        return;
      }

      // Handle arrow keys for history
      if (data === '\x1b[A') { // Up arrow
        if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
          const newIndex = historyIndex + 1;
          const cmd = commandHistory[commandHistory.length - 1 - newIndex];
          setHistoryIndex(newIndex);
          
          // Clear current line and write historical command
          xterm.write('\r\x1b[K');
          xterm.write('$ ' + cmd);
          setCurrentLine(cmd);
        }
        return;
      }

      if (data === '\x1b[B') { // Down arrow
        if (historyIndex > -1) {
          const newIndex = historyIndex - 1;
          if (newIndex === -1) {
            setHistoryIndex(-1);
            xterm.write('\r\x1b[K$ ');
            setCurrentLine('');
          } else {
            const cmd = commandHistory[commandHistory.length - 1 - newIndex];
            setHistoryIndex(newIndex);
            xterm.write('\r\x1b[K$ ' + cmd);
            setCurrentLine(cmd);
          }
        }
        return;
      }

      // Regular character input
      if (data >= ' ' || data === '\t') {
        setCurrentLine(prev => prev + data);
        setHistoryIndex(-1);
      }

      // Pass all input to pty (for display and shell handling)
      console.log('Writing to terminal:', data.charCodeAt(0), 'char:', data);
      window.mythalAPI.terminal.write(terminalId, data).then((result) => {
        console.log('Write result:', result);
      }).catch((err: any) => {
        console.error('Failed to write character to terminal:', err);
      });
    });

    xterm.onResize(({ cols, rows }) => {
      if (isReady) {
        window.mythalAPI.terminal.resize(terminalId, cols, rows);
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };

    window.addEventListener('resize', handleResize);

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
            }
            break;
          case 'V':
            e.preventDefault();
            navigator.clipboard.readText().then(text => {
              xterm.paste(text);
            });
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Handle window focus to refocus terminal
    const handleWindowFocus = () => {
      requestAnimationFrame(() => {
        if (xtermRef.current && isReady) {
          xtermRef.current.focus();
          console.log('Terminal refocused on window focus');
        }
      });
    };
    
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      // Clear any remaining buffered input
      setInputBuffer([]);
      
      // Clean up event listeners first
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', handleWindowFocus);
      
      // Clean up IPC listeners
      outputUnsubscribe();
      exitUnsubscribe();
      claudeOutputUnsubscribes.forEach(unsub => unsub());
      claudeErrorUnsubscribes.forEach(unsub => unsub());
      
      // Destroy terminal and xterm instance
      window.mythalAPI.terminal.destroy(terminalId).catch((err: any) => {
        console.warn('Failed to destroy terminal:', err);
      });
      
      if (xterm) {
        xterm.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (isReady && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isReady]);

  // Consolidated focus management
  useEffect(() => {
    if (xtermRef.current && isReady) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (xtermRef.current) {
          xtermRef.current.focus();
          console.log('Terminal focused via useEffect');
        }
      });
    }
  }, [isReady]);
  
  // Note: Window focus handler is already added in the main useEffect

  const handleContainerClick = () => {
    if (xtermRef.current) {
      requestAnimationFrame(() => {
        if (xtermRef.current) {
          xtermRef.current.focus();
          console.log('Terminal focused via container click');
        }
      });
    }
  };

  return (
    <div className="h-full w-full bg-gray-900 p-2" onClick={handleContainerClick}>
      {terminalError && (
        <div className="mb-2 p-2 bg-red-900 text-red-200 text-xs rounded">
          ⚠️ Terminal Error: {terminalError}
        </div>
      )}
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default Terminal;