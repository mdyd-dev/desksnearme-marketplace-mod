(function () {
  'use strict';

  var DEBOUNCE_MS = 350;
  var MIN_CHARS = 3;
  var CODE_COUNTRIES = ['us', 'ca', 'au', 'br', 'mx', 'in'];

  var cache = Object.create(null);
  var cacheKeys = [];

  function cacheGet(k) { return cache[k]; }
  function cachePut(k, v) {
    if (cacheKeys.length > 60) { delete cache[cacheKeys.shift()]; }
    cache[k] = v;
    cacheKeys.push(k);
  }

  function regionOf(r) {
    if (r.state_code && CODE_COUNTRIES.indexOf((r.country_code || '').toLowerCase()) !== -1) {
      return r.state_code;
    }
    return r.state || '';
  }

  document.querySelectorAll('[data-place-input]').forEach(function (input) {
    var wrap = input.closest('.place-search');
    if (!wrap) return;
    var list = wrap.querySelector('.addr-list');
    if (!list) return;

    var latF = document.getElementById(input.getAttribute('data-lat-field'));
    var lngF = document.getElementById(input.getAttribute('data-lng-field'));
    var form = input.form;

    var timer = null;
    var controller = null;
    var results = [];
    var activeIndex = -1;
    var committed = input.value;

    function close() {
      list.hidden = true;
      list.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      results = [];
    }

    function highlight(i) {
      var items = list.querySelectorAll('.addr-list__item');
      for (var n = 0; n < items.length; n++) {
        items[n].setAttribute('aria-selected', n === i ? 'true' : 'false');
      }
      activeIndex = i;
      if (i >= 0 && items[i]) {
        input.setAttribute('aria-activedescendant', items[i].id);
        items[i].scrollIntoView({ block: 'nearest' });
      }
    }

    function choose(i) {
      var r = results[i];
      if (!r) return;
      var region = regionOf(r);
      var label = r.city
        ? (r.city + (region && region !== r.city ? ', ' + region : ''))
        : (r.line1 || r.label || '');
      input.value = label;
      committed = label;
      if (latF) latF.value = r.lat;
      if (lngF) lngF.value = r.lon;
      close();
      if (form) form.submit();
    }

    function render(items) {
      results = items;
      list.innerHTML = '';

      if (!items.length) {
        var empty = document.createElement('li');
        empty.className = 'addr-list__empty';
        empty.textContent = 'No places found.';
        list.appendChild(empty);
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        return;
      }

      items.forEach(function (r, i) {
        var li = document.createElement('li');
        li.className = 'addr-list__item' + (r.confidence === 0 ? ' addr-list__item--weak' : '');
        li.id = 'place-opt-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');

        var l1 = document.createElement('span');
        l1.className = 'addr-list__line1';
        l1.textContent = r.line1 || r.label || '';
        li.appendChild(l1);

        if (r.line2) {
          var l2 = document.createElement('span');
          l2.className = 'addr-list__line2';
          l2.textContent = r.line2;
          li.appendChild(l2);
        }

        li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
        list.appendChild(li);
      });

      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      highlight(-1);
    }

    function search(q) {
      var key = q.toLowerCase();
      var hit = cacheGet(key);
      if (hit) { render(hit); return; }

      if (controller) controller.abort();
      controller = new AbortController();
      fetch('/api/geo/autocomplete.json?q=' + encodeURIComponent(q), {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var arr = Array.isArray(data) ? data : [];
          cachePut(key, arr);
          render(arr);
        })
        .catch(function (err) { if (err.name !== 'AbortError') close(); });
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();

      if (input.value !== committed) {
        if (latF) latF.value = '';
        if (lngF) lngF.value = '';
      }

      if (timer) clearTimeout(timer);
      if (q.length < MIN_CHARS) { close(); return; }
      timer = setTimeout(function () { search(q); }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
      if (list.hidden || !results.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlight(activeIndex + 1 >= results.length ? 0 : activeIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlight(activeIndex - 1 < 0 ? results.length - 1 : activeIndex - 1);
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) { e.preventDefault(); choose(activeIndex); }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    input.addEventListener('blur', function () { setTimeout(close, 120); });
    document.addEventListener('click', function (e) {
      if (!list.hidden && e.target !== input && !list.contains(e.target)) close();
    });
  });
})();