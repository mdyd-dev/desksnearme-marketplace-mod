(function () {
  'use strict';

  var form = document.getElementById('listing-form');
  var bar  = document.querySelector('[data-readiness]');
  if (!form || !bar) return;

  var toggle    = bar.querySelector('[data-readiness-toggle]');
  var panel     = bar.querySelector('[data-readiness-panel]');
  var summaries = bar.querySelectorAll('[data-readiness-summary]');
  var segments  = bar.querySelectorAll('[data-seg]');
  var dirtyEl   = bar.querySelector('[data-dirty]');
  var dirty     = false;

  var REQS = [
    { key: 'title',    label: 'Title',             target: '#lf-title' },
    { key: 'type',     label: 'Space type',        target: '#lf-type' },
    { key: 'capacity', label: 'Capacity',          target: '#lf-capacity' },
    { key: 'price',    label: 'At least one rate', target: '#lf-pd' },
    { key: 'location', label: 'An address',        target: '#lf-address-search' },
    { key: 'photo',    label: 'A photo',           target: '#sec-photos' }
  ];

  // photos live in the server-rendered grid; freshly uploaded ones only exist in Uppy
  var addedPhotos = 0;
  function photoCount() {
    return document.querySelectorAll('.photo-sort__item').length + addedPhotos;
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value).trim() : '';
  }

  function met(key) {
    if (key === 'title')    return val('lf-title') !== '';
    if (key === 'type')     return val('lf-type') !== '';
    if (key === 'capacity') return val('lf-capacity') !== '' && Number(val('lf-capacity')) >= 1;
    if (key === 'location') return val('lf-lat') !== '' && val('lf-lng') !== '';
    if (key === 'photo')    return photoCount() > 0;
    if (key === 'price') {
      return ['lf-ph', 'lf-pd', 'lf-pw', 'lf-pm'].some(function (id) {
        return val(id) !== '';
      });
    }
    return false;
  }

  function refresh() {
    var done = 0;
    var firstMissing = null;

    REQS.forEach(function (req) {
      var ok  = met(req.key);
      var row = panel.querySelector('[data-req="' + req.key + '"]');
      if (ok) done++;
      if (!ok && !firstMissing) firstMissing = req;
      if (row) {
        row.setAttribute('data-ok', ok ? 'true' : 'false');
        var jump = row.querySelector('[data-jump]');
        if (jump) jump.hidden = ok;
      }
    });

    for (var s = 0; s < segments.length; s++) {
      segments[s].setAttribute('data-on', (s % REQS.length) < done ? 'true' : 'false');
    }

    var text = done + ' of ' + REQS.length;
    if (done === REQS.length) {
      text += ' · ready to publish';
    } else if (firstMissing) {
      text += ' · needs ' + firstMissing.label.toLowerCase();
    }
    for (var t = 0; t < summaries.length; t++) {
      summaries[t].textContent = text;
    }

    var publishBtn = document.querySelector('[data-publish-btn]');
    var blockedMsg  = document.querySelector('[data-publish-blocked]');
    if (publishBtn) {
      var hasPhoto = photoCount() > 0;
      publishBtn.disabled = !hasPhoto;
      if (blockedMsg) blockedMsg.hidden = hasPhoto;
    }

    var amCount = form.querySelectorAll('input[name="amenities[]"]:checked').length;
    var amRow = panel.querySelector('[data-status="amenities"]');
    if (amRow) amRow.textContent = amCount === 0 ? 'none' : amCount + ' selected';
  }

  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    var icon = toggle.querySelector('[data-chevron]');
    if (icon) icon.textContent = open ? '⌄' : '⌃';
  }

  toggle.addEventListener('click', function () {
    setPanel(panel.hidden);
  });

  panel.addEventListener('click', function (e) {
    var jump = e.target.closest('[data-jump]');
    if (!jump) return;
    var el = document.querySelector(jump.getAttribute('data-jump'));
    if (!el) return;
    if (window.innerWidth < 1000) setPanel(false);
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
      window.setTimeout(function () { el.focus(); }, 320);
    }
  });

  form.addEventListener('input', function () {
    refresh();
    if (!dirty) {
      dirty = true;
      if (dirtyEl) dirtyEl.hidden = false;
    }
  });
  form.addEventListener('change', refresh);

  document.addEventListener('listing-photos-added', function (e) {
    var n = (e.detail && e.detail.photos && e.detail.photos.length) || 1;
    addedPhotos += n;
    refresh();
  });

  var photoList = document.querySelector('.photo-sort__list');
  if (photoList && window.MutationObserver) {
    new MutationObserver(refresh).observe(photoList, { childList: true });
  }

  document.addEventListener('dnm:address-selected', refresh);
  document.addEventListener('dnm:address-cleared', refresh);

  form.addEventListener('focusin', function () {
    if (window.innerWidth < 1000 && !panel.hidden) setPanel(false);
  });

  form.addEventListener('submit', function () {
    dirty = false;
    if (dirtyEl) dirtyEl.hidden = true;
  });

  document.addEventListener('click', function (e) {
    if (window.innerWidth >= 1000) return;
    if (panel.hidden) return;
    if (!bar.contains(e.target)) setPanel(false);
  });

  refresh();
})();