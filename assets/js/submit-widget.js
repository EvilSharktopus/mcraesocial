/**
 * submit-widget.js
 * Injected into every mcraesocial.com unit page.
 * Queries Firestore (public read) for assignments linked to this unit,
 * and renders assignment-block entries into <div id="submit-widget">.
 */
(function () {
  const FIREBASE_API_KEY = 'AIzaSyCIiW1edciPp0kC72oQHYhhTmfTPoSdajA';
  const PROJECT_ID       = 'mcrae-assignments';
  const SUBMIT_BASE      = 'https://submit.mcraesocial.com/submit';

  // Derive unit slug from URL: /social-9/ycja/ → social-9/ycja
  const parts = window.location.pathname.replace(/^\/|\/$/g, '').split('/');
  const unit  = parts.slice(0, 2).join('/');

  const target = document.getElementById('submit-widget');
  if (!target || !unit) return;

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

          // Treat missing isOpen as true (matches app logic: isOpen !== false)
          const isOpen = !f.isOpen || f.isOpen.booleanValue === true;

          return {
            id,
            name:   f.name?.stringValue || 'Assignment',
            isOpen,
          };
        })
        // Open first
        .sort((a, b) => (b.isOpen ? 1 : 0) - (a.isOpen ? 1 : 0));

      if (!assignments.length) return;

      // Render as assignment-block items to match existing page style
      target.innerHTML = assignments.map(a => {
        if (a.isOpen) {
          return `
            <div class="assignment-block">
              <div class="assignment-block__label">${a.name}</div>
              <div class="assignment-block__actions">
                <a href="${SUBMIT_BASE}/${a.id}" target="_blank" class="utility-btn utility-btn--submit">
                  ✏️ Write Assignment
                </a>
              </div>
            </div>`;
        } else {
          return `
            <div class="assignment-block assignment-block--locked">
              <div class="assignment-block__label">${a.name}</div>
              <div class="assignment-block__actions">
                <span class="utility-btn utility-btn--locked">🔒 Coming soon</span>
              </div>
            </div>`;
        }
      }).join('');
    })
    .catch(() => {
      // Silently fail
    });
})();
