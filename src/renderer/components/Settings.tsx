import React, { useState, useEffect } from 'react';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadApiKey();
    }
  }, [isOpen]);

  const loadApiKey = async () => {
    try {
      setIsLoading(true);
      const result = await window.mythalAPI.settings.getApiKey();
      if (result.success && result.apiKey) {
        // Show only last 4 characters for security
        const masked = '•'.repeat(Math.max(0, result.apiKey.length - 4)) + 
                      result.apiKey.slice(-4);
        setMaskedApiKey(masked);
        setApiKey(''); // Don't store full key in component state
      } else {
        setMaskedApiKey('');
      }
    } catch (err) {
      console.error('Error loading API key:', err);
      setError('Failed to load API key');
    } finally {
      setIsLoading(false);
    }
  };

  const validateApiKey = (key: string): boolean => {
    // Basic validation for Anthropic API key format
    return key.startsWith('sk-ant-') && key.length > 20;
  };

  const handleSave = async () => {
    setError('');
    setSuccess(false);

    if (!apiKey.trim()) {
      setError('API key cannot be empty');
      return;
    }

    if (!validateApiKey(apiKey)) {
      setError('Invalid API key format. Should start with "sk-ant-"');
      return;
    }

    try {
      setIsLoading(true);
      const result = await window.mythalAPI.settings.setApiKey(apiKey);
      
      if (result.success) {
        setSuccess(true);
        setIsEditing(false);
        setApiKey('');
        await loadApiKey(); // Refresh the masked display
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to save API key');
      }
    } catch (err) {
      console.error('Error saving API key:', err);
      setError('Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete the API key? This will disable Claude functionality.')) {
      return;
    }

    try {
      setIsLoading(true);
      const result = await window.mythalAPI.settings.deleteApiKey();
      
      if (result.success) {
        setMaskedApiKey('');
        setApiKey('');
        setSuccess(true);
        setIsEditing(false);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error || 'Failed to delete API key');
      }
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError('Failed to delete API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setApiKey('');
    setIsEditing(false);
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    handleCancel();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-96 max-w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Anthropic API Key
            </label>
            
            {!isEditing && maskedApiKey ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={maskedApiKey}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-300 font-mono text-sm"
                />
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your API key is stored securely and never exposed in the renderer process
                </p>
              </div>
            )}

            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}

            {success && (
              <p className="mt-2 text-sm text-green-400">
                ✓ API key saved successfully
              </p>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2">How to get your API key:</h3>
            <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
              <li>Visit <a href="#" className="text-blue-400 hover:text-blue-300">console.anthropic.com</a></li>
              <li>Go to API Keys section</li>
              <li>Create a new API key</li>
              <li>Copy and paste it here</li>
            </ol>
          </div>

          {(isEditing || !maskedApiKey) && (
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;