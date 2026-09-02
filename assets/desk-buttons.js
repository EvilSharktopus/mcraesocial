(function () {
  'use strict';

  var ENDPOINT = 'https://us-central1-mcrae-assignments-ca.cloudfunctions.net/openAssignments';

  // "/social-30/intro-to-ideologies/" -> "social-30/intro-to-ideologies"
  function unitFromPath() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length && /\.html?$/i.test(parts[parts.length - 1])) parts.pop();
    if (parts.length < 2) return null;
    return parts.slice(-2).join('/');
  }

  function reveal() {
    var unit = unitFromPath();
    if (!unit) return;
    fetch(ENDPOINT, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.open || data.open[unit] !== true) return;
        var buttons = document.querySelectorAll('.desk-write');
        // Hiding is done by the .desk-write class rule, not an inline style, so
        // revealing has to beat that rule -- clearing style.display would leave
        // the button hidden. The open state lives in CSS beside the hidden one.
        for (var i = 0; i < buttons.length; i++) buttons[i].classList.add('desk-write--open');
      })
      .catch(function () { /* silent: nothing shown is the safe state */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal);
  } else {
    reveal();
  }
})();
