/**
 * submit-widget.js
 * Injected into every mcraesocial.com unit page.
 * Each linked assignment shows: Name | See Assignment (doc) | Write/Coming soon
 */
(function () {
  const FIREBASE_API_KEY = 'AIzaSyB4Yc51IzKEcBzDPqy3B8fA9QSrnhIAzr4';
  const PROJECT_ID       = 'mcrae-assignments-ca';
  const SUBMIT_BASE      = 'https://submit.mcraesocial.com/submit';

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

          // Parse a Firestore value (timestampValue or stringValue) to ms
          const toMs = (fv) => {
            if (!fv) return null;
            // Firestore REST returns timestamps as ISO strings in timestampValue
            if (fv.timestampValue) return new Date(fv.timestampValue).getTime();
            if (fv.stringValue)    return new Date(fv.stringValue).getTime();
            return null;
          };
          const now     = Date.now();
          const openMs  = toMs(f.openAt);
          const closeMs = toMs(f.closeAt);
          const isTimed = !!(openMs || closeMs);

          const isArchived = f.archived && f.archived.booleanValue === true;

          let isOpen;
          if (isArchived) {
            isOpen = false;
          } else if (f.isOpen && f.isOpen.booleanValue === false) {
            isOpen = false; // manual close overrides schedule
          } else if (isTimed) {
            // Schedule takes precedence — same logic as AssignmentList.jsx
            const notYetOpen = openMs  && now < openMs;
            const alreadyClosed = closeMs && now > closeMs;
            isOpen = !notYetOpen && !alreadyClosed;
          } else {
            // No schedule: respect the manual isOpen toggle AND daily 3:30 PM cutoff
            const d = new Date();
            const isPastCutoff = d.getHours() > 15 || (d.getHours() === 15 && d.getMinutes() >= 30);
            const manuallyOpen = !f.isOpen || f.isOpen.booleanValue === true;
            isOpen = manuallyOpen && !isPastCutoff;
          }

          return {
            id,
            name:       f.name?.stringValue   || 'Assignment',
            docUrl:     f.docUrl?.stringValue  || '',
            isArchived,
            isOpen,
          };
        })
        .filter(a => !a.isArchived)
        .sort((a, b) => (b.isOpen ? 1 : 0) - (a.isOpen ? 1 : 0));

      if (!assignments.length) return;

      target.innerHTML = assignments.map(a => {
        const seeBtn = a.docUrl
          ? `<a href="${a.docUrl}" target="_blank" class="utility-btn">See Assignment</a>`
          : '';

        const writeBtn = a.isOpen
          ? `<a href="${SUBMIT_BASE}/${a.id}" target="_blank" class="utility-btn utility-btn--submit">✏️ Write Assignment</a>`
          : '';

        return `
          <div class="assignment-block">
            <div class="assignment-block__label">${a.name}</div>
            <div class="assignment-block__actions">
              ${seeBtn}
              ${writeBtn}
            </div>
          </div>`;
      }).join('');
    })
    .catch(() => {});
})();
