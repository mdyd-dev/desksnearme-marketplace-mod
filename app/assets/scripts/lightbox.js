let overlay = null;

const build = () => {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Photo viewer');
  el.hidden = true;
  el.innerHTML =
    '<button type="button" class="lightbox__close" aria-label="Close">\u00d7</button>' +
    '<button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous photo">\u2039</button>' +
    '<figure class="lightbox__figure">' +
      '<picture>' +
        '<source class="lightbox__avif" type="image/avif">' +
        '<img class="lightbox__img" alt="">' +
      '</picture>' +
    '</figure>' +
    '<button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next photo">\u203a</button>' +
    '<p class="lightbox__count" aria-live="polite"></p>';
  document.body.appendChild(el);
  return el;
};

const setup = (gallery) => {
  const links = Array.from(gallery.querySelectorAll('.listing-gallery__item'));
  if (!links.length) return;

  const items = links.map((a) => ({
    full: a.getAttribute('href'),
    avif: a.dataset.avif || '',
    alt: (a.querySelector('img') || {}).alt || 'Listing photo',
  }));

  if (!overlay) overlay = build();

  const img = overlay.querySelector('.lightbox__img');
  const avif = overlay.querySelector('.lightbox__avif');
  const count = overlay.querySelector('.lightbox__count');
  const prevBtn = overlay.querySelector('.lightbox__nav--prev');
  const nextBtn = overlay.querySelector('.lightbox__nav--next');
  const closeBtn = overlay.querySelector('.lightbox__close');

  let index = 0;
  let lastFocus = null;

  const show = (i) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    if (item.avif) avif.setAttribute('srcset', item.avif);
    else avif.removeAttribute('srcset');
    img.src = item.full;
    img.alt = item.alt;
    count.textContent = items.length > 1 ? (index + 1) + ' / ' + items.length : '';
    const multi = items.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'ArrowLeft') show(index - 1);
  };

  const open = (i) => {
    lastFocus = document.activeElement;
    show(i);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
  };

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    img.removeAttribute('src');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  links.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open(i);
    });
  });

  const allBtn = gallery.querySelector('[data-lightbox-all]');
  if (allBtn) allBtn.addEventListener('click', () => open(0));

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => show(index - 1));
  nextBtn.addEventListener('click', () => show(index + 1));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('lightbox__figure')) close();
  });
};

document.querySelectorAll('[data-lightbox-gallery]').forEach(setup);