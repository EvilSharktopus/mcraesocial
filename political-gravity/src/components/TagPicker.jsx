// Tag chips plus a box for a new one. Shared by the Flag modal and the Vault's
// edit mode so both normalise spelling the same way.
import { useState } from 'react';
import { canonicalTag, dedupeTags, tagKey } from '../data/tags';

export default function TagPicker({ value, onChange, suggestions = [], autoFocus = false }) {
  const [input, setInput] = useState('');

  const selectedKeys = new Set(value.map(tagKey));
  const all = dedupeTags([...suggestions, ...value]);

  function toggle(tag) {
    const k = tagKey(tag);
    onChange(selectedKeys.has(k) ? value.filter(t => tagKey(t) !== k) : [...value, tag]);
  }

  function addCustom(e) {
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    e.preventDefault();
    const tag = canonicalTag(input, all);
    if (tag && !selectedKeys.has(tagKey(tag))) onChange([...value, tag]);
    setInput('');
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-3">
        {all.map(tag => {
          const on = selectedKeys.has(tagKey(tag));
          return (
            <button
              key={tagKey(tag)}
              type="button"
              onClick={() => toggle(tag)}
              aria-pressed={on}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                backgroundColor: on ? 'var(--pg-primary)' : 'var(--pg-surface2)',
                color: on ? 'var(--pg-on-primary)' : 'var(--pg-text)',
                border: `1px solid ${on ? 'var(--pg-primary)' : 'var(--pg-border)'}`,
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
          value={input}
          autoFocus={autoFocus}
          onChange={e => setInput(e.target.value)}
          onKeyDown={addCustom}
          placeholder="Add a tag… (press Enter)"
          aria-label="New tag"
          className="flex-1 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ backgroundColor: 'var(--pg-bg)', border: '1px solid var(--pg-border)', color: 'var(--pg-text)' }}
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: 'var(--pg-surface2)', color: 'var(--pg-text)', border: '1px solid var(--pg-border)' }}
        >
          Add
        </button>
      </div>
    </>
  );
}
