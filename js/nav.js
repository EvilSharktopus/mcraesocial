document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  const hamburger = nav.querySelector('.site-nav__hamburger');
  const links = nav.querySelector('.site-nav__links');

  if (hamburger && links) {
    hamburger.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      hamburger.textContent = open ? '✕' : '☰';
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
    document.querySelectorAll('.unit-grid__item').forEach(item => {
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
  };

  streamBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetStream = e.target.getAttribute('data-target-stream');
      
      // Update active btn
      streamBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Filter items
      filterItems(targetStream);
    });
  });
});
