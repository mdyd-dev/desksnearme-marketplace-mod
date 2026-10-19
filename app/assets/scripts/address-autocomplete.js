(function () {
  'use strict';

  var input = document.getElementById('lf-address-search');
  if (!input) return;

  var list = document.getElementById('lf-address-list');
  var hint = document.getElementById('lf-address-status');

  var F = {
    address:   document.getElementById('lf-address'),
    city:      document.getElementById('lf-city'),
    state:     document.getElementById('lf-state'),
    postcode:  document.getElementById('lf-postcode'),
    country:   document.getElementById('lf-country'),
    formatted: document.getElementById('lf-formatted'),
    placeId:   document.getElementById('lf-place-id'),
    verified:  document.getElementById('lf-geo-verified'),
    lat:       document.getElementById('lf-lat'),
    lng:       document.getElementById('lf-lng')
  };

  var CODE_COUNTRIES = ['us', 'ca', 'au', 'br', 'mx', 'in'];
  var DEBOUNCE_MS = 350;
  var MIN_CHARS = 3;

  var cache = Object.create(null);
  var cacheKeys = [];

  function cachePut(k, v) {
    if (cacheKeys.length > 60) { delete cache[cacheKeys.shift()]; }
    cache[k] = v;
    cacheKeys.push(k);
  }

  var timer = null;
  var controller = null;
  var results = [];
  var activeIndex = -1;
  var committedLabel = input.value;

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function regionOf(r) {
    if (r.state_code && CODE_COUNTRIES.indexOf((r.country_code || '').toLowerCase()) !== -1) {
      return r.state_code;
    }
    return r.state || '';
  }

  function setHint(text, state) {
    if (!hint) return;
    hint.textContent = text;
    if (state) { hint.setAttribute('data-state', state); }
    else { hint.removeAttribute('data-state'); }
  }

  function clearCoords() {
    Object.keys(F).forEach(function (k) { if (F[k]) F[k].value = ''; });
    if (F.verified) F.verified.value = 'false';
    emit('dnm:address-cleared');
  }

  function closeList() {
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
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function select(i) {
    var r = results[i];
    if (!r) return;

    var street = '';
    if (r.housenumber && r.street) street = r.housenumber + ' ' + r.street;
    else if (r.street) street = r.street;
    else street = r.line1 || '';

    if (F.address)   F.address.value   = street;
    if (F.city)      F.city.value      = r.city || '';
    if (F.state)     F.state.value     = regionOf(r);
    if (F.postcode)  F.postcode.value  = r.postcode || '';
    if (F.country)   F.country.value   = r.country_code || '';
    if (F.formatted) F.formatted.value = r.label || '';
    if (F.placeId)   F.placeId.value   = r.place_id || '';
    if (F.lat)       F.lat.value       = r.lat;
    if (F.lng)       F.lng.value       = r.lon;
    if (F.verified)  F.verified.value  = 'false';

    input.value = r.label || '';
    committedLabel = input.value;

    closeList();

    var approx = (r.result_type === 'street' || r.confidence_building === 0);
    if (approx) {
      setHint('Location set — this one resolved to the street, so the pin may be approximate.', 'set');
    } else {
      setHint('Location set \u2713', 'set');
    }

    emit('dnm:address-selected', { lat: r.lat, lon: r.lon, approx: approx });
  }

  function render(items) {
    results = items;
    list.innerHTML = '';

    if (!items.length) {
      var empty = document.createElement('li');
      empty.className = 'addr-list__empty';
      empty.textContent = 'No matches. Try adding a city or postcode.';
      list.appendChild(empty);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      return;
    }

    items.forEach(function (r, i) {
      var li = document.createElement('li');
      li.className = 'addr-list__item' + (r.confidence === 0 ? ' addr-list__item--weak' : '');
      li.id = 'lf-addr-opt-' + i;
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

      li.addEventListener('mousedown', function (e) { e.preventDefault(); select(i); });
      list.appendChild(li);
    });

    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(-1);
  }

  function search(q) {
    var key = q.toLowerCase();
    if (cache[key]) { render(cache[key]); return; }

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
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        setHint('Address lookup is unavailable right now. You can still save and add it later.', null);
        closeList();
      });
  }

  input.addEventListener('input', function () {
    var q = input.value.trim();

    if (input.value !== committedLabel && F.lat && F.lat.value) {
      clearCoords();
      setHint('Pick a result from the list to set the location.', 'cleared');
    }

    if (timer) clearTimeout(timer);
    if (q.length < MIN_CHARS) { closeList(); return; }
    timer = setTimeout(function () { search(q); }, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', function (e) {
    if (list.hidden || !results.length) {
      if (e.key === 'Enter' && !list.hidden) e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(activeIndex + 1 >= results.length ? 0 : activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(activeIndex - 1 < 0 ? results.length - 1 : activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) select(activeIndex);
    } else if (e.key === 'Escape') {
      closeList();
    }
  });

  input.addEventListener('blur', function () {
    setTimeout(closeList, 120);
  });

  document.addEventListener('click', function (e) {
    if (!list.hidden && e.target !== input && !list.contains(e.target)) closeList();
  });
})();