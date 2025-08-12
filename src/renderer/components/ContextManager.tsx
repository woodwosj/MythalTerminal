import React, { useState, useEffect } from 'react';
import { 
  useContextStore, 
  formatTokenCount, 
  getTokenUsageColor, 
  getTokenUsageBackground 
} from '../stores/contextStore';
import { generateResumeWorkContent, type ProjectState, type ConPortData } from '../../shared/resumeWorkGenerator';

interface ContextManagerProps {
  projectPath: string;
}

const ContextManager: React.FC<ContextManagerProps> = ({ projectPath }) => {
  const { 
    layers, 
    totalTokens,
    tokenUsage,
    loadContext, 
    toggleStar, 
    deleteLayer,
    updateLayer,
    promoteLayer,
    demoteLayer,
    archiveLayer,
    autoPrune,
    getSuggestedArchives,
    getSuggestedPromotions,
    recalculateActualTokens,
    searchSimilarContext,
    getRelatedConversations,
    syncWithConPort
  } = useContextStore();
  
  const [selectedLayers, setSelectedLayers] = useState<Set<number>>(new Set());
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeneratingResume, setIsGeneratingResume] = useState(false);
  const [pruningInProgress, setPruningInProgress] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLayerRelated, setSelectedLayerRelated] = useState<{layerId: number; related: any[]} | undefined>();

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
  
  const handleGenerateResumeWork = async () => {
    setIsGeneratingResume(true);
    try {
      const result = await window.mythalAPI.resumework.generate(projectPath);
      if (result.success) {
        // For now, just log the result - in full implementation would write to file
        console.log('Generated RESUMEWORK.md data:', result.projectState);
        alert('RESUMEWORK.md data generated! Check console for details.');
      }
    } catch (error) {
      console.error('Failed to generate RESUMEWORK.md:', error);
    }
    setIsGeneratingResume(false);
  };
  
  const handlePromoteLayer = async (id: number, targetType: 'core' | 'active' | 'reference') => {
    await promoteLayer(id, targetType);
  };
  
  const handleDemoteLayer = async (id: number) => {
    await demoteLayer(id);
  };
  
  const handleArchiveLayer = async (id: number) => {
    if (confirm('Archive this context layer? It will be moved to searchable archive.')) {
      await archiveLayer(id, 'manual-archive');
    }
  };
  
  const handleAutoPrune = async () => {
    if (confirm(`Auto-prune context layers to reduce token usage? This will archive least-used layers.`)) {
      setPruningInProgress(true);
      try {
        const prunedLayers = await autoPrune(0.7); // Target 70% of max tokens
        alert(`Pruned ${prunedLayers.length} layers to optimize context usage.`);
      } catch (error) {
        console.error('Auto-pruning failed:', error);
      }
      setPruningInProgress(false);
    }
  };
  
  const handleRecalculateTokens = async () => {
    await recalculateActualTokens();
  };
  
  const suggestedArchives = getSuggestedArchives();
  const suggestedPromotions = getSuggestedPromotions();
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await searchSimilarContext(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setIsSearching(false);
  };
  
  const handleShowRelated = async (layerId: number) => {
    try {
      const related = await getRelatedConversations(layerId);
      setSelectedLayerRelated({ layerId, related });
    } catch (error) {
      console.error('Failed to get related conversations:', error);
    }
  };
  
  const handleSyncWithConPort = async () => {
    if (confirm('Sync all context layers with ConPort knowledge base? This will enable semantic search across all your project data.')) {
      try {
        await syncWithConPort();
        alert('Successfully synced with ConPort! Context layers are now searchable in the knowledge base.');
      } catch (error) {
        console.error('ConPort sync failed:', error);
        alert('Sync failed. Check console for details.');
      }
    }
  };
  
  // Clear search when query is empty
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
    }
  }, [searchQuery]);

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
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold">Context Manager</h2>
          <div className="flex items-center space-x-2 text-sm">
            <div className={`flex items-center space-x-1 ${getTokenUsageColor(tokenUsage.warningLevel)}`}>
              <span>{formatTokenCount(totalTokens)}</span>
              <span>/</span>
              <span>{formatTokenCount(200000)}</span>
              <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getTokenUsageBackground(tokenUsage.warningLevel)} transition-all duration-300`}
                  style={{ width: `${Math.min(100, tokenUsage.percentage * 100)}%` }}
                />
              </div>
              <span className="text-xs">({Math.round(tokenUsage.percentage * 100)}%)</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              showSuggestions ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={`${suggestedArchives.length} archive suggestions, ${suggestedPromotions.length} promotion suggestions`}
          >
            💡 Suggestions ({suggestedArchives.length + suggestedPromotions.length})
          </button>
          <button
            onClick={handleGenerateSummary}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            📋 Summary
          </button>
          <button
            onClick={handleGenerateResumeWork}
            disabled={isGeneratingResume}
            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded transition-colors disabled:opacity-50"
            title="Generate RESUMEWORK.md with current context"
          >
            {isGeneratingResume ? '⏳ Generating...' : '📄 RESUMEWORK.md'}
          </button>
          <button
            onClick={handleAutoPrune}
            disabled={pruningInProgress || tokenUsage.warningLevel === 'safe'}
            className={`px-3 py-1 text-sm rounded transition-colors disabled:opacity-50 ${
              tokenUsage.warningLevel === 'critical' ? 'bg-red-600 hover:bg-red-700' :
              tokenUsage.warningLevel === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
              'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {pruningInProgress ? '🔄 Pruning...' : '🧹 Auto-Prune'}
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={selectedLayers.size === 0}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🗑️ Delete ({selectedLayers.size})
          </button>
        </div>
      </div>

      {/* Search Interface */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="🔍 Search context layers semantically..."
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
          >
            {isSearching ? '🔍 Searching...' : '🔍 Search'}
          </button>
          <button
            onClick={handleSyncWithConPort}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
            title="Sync with ConPort knowledge base"
          >
            🔄 ConPort
          </button>
        </div>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-3">
            <p className="text-sm text-gray-400 mb-2">Found {searchResults.length} relevant context layers:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div key={result.id} className="text-xs p-2 bg-blue-900/20 rounded border-l-2 border-blue-500">
                  <div className="font-semibold">{getLayerIcon(result.layer_type)} {result.layer_type} #{result.id}</div>
                  <div className="text-gray-400 truncate">{result.content.substring(0, 100)}...</div>
                  <div className="text-blue-400">Relevance: {(result.relevanceScore * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
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
      
      {/* Related Conversations Panel */}
      {selectedLayerRelated && (
        <div className="px-4 py-2 bg-indigo-900/20 border-b border-indigo-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-indigo-300">🔗 Related to Layer #{selectedLayerRelated.layerId}</h3>
            <button
              onClick={() => setSelectedLayerRelated(undefined)}
              className="text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          {selectedLayerRelated.related.length > 0 ? (
            <div className="space-y-1 text-xs">
              {selectedLayerRelated.related.map((related) => (
                <div key={related.id} className="p-2 bg-indigo-900/10 rounded">
                  <span className="font-medium">{getLayerIcon(related.layer_type)} {related.layer_type} #{related.id}</span>
                  <div className="text-gray-400 truncate mt-1">{related.content.substring(0, 80)}...</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No related conversations found.</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {showSuggestions && (suggestedArchives.length > 0 || suggestedPromotions.length > 0) && (
          <div className="px-4 py-3 bg-purple-900/20 border-b border-purple-700">
            <h3 className="text-sm font-semibold text-purple-300 mb-2">💡 AI Suggestions</h3>
            {suggestedArchives.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-purple-400 mb-1">📦 Suggested for archiving (old/unused):</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedArchives.slice(0, 3).map(layer => (
                    <button
                      key={layer.id}
                      onClick={() => handleArchiveLayer(layer.id!)}
                      className="text-xs px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded"
                    >
                      Archive #{layer.id} ({layer.layer_type})
                    </button>
                  ))}
                </div>
              </div>
            )}
            {suggestedPromotions.length > 0 && (
              <div>
                <p className="text-xs text-purple-400 mb-1">⬆️ Suggested for promotion (frequently used):</p>
                <div className="flex flex-wrap gap-1">
                  {suggestedPromotions.slice(0, 3).map(layer => (
                    <button
                      key={layer.id}
                      onClick={() => handlePromoteLayer(layer.id!, 'active')}
                      className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 rounded"
                    >
                      Promote #{layer.id} to Active
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
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
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{getLayerIcon(layer.layer_type)}</span>
                      <span className="font-semibold capitalize">{layer.layer_type}</span>
                      <span className={`text-sm px-2 py-0.5 rounded text-xs ${
                        layer.layer_type === 'core' ? 'bg-yellow-900 text-yellow-200' :
                        layer.layer_type === 'active' ? 'bg-blue-900 text-blue-200' :
                        layer.layer_type === 'reference' ? 'bg-purple-900 text-purple-200' :
                        'bg-gray-900 text-gray-200'
                      }`}>
                        {formatTokenCount(layer.actual_tokens || layer.tokens)} tokens
                      </span>
                      {layer.is_starred && <span className="text-yellow-400" title="Starred - Never auto-pruned">⭐</span>}
                      {layer.is_immutable && <span className="text-blue-400" title="Immutable - Protected from changes">🔒</span>}
                      {layer.access_count && layer.access_count > 5 && (
                        <span className="text-green-400 text-xs" title={`Accessed ${layer.access_count} times`}>🔥</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 line-clamp-2 mb-2">
                      {layer.content.substring(0, 200)}{layer.content.length > 200 ? '...' : ''}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        Source: {layer.source} | Created: {new Date(layer.created_at!).toLocaleDateString()}
                        {layer.last_accessed && ` | Last used: ${new Date(layer.last_accessed).toLocaleDateString()}`}
                      </div>
                      <div className="flex items-center space-x-1">
                        {/* Layer management controls */}
                        {layer.layer_type !== 'core' && (
                          <button
                            onClick={() => handlePromoteLayer(layer.id!, 'core')}
                            className="text-xs px-2 py-1 bg-yellow-700 hover:bg-yellow-600 rounded"
                            title="Promote to Core (starred, never pruned)"
                          >
                            ⭐ Core
                          </button>
                        )}
                        {layer.layer_type !== 'active' && layer.layer_type !== 'core' && (
                          <button
                            onClick={() => handlePromoteLayer(layer.id!, 'active')}
                            className="text-xs px-2 py-1 bg-blue-700 hover:bg-blue-600 rounded"
                            title="Promote to Active context"
                          >
                            🔵 Active
                          </button>
                        )}
                        {layer.layer_type === 'active' && (
                          <button
                            onClick={() => handleDemoteLayer(layer.id!)}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
                            title="Demote based on usage"
                          >
                            ⬇️ Demote
                          </button>
                        )}
                        {layer.layer_type !== 'archive' && (
                          <button
                            onClick={() => handleArchiveLayer(layer.id!)}
                            className="text-xs px-2 py-1 bg-orange-700 hover:bg-orange-600 rounded"
                            title="Archive this layer"
                          >
                            📦 Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleShowRelated(layer.id!)}
                          className="text-xs px-2 py-1 bg-indigo-700 hover:bg-indigo-600 rounded"
                          title="Show related conversations"
                        >
                          🔗 Related
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
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
        
        {/* Footer with additional controls */}
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span>Total Layers: {layers.length}</span>
              <span>Context Tokens: {formatTokenCount(totalTokens)}</span>
              <button
                onClick={() => setShowTokenDetails(!showTokenDetails)}
                className="hover:text-gray-200 underline"
              >
                {showTokenDetails ? 'Hide' : 'Show'} Token Details
              </button>
              <button
                onClick={handleRecalculateTokens}
                className="hover:text-gray-200 underline"
              >
                🔄 Recalculate Tokens
              </button>
            </div>
            <div className="text-right">
              Usage: {tokenUsage.warningLevel.toUpperCase()} ({Math.round(tokenUsage.percentage * 100)}%)
            </div>
          </div>
          {showTokenDetails && (
            <div className="mt-2 pt-2 border-t border-gray-700 grid grid-cols-4 gap-4 text-xs">
              <div>Core: {formatTokenCount(layers.filter(l => l.layer_type === 'core').reduce((sum, l) => sum + (l.actual_tokens || l.tokens), 0))}</div>
              <div>Active: {formatTokenCount(layers.filter(l => l.layer_type === 'active').reduce((sum, l) => sum + (l.actual_tokens || l.tokens), 0))}</div>
              <div>Reference: {formatTokenCount(layers.filter(l => l.layer_type === 'reference').reduce((sum, l) => sum + (l.actual_tokens || l.tokens), 0))}</div>
              <div>Archive: {formatTokenCount(layers.filter(l => l.layer_type === 'archive').reduce((sum, l) => sum + (l.actual_tokens || l.tokens), 0))}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextManager;