import { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthContext';

const PREDEFINED_TAGS = [
  'Left', 'Right', 'Economics', 'Politics', 'Illiberalism', 'Imposition', 
  'Democracy', 'Dictatorship', 'USA', 'Russia', 'Canada', 'Europe', 'China'
];

export default function DiplomaExtractorModal({ isOpen, onClose, selectedText, readingId, readingTitle }) {
  const { user } = useAuth();
  const [commentary, setCommentary] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  function toggleTag(tag) {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function handleAddCustomTag(e) {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const tag = customTagInput.trim();
      if (tag && !selectedTags.includes(tag)) {
        setSelectedTags(prev => [...prev, tag]);
      }
      setCustomTagInput('');
    }
  }

  async function handleSave() {
    if (!user || (!commentary.trim() && selectedTags.length === 0)) return;
    setSaving(true);
    try {
      const flagId = crypto.randomUUID();
      await setDoc(doc(db, 'diplomaFlags', flagId), {
        uid: user.uid,
        readingId,
        readingTitle,
        quote: selectedText,
        commentary,
        tags: selectedTags,
        createdAt: serverTimestamp()
      });
      setCommentary('');
      setSelectedTags([]);
      setCustomTagInput('');
      onClose();
    } catch (err) {
      console.error('Failed to save diploma flag', err);
    } finally {
      setSaving(false);
    }
  }

  // Combine predefined tags and any custom tags that were added
  const allTagsToDisplay = Array.from(new Set([...PREDEFINED_TAGS, ...selectedTags]));

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
            <div className="flex flex-wrap gap-2 mb-3">
              {allTagsToDisplay.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--pg-primary)' : 'var(--pg-surface2)',
                      color: isSelected ? 'var(--pg-on-primary)' : 'var(--pg-text)',
                      border: `1px solid ${isSelected ? 'var(--pg-primary)' : 'var(--pg-border)'}`
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={customTagInput}
                onChange={e => setCustomTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Add custom tag... (Press Enter)"
                className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--pg-bg)',
                  border: '1px solid var(--pg-border)',
                  color: 'var(--pg-text)',
                }}
              />
              <button
                onClick={handleAddCustomTag}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-text)', border: '1px solid var(--pg-border)' }}
              >
                Add
              </button>
            </div>
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
