import { useState, useEffect } from 'react';

export default function ReadingEditorModal({ isOpen, onClose, onSave, reading }) {
  const [title, setTitle] = useState('');
  const [century, setCentury] = useState('');
  const [url, setUrl] = useState('');
  const [deskAssignmentId, setDeskAssignmentId] = useState('');

  useEffect(() => {
    if (reading) {
      setTitle(reading.title || '');
      setCentury(reading.century || '');
      setUrl(reading.url || '');
      setDeskAssignmentId(reading.deskAssignmentId || '');
    } else {
      setTitle('');
      setCentury('');
      setUrl('');
      setDeskAssignmentId('');
    }
  }, [reading, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}
      >
        <h2 className="text-xl font-bold mb-4 font-display" style={{ color: 'var(--pg-text)' }}>
          {reading ? 'Edit Time Period' : 'New Time Period'}
        </h2>

        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>Title</label>
        <input 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          className="w-full rounded-lg px-3 py-2 mb-4 text-sm" 
          style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
          placeholder="e.g. The Age of Enlightenment"
        />

        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>Time Period / Century</label>
        <input 
          value={century} 
          onChange={e => setCentury(e.target.value)} 
          className="w-full rounded-lg px-3 py-2 mb-4 text-sm" 
          style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
          placeholder="e.g. 17th to 18th Century"
        />

        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>Google Doc URL</label>
        <input 
          value={url} 
          onChange={e => setUrl(e.target.value)} 
          className="w-full rounded-lg px-3 py-2 mb-6 text-sm" 
          style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
          placeholder="https://docs.google.com/document/d/..."
        />

        <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--pg-text)' }}>
          Desk assignment ID <span className="font-normal" style={{ color: 'var(--pg-dim)' }}>(optional)</span>
        </label>
        <input
          value={deskAssignmentId}
          onChange={e => setDeskAssignmentId(e.target.value.trim())}
          className="w-full rounded-lg px-3 py-2 mb-1 text-sm"
          style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
          placeholder="the id from desk.mcraesocial.com/submit/..."
        />
        <p className="text-xs mb-6" style={{ color: 'var(--pg-dim)' }}>
          Set this to send students to Desk to write their response, where copy/paste protection
          and integrity checks apply. Leave blank to keep the in-app justification box only.
        </p>

        <div className="flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: 'var(--pg-text)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, century, url, deskAssignmentId })}
            disabled={!title.trim() || !url.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
