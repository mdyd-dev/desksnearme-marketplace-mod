const req = (url, body, csrf, method) =>
  fetch(url, {
    method: method || 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrf },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const getAfter = (list, x) => {
  const items = Array.from(list.querySelectorAll('.photo-sort__item:not(.is-dragging)'));
  return items.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element || null;
};

const setup = (root) => {
  const list = root.querySelector('.photo-sort__list');
  const status = root.querySelector('[data-photo-sort-status]');
  const csrf = root.dataset.csrf;
  let dragging = null;

  const refreshCover = () => {
    list.querySelectorAll('.photo-sort__cover').forEach((el) => el.remove());
    const first = list.querySelector('.photo-sort__item');
    if (!first) return;
    const tag = document.createElement('span');
    tag.className = 'photo-sort__cover';
    tag.textContent = 'Cover';
    first.appendChild(tag);
  };

  const save = () => {
    const ids = Array.from(list.querySelectorAll('.photo-sort__item')).map((li) => li.dataset.photoId);
    status.textContent = 'Saving…';
    req('/api/photos/reorder', { ids }, csrf)
      .then(() => {
        status.textContent = 'Order saved';
        setTimeout(() => { status.textContent = ''; }, 1800);
      })
      .catch(() => { status.textContent = 'Could not save order'; });
  };

  const commit = () => { refreshCover(); save(); };

  const remove = (li) => {
    if (!window.confirm('Remove this photo? This can’t be undone.')) return;
    const id = li.dataset.photoId;
    status.textContent = 'Removing…';
    req('/api/photos', { photo: { id } }, csrf, 'DELETE')
      .then((res) => {
        if (res && res.error) { status.textContent = 'Could not remove the photo'; return; }
        li.remove();
        refreshCover();
        if (list.querySelector('.photo-sort__item')) {
          save();
        } else {
          status.textContent = 'Photo removed';
          setTimeout(() => { status.textContent = ''; }, 1800);
        }
      })
      .catch(() => { status.textContent = 'Could not remove the photo'; });
  };

  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest('.photo-sort__item');
    if (!li) return;
    dragging = li;
    li.classList.add('is-dragging');
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragging) return;
    const after = getAfter(list, e.clientX);
    if (after == null) list.appendChild(dragging);
    else list.insertBefore(dragging, after);
  });

  list.addEventListener('dragend', () => {
    if (!dragging) return;
    dragging.classList.remove('is-dragging');
    dragging = null;
    commit();
  });

  list.addEventListener('click', (e) => {
    const del = e.target.closest('[data-photo-del]');
    if (del) {
      const li = del.closest('.photo-sort__item');
      if (li) remove(li);
      return;
    }
    const btn = e.target.closest('.photo-sort__nav');
    if (!btn) return;
    const li = btn.closest('.photo-sort__item');
    if (btn.classList.contains('photo-sort__nav--prev')) {
      const prev = li.previousElementSibling;
      if (prev) list.insertBefore(li, prev);
    } else {
      const next = li.nextElementSibling;
      if (next) list.insertBefore(next, li);
    }
    commit();
  });

  refreshCover();
};

document.querySelectorAll('[data-photo-sort]').forEach(setup);
