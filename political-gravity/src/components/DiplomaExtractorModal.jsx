import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';
import { dedupeTags, knownTags } from '../data/tags';
import TagPicker from './TagPicker';

export default function DiplomaExtractorModal({ isOpen, onClose, selectedText, readingId, readingTitle }) {
  const { user } = useAuth();
  const [commentary, setCommentary] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  // The student's own vault, so the tags they already use are one click away
  // instead of being retyped (and misspelled) each time.
  const [myFlags, setMyFlags] = useState([]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const unsub = onSnapshot(
      query(collection(db, 'diplomaFlags'), where('uid', '==', user.uid)),
      snap => setMyFlags(snap.docs.map(d => d.data())),
      err => console.error('Could not load your tags:', err),
    );
    return () => unsub();
  }, [isOpen, user]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!user || (!commentary.trim() && selectedTags.length === 0)) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const flagId = crypto.randomUUID();
      await setDoc(doc(db, 'diplomaFlags', flagId), {
        uid: user.uid,
        readingId,
        readingTitle,
        quote: selectedText,
        commentary: commentary.trim(),
        tags: dedupeTags(selectedTags),
        createdAt: serverTimestamp()
      });
      setCommentary('');
      setSelectedTags([]);
      onClose();
    } catch (err) {
      // Keep the modal open with the text intact so nothing is lost.
      console.error('Failed to save diploma flag', err);
      setSaveErr(err.code === 'permission-denied'
        ? 'Firestore refused the save (permissions). Nothing was lost — try again or tell Mr. McRae.'
        : 'Could not reach the server. Nothing was lost — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ backgroundColor: 'var(--pg-surface)', border: '1px solid var(--pg-border)' }}
      >
        <h2 className="text-xl font-bold mb-4 shrink-0 font-display" style={{ color: 'var(--pg-text)' }}>
          🔖 Flag Case Study
        </h2>

        <div className="overflow-y-auto pr-2" style={{ marginRight: '-8px' }}>
          <div
            className="mb-6 p-4 rounded-xl text-sm italic"
            style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-muted)' }}
          >
            "{selectedText}"
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--pg-text)' }}>
              Tags (Select all that apply)
            </label>
            <TagPicker value={selectedTags} onChange={setSelectedTags} suggestions={knownTags(myFlags)} />
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
          />
        </div>

        {saveErr && (
          <p className="text-xs mt-3 shrink-0" role="alert" style={{ color: '#ef4444' }}>⚠ {saveErr}</p>
        )}

        <div className="flex justify-end gap-3 mt-4 shrink-0 border-t pt-4" style={{ borderColor: 'var(--pg-border)' }}>
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
            disabled={saving || (!commentary.trim() && selectedTags.length === 0)}
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
