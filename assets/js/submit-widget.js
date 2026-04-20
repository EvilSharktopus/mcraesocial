/**
 * submit-widget.js
 * Injected into every mcraesocial.com unit page.
 * Queries Firestore (public read) for assignments linked to this unit,
 * and renders badges into <div id="submit-widget">.
 */
(function () {
  const FIREBASE_API_KEY = 'AIzaSyCIiW1edciPp0kC72oQHYhhTmfTPoSdajA';
  const PROJECT_ID       = 'mcrae-assignments';
  const SUBMIT_BASE      = 'https://submit.mcraesocial.com/submit';

  // Derive unit slug from URL: /social-9/ycja/ → social-9/ycja
  const parts = window.location.pathname.replace(/^\/|\/$/g, '').split('/');
  const unit  = parts.slice(0, 2).join('/'); // e.g. "social-9/ycja"

  const target = document.getElementById('submit-widget');
  if (!target || !unit) return;

  // Structured query — filter assignments where unit === current unit
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'assignments' }],
      where: {
        fieldFilter: {
          field:  { fieldPath: 'unit' },
          op:     'EQUAL',
          value:  { stringValue: unit },
        },
      },
    },
  };

  fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query) }
  )
    .then(r => r.json())
    .then(docs => {
      const assignments = docs
        .filter(d => d.document)
        .map(d => {
          const f  = d.document.fields || {};
          const id = d.document.name.split('/').pop();
          return {
            id,
            name:   f.name?.stringValue   || 'Assignment',
            isOpen: f.isOpen?.booleanValue ?? false,
          };
        })
        // Sort: open first
        .sort((a, b) => (b.isOpen ? 1 : 0) - (a.isOpen ? 1 : 0));

      if (!assignments.length) return;

      const html = assignments.map(a => {
        if (a.isOpen) {
          return `<a href="${SUBMIT_BASE}/${a.id}" class="submit-badge submit-badge--open" target="_blank">
            <span class="submit-badge__icon">✏️</span>
            <span class="submit-badge__label">Write: ${a.name}</span>
            <span class="submit-badge__arrow">→</span>
          </a>`;
        } else {
          return `<span class="submit-badge submit-badge--closed">
            <span class="submit-badge__icon">🔒</span>
            <span class="submit-badge__label">${a.name}</span>
            <span class="submit-badge__tag">Coming soon</span>
          </span>`;
        }
      }).join('');

      target.innerHTML = `<div class="submit-badge-list">${html}</div>`;
    })
    .catch(() => {
      // Silently fail — no badge shown if fetch fails
    });
})();
