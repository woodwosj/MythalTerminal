import React, { useState, useEffect } from 'react';
import Terminal from './components/Terminal';
import StatusBar from './components/StatusBar';
import ContextManager from './components/ContextManager';
import { useTerminalStore } from './stores/terminalStore';
import { useContextStore } from './stores/contextStore';

function App() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'context' | 'clipboard' | 'planner'>('terminal');
  const [projectPath, setProjectPath] = useState(process.cwd());
  const { initializeClaude } = useTerminalStore();
  const { loadContext } = useContextStore();

  useEffect(() => {
    initializeClaude();
    loadContext(projectPath);
  }, []);

  const handleRefresh = async () => {
    const resumework = await window.mythalAPI.resumework.get(projectPath);
    const contexts = await window.mythalAPI.context.get(projectPath);
    
    console.log('Refreshing with context:', { resumework, contexts });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
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
          <button className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors">
            ⚙️ Settings
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'terminal' && <Terminal />}
        {activeTab === 'context' && <ContextManager projectPath={projectPath} />}
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
    </div>
  );
}

export default App;