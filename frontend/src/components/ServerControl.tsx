import React, { useState } from 'react';

const ServerControl: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);

  const restartCommands = [
    { label: 'Frontend', command: 'npm start' },
    { label: 'Firebase Functions', command: 'firebase emulators:start' },
    { label: 'Deploy Rules', command: 'firebase deploy --only firestore:rules' }
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Restart Servers</h3>
        <span className="text-xs text-gray-600">Click to copy command</span>
      </div>
      <div className="space-y-2">
        {restartCommands.map(({ label, command }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700 w-24">{label}:</span>
            <code 
              onClick={() => copyToClipboard(command, label)}
              className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded text-xs font-mono text-gray-800 cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors select-all"
              title="Click to copy"
            >
              {command}
            </code>
            {copied === label && (
              <span className="text-xs text-green-600 font-medium">✓ Copied!</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServerControl;
