import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId] = useState(() => `terminal-${Date.now()}`);
  const [isReady, setIsReady] = useState(false);

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

    window.mythalAPI.terminal.create(terminalId).then(() => {
      setIsReady(true);
    });

    const outputUnsubscribe = window.mythalAPI.terminal.onOutput(terminalId, (data: string) => {
      xterm.write(data);
    });

    const exitUnsubscribe = window.mythalAPI.terminal.onExit(terminalId, (data: any) => {
      xterm.write(`\r\n[Process exited with code ${data.exitCode}]\r\n`);
    });

    xterm.onData((data: string) => {
      if (isReady) {
        window.mythalAPI.terminal.write(terminalId, data);
      }
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

    return () => {
      outputUnsubscribe();
      exitUnsubscribe();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
      window.mythalAPI.terminal.destroy(terminalId);
      xterm.dispose();
    };
  }, []);

  useEffect(() => {
    if (isReady && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isReady]);

  return (
    <div className="h-full w-full bg-gray-900 p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
};

export default Terminal;