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

  // Check localStorage for saved stream
  const savedStream = localStorage.getItem('preferredStream') || 'shared';
  
  // Set initial active state based on saved value
  let foundSavedBtn = false;
  streamBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-target-stream') === savedStream) {
      btn.classList.add('active');
      foundSavedBtn = true;
    }
  });

  // Fallback to shared if saved stream button doesn't exist on this page
  if (!foundSavedBtn) {
    const sharedBtn = Array.from(streamBtns).find(b => b.getAttribute('data-target-stream') === 'shared');
    if (sharedBtn) sharedBtn.classList.add('active');
    filterItems('shared');
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
