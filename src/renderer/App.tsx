import React, { useState, useEffect } from 'react';
import Terminal from './components/Terminal';
import TerminalFull from './components/TerminalFull';
import TerminalSimple from './components/TerminalSimple';
import TerminalTest from './components/TerminalTest';
import TerminalDebug from './components/TerminalDebug';
import StatusBar from './components/StatusBar';
import ContextManager from './components/ContextManager';
import Clipboard from './components/Clipboard';
import Planner from './components/Planner';
import Settings from './components/Settings';
import { useTerminalStore } from './stores/terminalStore';
import { useContextStore } from './stores/contextStore';

function App() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'context' | 'clipboard' | 'planner'>('terminal');
  const [projectPath, setProjectPath] = useState('/home/user/project');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const { initializeClaude } = useTerminalStore();
  const { loadContext } = useContextStore();

  useEffect(() => {
    initializeClaude();
    loadContext(projectPath);
    
    // Listen for in-memory warning
    const unsubscribeInMemory = window.mythalAPI.settings.onInMemoryWarning(() => {
      setWarningMessage('⚠️ Settings are running in memory-only mode. Your settings will not persist after closing the app.');
      setTimeout(() => setWarningMessage(null), 10000); // Hide after 10 seconds
    });
    
    // Listen for initialization errors
    const unsubscribeInitError = window.mythalAPI.app.onInitializationError((data) => {
      console.error('Initialization error:', data.message);
      setWarningMessage(`⚠️ Initialization Error: ${data.message}`);
      setTimeout(() => setWarningMessage(null), 15000); // Hide after 15 seconds
    });
    
    // Check if already in memory mode on startup
    window.mythalAPI.settings.isInMemoryMode().then(result => {
      if (result.success && result.inMemoryMode) {
        setWarningMessage('⚠️ Settings are running in memory-only mode. Your settings will not persist after closing the app.');
        setTimeout(() => setWarningMessage(null), 10000);
      }
    });
    
    return () => {
      unsubscribeInMemory();
      unsubscribeInitError();
    };
  }, []);

  const handleRefresh = async () => {
    const resumework = await window.mythalAPI.resumework.get(projectPath);
    const contexts = await window.mythalAPI.context.get(projectPath);
    
    console.log('Refreshing with context:', { resumework, contexts });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Warning Banner */}
      {warningMessage && (
        <div className="bg-yellow-600 text-white px-4 py-2 text-sm flex items-center justify-between">
          <span>{warningMessage}</span>
          <button 
            onClick={() => setWarningMessage(null)}
            className="ml-4 hover:bg-yellow-700 rounded px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}
      
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-400">📁 {projectPath}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            🔄 Refresh
          </button>
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && <TerminalFull />}
        {activeTab === 'context' && <ContextManager projectPath={projectPath} />}
        {activeTab === 'clipboard' && <Clipboard projectPath={projectPath} />}
        {activeTab === 'planner' && <Planner projectPath={projectPath} />}
      </div>

      <StatusBar />

      <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-gray-800 border-t border-gray-700">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-4 py-1 text-sm rounded transition-colors ${
            activeTab === 'terminal' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          💻 Terminal
        </button>
        <button
          onClick={() => setActiveTab('context')}
          className={`px-4 py-1 text-sm rounded transition-colors ${
            activeTab === 'context' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          📊 Context
        </button>
        <button
          onClick={() => setActiveTab('clipboard')}
          className={`px-4 py-1 text-sm rounded transition-colors ${
            activeTab === 'clipboard' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          💾 Clipboard
        </button>
        <button
          onClick={() => setActiveTab('planner')}
          className={`px-4 py-1 text-sm rounded transition-colors ${
            activeTab === 'planner' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          📋 Planner
        </button>
      </div>

      <Settings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}

export default App;