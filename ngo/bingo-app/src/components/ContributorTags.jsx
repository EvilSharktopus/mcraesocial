import React from 'react';

export default function ContributorTags({ syncObj, fieldId, memberNames }) {
  const contributorsMap = syncObj.values.contributors || {};
  const currentTags = contributorsMap[fieldId] || [];

  const toggleTag = (name) => {
    const newTags = currentTags.includes(name)
      ? currentTags.filter((n) => n !== name)
      : [...currentTags, name];

    const newContributors = {
      ...contributorsMap,
      [fieldId]: newTags,
    };

    syncObj.set('contributors', newContributors);
    syncObj.save(); // Trigger immediate save
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem', marginBottom: '0.4rem' }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', alignSelf: 'center', marginRight: '0.2rem' }}>
        Contributors:
      </span>
      {memberNames.map((name) => {
        const isSelected = currentTags.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggleTag(name)}
            style={{
              background: isSelected ? 'var(--teal)' : 'transparent',
              color: isSelected ? '#fff' : 'var(--text-dim)',
              border: `1px solid ${isSelected ? 'var(--teal)' : 'var(--glass-border)'}`,
              borderRadius: '99px',
              padding: '0.15rem 0.6rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
