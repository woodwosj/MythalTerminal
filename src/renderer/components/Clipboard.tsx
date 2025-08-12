import React, { useEffect, useState, useRef, useCallback } from 'react';
import useClipboardStore, { ClipboardEntry, ContentType } from '../stores/clipboardStore';
import clsx from 'clsx';

interface ClipboardProps {
  projectPath: string;
}

const Clipboard: React.FC<ClipboardProps> = ({ projectPath }) => {
  const {
    entries,
    currentContent,
    searchQuery,
    selectedCategory,
    selectedTags,
    isLoading,
    lastSaveTime,
    setCurrentContent,
    addEntry,
    deleteEntry,
    setSearchQuery,
    setSelectedCategory,
    toggleTag,
    loadEntries,
    getFilteredEntries,
    incrementFrequency,
  } = useClipboardStore();

  const [isPasting, setIsPasting] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load entries on mount
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Auto-detect paste events - properly handle paste data
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (document.activeElement === textareaRef.current && e.clipboardData) {
        e.preventDefault(); // Prevent default paste to handle it ourselves
        
        // Get pasted content directly from clipboard data
        const pastedText = e.clipboardData.getData('text/plain');
        if (pastedText) {
          setIsPasting(true);
          
          // Update content with paste flag
          const currentValue = textareaRef.current?.value || '';
          const selectionStart = textareaRef.current?.selectionStart || currentValue.length;
          const selectionEnd = textareaRef.current?.selectionEnd || currentValue.length;
          
          // Insert pasted text at cursor position
          const newContent = 
            currentValue.substring(0, selectionStart) +
            pastedText +
            currentValue.substring(selectionEnd);
          
          // Update store with paste flag
          setCurrentContent(newContent, true);
          
          // Update textarea value
          if (textareaRef.current) {
            textareaRef.current.value = newContent;
            // Restore cursor position after paste
            const newCursorPos = selectionStart + pastedText.length;
            textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
          
          // Clear pasting indicator after animation
          setTimeout(() => setIsPasting(false), 500);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [setCurrentContent]);

  const handleAddEntry = async () => {
    if (currentContent.trim()) {
      await addEntry(currentContent);
      // Clear the textarea after saving
      if (textareaRef.current) {
        textareaRef.current.value = '';
      }
    }
  };

  // Handle textarea blur - save manual typing on blur
  const handleTextareaBlur = () => {
    // Only save on blur if not a paste event and has content
    const store = useClipboardStore.getState();
    if (!store.isPasteEvent && currentContent.trim()) {
      handleAddEntry();
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // Handle dropped text
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText) {
      setCurrentContent(droppedText, true); // Mark as paste-like event
      if (textareaRef.current) {
        textareaRef.current.value = droppedText;
      }
    }
    
    // Handle dropped files
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('text/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            setCurrentContent(content, true); // Mark as paste-like event
            if (textareaRef.current) {
              textareaRef.current.value = content;
            }
          }
        };
        reader.readAsText(file);
      }
    }
  };

  const handleCopyToClipboard = useCallback((entry: ClipboardEntry) => {
    navigator.clipboard.writeText(entry.content);
    incrementFrequency(entry.id);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, [incrementFrequency]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAddEntry();
    }
  };

  const filteredEntries = getFilteredEntries();

  // Get all unique tags from entries
  const allTags = Array.from(new Set(entries.flatMap(e => e.tags))).sort();

  // Get category counts
  const categoryCounts = entries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case 'url': return '🔗';
      case 'code': return '💻';
      case 'json': return '📋';
      case 'markdown': return '📝';
      case 'shell': return '🖥️';
      case 'command': return '⚡';
      default: return '📄';
    }
  };

  const getContentTypeColor = (type: ContentType) => {
    switch (type) {
      case 'url': return 'text-blue-400';
      case 'code': return 'text-green-400';
      case 'json': return 'text-yellow-400';
      case 'markdown': return 'text-purple-400';
      case 'shell': return 'text-cyan-400';
      case 'command': return 'text-orange-400';
      default: return 'text-gray-400';
    }
  };

  const formatContent = (entry: ClipboardEntry) => {
    if (entry.type === 'url') {
      return (
        <a 
          href={entry.content} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {entry.content}
        </a>
      );
    }

    if (entry.type === 'code' || entry.type === 'json' || entry.type === 'shell' || entry.type === 'command') {
      return (
        <pre className="text-sm font-mono whitespace-pre-wrap break-all bg-gray-800 p-2 rounded">
          <code className={clsx(
            entry.metadata.language === 'javascript' && 'text-yellow-300',
            entry.metadata.language === 'typescript' && 'text-blue-300',
            entry.metadata.language === 'python' && 'text-green-300',
            entry.metadata.language === 'sql' && 'text-purple-300',
          )}>
            {entry.content}
          </code>
        </pre>
      );
    }

    return (
      <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
        {entry.content}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header with auto-save indicator */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">✨ Dynamic Clipboard</h2>
            <p className="text-xs text-gray-400 mt-1">
              Paste anything - auto-saved & indexed instantly
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {lastSaveTime && (
              <span className="text-xs text-green-400 animate-pulse">
                ✓ Saved
              </span>
            )}
            {isPasting && (
              <span className="text-xs text-blue-400 animate-bounce">
                📋 Auto-saving paste...
              </span>
            )}
            {isDragging && (
              <span className="text-xs text-green-400 animate-pulse">
                📥 Drop files or text here
              </span>
            )}
            <button
              onClick={() => setShowStats(!showStats)}
              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              📊 {entries.length} items
            </button>
          </div>
        </div>
      </div>

      {/* Smart Paste Area */}
      <div className="px-4 py-3 bg-gradient-to-b from-gray-800 to-gray-850 border-b border-gray-700">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={currentContent}
            onChange={(e) => setCurrentContent(e.target.value, false)} // Mark as manual typing
            onKeyDown={handleKeyDown}
            onBlur={handleTextareaBlur}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            placeholder="Paste, drop, or type anything here... (Cmd/Ctrl+Enter to save manually)"
            className={clsx(
              "w-full px-3 py-2 bg-gray-700/50 text-white rounded-lg",
              "border-2 transition-all duration-200 resize-none",
              "focus:outline-none focus:bg-gray-700",
              isDragging ? "border-green-500 ring-2 ring-green-500/30 bg-green-900/20" :
              isPasting ? "border-blue-500 ring-2 ring-blue-500/30" : "border-gray-600 focus:border-blue-500"
            )}
            rows={3}
          />
          {currentContent && (
            <div className="absolute top-2 right-2 flex items-center space-x-1">
              <span className={clsx("text-xs px-2 py-1 rounded", getContentTypeColor(useClipboardStore.getState().detectContentType(currentContent)))}>
                {getContentTypeIcon(useClipboardStore.getState().detectContentType(currentContent))} {useClipboardStore.getState().detectContentType(currentContent)}
              </span>
            </div>
          )}
        </div>
        {currentContent && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {currentContent.length} chars • {currentContent.split('\n').length} lines
            </div>
            <button
              onClick={handleAddEntry}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              💾 Save Now
            </button>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 space-y-2">
        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search all clips..."
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
        
        {/* Categories */}
        <div className="flex items-center space-x-2 overflow-x-auto">
          <span className="text-xs text-gray-400">Categories:</span>
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              "px-2 py-1 text-xs rounded transition-colors",
              !selectedCategory ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600"
            )}
          >
            All ({entries.length})
          </button>
          {Object.entries(categoryCounts).map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={clsx(
                "px-2 py-1 text-xs rounded transition-colors whitespace-nowrap",
                selectedCategory === cat ? "bg-blue-600 text-white" : "bg-gray-700 hover:bg-gray-600"
              )}
            >
              {cat} ({count})
            </button>
          ))}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto">
            <span className="text-xs text-gray-400">Tags:</span>
            <div className="flex space-x-1">
              {allTags.slice(0, 10).map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={clsx(
                    "px-2 py-1 text-xs rounded transition-colors",
                    selectedTags.includes(tag) ? "bg-purple-600 text-white" : "bg-gray-700 hover:bg-gray-600"
                  )}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats Panel */}
      {showStats && (
        <div className="px-4 py-2 bg-gray-850 border-b border-gray-700">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Total Items:</span> {entries.length}
            </div>
            <div>
              <span className="text-gray-400">Categories:</span> {Object.keys(categoryCounts).length}
            </div>
            <div>
              <span className="text-gray-400">Tags:</span> {allTags.length}
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">📋 {searchQuery || selectedCategory || selectedTags.length ? 'No matching clips' : 'No clips yet'}</p>
            <p className="text-sm">
              {searchQuery || selectedCategory || selectedTags.length 
                ? 'Try adjusting your filters' 
                : 'Paste something above to get started - it auto-saves!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className={clsx(
                  "group p-3 bg-gray-800 rounded-lg border transition-all duration-200 cursor-pointer",
                  "hover:bg-gray-750 hover:border-gray-600",
                  copiedId === entry.id ? "border-green-500 bg-green-900/20" : "border-gray-700"
                )}
                onClick={() => handleCopyToClipboard(entry)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={clsx("text-lg", getContentTypeColor(entry.type))}>
                      {getContentTypeIcon(entry.type)}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                      {entry.category}
                    </span>
                    {entry.metadata.frequency > 0 && (
                      <span className="text-xs text-yellow-400">
                        ⭐ {entry.metadata.frequency}
                      </span>
                    )}
                    {entry.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-blue-900/50 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEntry(entry.id);
                      }}
                      className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 rounded transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="mb-2">
                  {formatContent(entry)}
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{entry.metadata.length} chars • {entry.metadata.lines} lines</span>
                  <span>{new Date(entry.metadata.timestamp).toLocaleString()}</span>
                </div>
                
                {copiedId === entry.id && (
                  <div className="mt-2 text-xs text-green-400 animate-pulse">
                    ✓ Copied to clipboard!
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Clipboard;