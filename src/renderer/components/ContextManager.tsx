import React, { useState, useEffect } from 'react';
import { useContextStore } from '../stores/contextStore';

interface ContextManagerProps {
  projectPath: string;
}

const ContextManager: React.FC<ContextManagerProps> = ({ projectPath }) => {
  const { 
    layers, 
    loadContext, 
    toggleStar, 
    deleteLayer,
    updateLayer 
  } = useContextStore();
  
  const [selectedLayers, setSelectedLayers] = useState<Set<number>>(new Set());
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [expandedSummary, setExpandedSummary] = useState(false);

  useEffect(() => {
    loadContext(projectPath);
  }, [projectPath]);

  const handleToggleStar = async (id: number) => {
    await toggleStar(id);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this context block?')) {
      await deleteLayer(id);
    }
  };

  const handleSelectLayer = (id: number) => {
    const newSelected = new Set(selectedLayers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedLayers(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedLayers.size === 0) return;
    if (confirm(`Delete ${selectedLayers.size} selected context blocks?`)) {
      for (const id of selectedLayers) {
        await deleteLayer(id);
      }
      setSelectedLayers(new Set());
    }
  };

  const handleGenerateSummary = async () => {
    const contextContent = layers.map(l => l.content).join('\n\n');
    const result = await window.mythalAPI.claude.send('summarizer', contextContent);
    console.log('Summary result:', result);
  };

  const formatTokenCount = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  const getLayerIcon = (layerType: string) => {
    switch (layerType) {
      case 'core': return '⭐';
      case 'active': return '🔵';
      case 'reference': return '📚';
      case 'archive': return '📦';
      default: return '📄';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-200">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Context Manager</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleGenerateSummary}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            Generate Summary
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={selectedLayers.size === 0}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete Selected ({selectedLayers.size})
          </button>
        </div>
      </div>

      {executiveSummary && (
        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedSummary(!expandedSummary)}
          >
            <h3 className="text-sm font-semibold">Executive Summary</h3>
            <span>{expandedSummary ? '▼' : '▶'}</span>
          </div>
          {expandedSummary && (
            <div className="mt-2 text-sm text-gray-400">
              {executiveSummary}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {layers.map((layer) => (
            <div
              key={layer.id}
              className={`p-3 bg-gray-800 rounded border ${
                selectedLayers.has(layer.id!) ? 'border-blue-500' : 'border-gray-700'
              } hover:border-gray-600 transition-colors`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedLayers.has(layer.id!)}
                    onChange={() => handleSelectLayer(layer.id!)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getLayerIcon(layer.layer_type)}</span>
                      <span className="font-semibold">{layer.layer_type}</span>
                      <span className="text-sm text-gray-400">
                        ({formatTokenCount(layer.tokens)} tokens)
                      </span>
                      {layer.is_starred && <span className="text-yellow-400">⭐</span>}
                      {layer.is_immutable && <span className="text-blue-400">🔒</span>}
                    </div>
                    <div className="mt-1 text-sm text-gray-400 line-clamp-2">
                      {layer.content.substring(0, 200)}...
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Source: {layer.source} | Created: {new Date(layer.created_at!).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleToggleStar(layer.id!)}
                    className="p-1 hover:bg-gray-700 rounded"
                    title="Toggle star"
                  >
                    {layer.is_starred ? '⭐' : '☆'}
                  </button>
                  <button
                    onClick={() => handleDelete(layer.id!)}
                    className="p-1 hover:bg-gray-700 rounded text-red-400"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContextManager;