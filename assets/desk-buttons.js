(function () {
  'use strict';

  // Expected response:
  //   { "open": { "<unit slug>": [ { "name": "Source Analysis", "stream": "1" }, ... ] },
  //     "generatedAt": "..." }
  // Each entry names one currently-open, non-restricted assignment. A bare
  // string is accepted in place of the object and matches on name alone.
  // "stream" is optional; omit it on units without a -1/-2 split.
  var ENDPOINT = 'https://us-central1-mcrae-assignments-ca.cloudfunctions.net/openAssignments';

  // "/social-30/intro-to-ideologies/" -> "social-30/intro-to-ideologies"
  function unitFromPath() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) parts.pop();
    if (parts.length < 2) return null;
    return parts.slice(-2).join('/');
  }

  function norm(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // "1", 1, "-1", "30-1" -> "1";  absent or unparseable -> ""
  function normStream(v) {
    var m = /(\d)\s*$/.exec(String(v == null ? '' : v));
    return m ? m[1] : '';
  }

  // Only a list of assignments is specific enough to open a button. Any other
  // shape -- including a bare `true`, which says a unit has something open but
  // not which -- reveals nothing, because it cannot rule out a closed one.
  function openList(data, unit) {
    if (!data || !data.open) return null;
    var v = data.open[unit];
    return Array.isArray(v) ? v : null;
  }

  function matches(entry, name, stream) {
    var entryName, entryStream;
    if (entry && typeof entry === 'object') {
      entryName = norm(entry.name !== undefined ? entry.name : entry.title);
      entryStream = normStream(entry.stream);
    } else {
      entryName = norm(entry);
      entryStream = '';
    }
    if (!entryName || entryName !== name) return false;
    // A stream given on both sides must agree. Absent on either side, the name
    // decides -- that is how units without a -1/-2 split match.
    if (entryStream && stream && entryStream !== stream) return false;
    return true;
  }

  function reveal() {
    var unit = unitFromPath();
    if (!unit) return;
    fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = openList(data, unit);
        if (!list || !list.length) return;
        var buttons = document.querySelectorAll('.desk-write');
        for (var i = 0; i < buttons.length; i++) {
          var btn = buttons[i];
          var block = btn.closest && btn.closest('.assignment-block');
          if (!block) continue;
          var labelEl = block.querySelector('.assignment-block__label');
          var name = norm(labelEl && labelEl.textContent);
          if (!name) continue;
          var stream = normStream(block.getAttribute('data-stream'));
          for (var j = 0; j < list.length; j++) {
            if (matches(list[j], name, stream)) {
              // Hiding comes from the .desk-write class rule, not an inline
              // style, so revealing has to beat that rule.
              btn.classList.add('desk-write--open');
              break;
            }
          }
        }
      })
      .catch(function () { /* silent: nothing shown is the safe state */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal);
  } else {
    reveal();
  }
})();
