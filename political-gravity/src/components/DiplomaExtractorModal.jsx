import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

export default function DiplomaExtractorModal({ isOpen, onClose, selectedText, readingId, readingTitle }) {
  const { user } = useAuth();
  const [commentary, setCommentary] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleSave() {
    if (!user || !commentary.trim()) return;
    setSaving(true);
    try {
      const flagId = crypto.randomUUID();
      await setDoc(doc(db, 'diplomaFlags', flagId), {
        uid: user.uid,
        readingId,
        readingTitle,
        quote: selectedText,
        commentary,
        createdAt: serverTimestamp()
      });
      setCommentary('');
      onClose();
    } catch (err) {
      console.error('Failed to save diploma flag', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}
      >
        <h2 className="text-xl font-bold mb-4 font-display" style={{ color: 'var(--pg-text)' }}>
          🔖 Flag Case Study
        </h2>
        
        <div 
          className="mb-4 p-4 rounded-xl text-sm italic overflow-y-auto max-h-40"
          style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-muted)' }}
        >
          "{selectedText}"
        </div>

        <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--pg-text)' }}>
          Why is this important for the Diploma Exam?
        </label>
        <textarea
          value={commentary}
          onChange={e => setCommentary(e.target.value)}
          placeholder="This shows the collectivist nature of..."
          className="w-full resize-none rounded-xl p-3 text-sm focus:outline-none transition-colors min-h-[100px] mb-4"
          style={{
            backgroundColor: 'var(--pg-bg)',
            border: '1px solid var(--pg-border)',
            color: 'var(--pg-text)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--pg-primary)'}
          onBlur={e  => e.target.style.borderColor = 'var(--pg-border)'}
          autoFocus
        />

        <div className="flex justify-end gap-3 mt-auto">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: 'var(--pg-text)' }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !commentary.trim()}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--pg-primary)', color: 'var(--pg-on-primary)' }}
          >
            {saving ? 'Saving...' : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  );
}
