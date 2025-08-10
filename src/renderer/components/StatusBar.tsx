import React, { useEffect, useState } from 'react';
import { useContextStore } from '../stores/contextStore';

const StatusBar: React.FC = () => {
  const { totalTokens, maxTokens, starredTokens, activeTokens, referenceTokens, archiveTokens } = useContextStore();
  const [claudeStatuses, setClaudeStatuses] = useState<Record<string, string>>({});
  
  const percentage = (totalTokens / maxTokens) * 100;
  const warningLevel = percentage < 70 ? 'safe' : percentage < 90 ? 'warning' : 'critical';

  useEffect(() => {
    const updateStatuses = async () => {
      const statuses = await window.mythalAPI.claude.status();
      setClaudeStatuses(statuses);
    };

    updateStatuses();
    const interval = setInterval(updateStatuses, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.mythalAPI.tokens.record(totalTokens, undefined, percentage, warningLevel);
  }, [totalTokens, percentage, warningLevel]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-400';
      case 'idle': return 'text-gray-400';
      case 'crashed': return 'text-red-400';
      case 'restarting': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getWarningColor = () => {
    switch (warningLevel) {
      case 'safe': return 'bg-green-600';
      case 'warning': return 'bg-yellow-600';
      case 'critical': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Context:</span>
          <span className={`font-mono ${warningLevel === 'critical' ? 'text-red-400' : 'text-gray-200'}`}>
            {totalTokens.toLocaleString()}/{maxTokens.toLocaleString()} tokens ({percentage.toFixed(1)}%)
          </span>
        </div>
        
        <div className="w-48 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-yellow-500" 
              style={{ width: `${(starredTokens / maxTokens) * 100}%` }}
              title={`⭐ Core: ${starredTokens.toLocaleString()} tokens`}
            />
            <div 
              className="bg-blue-500" 
              style={{ width: `${(activeTokens / maxTokens) * 100}%` }}
              title={`Active: ${activeTokens.toLocaleString()} tokens`}
            />
            <div 
              className="bg-purple-500" 
              style={{ width: `${(referenceTokens / maxTokens) * 100}%` }}
              title={`Reference: ${referenceTokens.toLocaleString()} tokens`}
            />
            <div 
              className="bg-gray-500" 
              style={{ width: `${(archiveTokens / maxTokens) * 100}%` }}
              title={`Archive: ${archiveTokens.toLocaleString()} tokens`}
            />
          </div>
        </div>

        <div className="flex items-center space-x-1 text-[10px]">
          <span className="text-yellow-400">⭐ {(starredTokens / 1000).toFixed(1)}k</span>
          <span className="text-gray-400">|</span>
          <span className="text-blue-400">Active: {(activeTokens / 1000).toFixed(1)}k</span>
          <span className="text-gray-400">|</span>
          <span className="text-purple-400">Ref: {(referenceTokens / 1000).toFixed(1)}k</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">Arc: {(archiveTokens / 1000).toFixed(1)}k</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="text-gray-400">Claude Instances:</span>
          {Object.entries(claudeStatuses).map(([key, status]) => (
            <span key={key} className={`${getStatusColor(status)}`} title={`${key}: ${status}`}>
              {key === 'main' && '💻'}
              {key === 'contextManager' && '📊'}
              {key === 'summarizer' && '📝'}
              {key === 'planner' && '📋'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatusBar;