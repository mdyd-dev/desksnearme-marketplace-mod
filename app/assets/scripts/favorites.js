(function () {
  'use strict';

  var buttons = document.querySelectorAll('[data-fav]');
  if (!buttons.length) return;

  var anon = buttons[0].hasAttribute('data-fav-anon');

  function setState(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Remove from saved spaces' : 'Save this space');
  }

  if (!anon) {
    fetch('/api/favorites/ids.json', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var ids = (data && data.ids) || [];
        buttons.forEach(function (btn) {
          if (ids.indexOf(btn.getAttribute('data-fav')) !== -1) setState(btn, true);
        });
      })
      .catch(function () { /* leave hearts empty */ });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (btn.hasAttribute('data-fav-anon')) {
        var modal = document.getElementById('modal-login');
        if (modal) modal.dataset.open = 'true';
        return;
      }

      if (btn.classList.contains('is-busy')) return;
      btn.classList.add('is-busy');

      var was = btn.getAttribute('aria-pressed') === 'true';
      setState(btn, !was);

      fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': btn.getAttribute('data-csrf')
        },
        body: JSON.stringify({ listing_id: btn.getAttribute('data-fav') })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          btn.classList.remove('is-busy');
          if (data && typeof data.favorited === 'boolean') {
            setState(btn, data.favorited);
          } else {
            setState(btn, was);
          }
        })
        .catch(function () {
          btn.classList.remove('is-busy');
          setState(btn, was);
        });
    });
  });
})();