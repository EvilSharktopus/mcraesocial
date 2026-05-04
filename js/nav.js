document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const hamburger = nav.querySelector('.site-nav__hamburger');
  const links = nav.querySelector('.site-nav__links');

  if (hamburger && links) {
    hamburger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      hamburger.innerHTML = open ? '&#x2715;' : '&#x2630;';
      hamburger.setAttribute('aria-expanded', open);
    });
  }

  // Mark current page as active
  const path = window.location.pathname;
  nav.querySelectorAll('.site-nav__link').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (href !== '/' && path.startsWith(href))) {
      a.classList.add('site-nav__link--active');
    }
  });
});

// Stream Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
  const streamBtns = document.querySelectorAll('.stream-btn');
  if (!streamBtns.length) return;

  const filterItems = (streamId) => {
    // Filter grid items
    document.querySelectorAll('.unit-grid__item, .assignment-block, .content-block').forEach(item => {
      const stream = item.getAttribute('data-stream');
      if (!stream || stream === streamId || stream === 'shared') {
        item.classList.remove('grid-item--hidden');
      } else {
        item.classList.add('grid-item--hidden');
      }
    });

    // Filter utility links
    document.querySelectorAll('.utility-links a').forEach(link => {
      const stream = link.getAttribute('data-stream');
      if (!stream || stream === streamId || stream === 'shared') {
        link.classList.remove('utility-link--hidden');
      } else {
        link.classList.add('utility-link--hidden');
      }
    });

    // We also want to hide arbitrary blocks tagged with data-stream
    document.querySelectorAll('[data-stream]').forEach(el => {
      // Don't double-process utility links or grid items
      if(el.classList.contains('unit-grid__item') || el.closest('.utility-links')) return;
      
      const stream = el.getAttribute('data-stream');
      if (!stream || stream === streamId || stream === 'shared') {
        el.style.display = ''; // Restore default
      } else {
        el.style.display = 'none';
      }
    });
  };

  // Check localStorage for saved stream preference, default to '1'
  const savedStream = localStorage.getItem('preferredStream') || '1';

  // Set initial active state based on saved value
  let foundSavedBtn = false;
  streamBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-target-stream') === savedStream) {
      btn.classList.add('active');
      foundSavedBtn = true;
    }
  });

  // Fallback to '1' if saved preference button doesn't exist on this page
  if (!foundSavedBtn) {
    const firstBtn = streamBtns[0];
    if (firstBtn) firstBtn.classList.add('active');
    filterItems(firstBtn ? firstBtn.getAttribute('data-target-stream') : '1');
  } else {
    filterItems(savedStream);
  }

  streamBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetStream = e.target.getAttribute('data-target-stream');
      
      // Update active btn
      streamBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Save preference
      localStorage.setItem('preferredStream', targetStream);
      
      // Filter items
      filterItems(targetStream);
    });
  });
});

// =============================================
// Hover-prefetch: inject <link rel="prefetch"> when the user hovers a unit grid link
// This pre-loads the next page HTML so navigation feels instant.
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.unit-grid__item').forEach(link => {
    link.addEventListener('mouseenter', () => {
      const href = link.getAttribute('href');
      if (!href || document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
      const el = document.createElement('link');
      el.rel = 'prefetch';
      el.href = href;
      document.head.appendChild(el);
    }, { once: true });
  });
});

// =============================================
// View Transitions API — smooth cross-page fade
// Intercepts same-origin link clicks and wraps navigation in a transition.
// Falls back gracefully (instant nav) in browsers that don't support it.
// =============================================
if (document.startViewTransition) {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    // Only intercept same-origin, non-anchor, non-external, non-mailto links
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('http') ||
      href.startsWith('mailto') ||
      href.startsWith('//') ||
      link.target === '_blank'
    ) return;
    e.preventDefault();
    document.startViewTransition(() => {
      window.location.href = href;
    });
  });
}
