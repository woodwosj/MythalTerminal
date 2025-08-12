import React, { useState, useEffect } from 'react';

interface ClipboardEntry {
  id: number;
  content: string;
  category?: string;
  tags?: string[];
  created_at: Date;
}

interface ClipboardProps {
  projectPath: string;
}

const Clipboard: React.FC<ClipboardProps> = ({ projectPath }) => {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [newEntry, setNewEntry] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [tags, setTags] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadClipboardEntries();
  }, []);

  const loadClipboardEntries = async () => {
    try {
      const result = await window.mythalAPI.clipboard.get();
      if (result.success) {
        setEntries(result.entries || []);
      }
    } catch (error) {
      console.error('Failed to load clipboard entries:', error);
    }
  };

  const handleSave = async () => {
    if (!newEntry.trim()) return;

    try {
      const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      const result = await window.mythalAPI.clipboard.save(
        newEntry,
        selectedCategory,
        tagArray
      );
      
      if (result.success) {
        await loadClipboardEntries();
        setNewEntry('');
        setTags('');
      }
    } catch (error) {
      console.error('Failed to save clipboard entry:', error);
    }
  };

  const handleCopyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const filteredEntries = entries.filter(entry => 
    !searchQuery || 
    entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h2 className="text-lg font-semibold">💾 Clipboard Manager</h2>
        <p className="text-xs text-gray-400 mt-1">Save and organize code snippets and notes</p>
      </div>

      {/* Input Section */}
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-700">
        <textarea
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          placeholder="Paste or type content to save..."
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
          rows={4}
        />
        
        <div className="flex items-center space-x-2 mt-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="general">General</option>
            <option value="code">Code</option>
            <option value="commands">Commands</option>
            <option value="notes">Notes</option>
            <option value="snippets">Snippets</option>
          </select>
          
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="flex-1 px-3 py-1 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
          
          <button
            onClick={handleSave}
            disabled={!newEntry.trim()}
            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
          >
            💾 Save
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search clipboard entries..."
          className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {filteredEntries.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">📋 No clipboard entries yet</p>
            <p className="text-sm">Save your first snippet using the form above</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="p-3 bg-gray-800 rounded border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                        {entry.category || 'general'}
                      </span>
                      {entry.tags?.map((tag, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-blue-900 rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                      {entry.content}
                    </pre>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(entry.content)}
                    className="ml-2 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    title="Copy to clipboard"
                  >
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Clipboard;