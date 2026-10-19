(function () {
  'use strict';

  var grid = document.getElementById('listings-grid');
  if (!grid) return;

  var oLat = parseFloat(grid.getAttribute('data-origin-lat'));
  var oLng = parseFloat(grid.getAttribute('data-origin-lng'));
  if (isNaN(oLat) || isNaN(oLng)) return;

  var useMiles = /^en-(US|LR)\b/i.test(navigator.language || '');

  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function format(km) {
    var v = useMiles ? km * 0.621371 : km;
    var unit = useMiles ? 'mi' : 'km';
    if (v < 0.15) return 'here';
    if (v < 10) return v.toFixed(1) + ' ' + unit + ' away';
    return Math.round(v) + ' ' + unit + ' away';
  }

  // Operate on the full card wrapper (link + favorite button), not the inner
  // <a>, so re-sorting keeps each card intact instead of orphaning the button.
  var wraps = Array.prototype.slice.call(grid.querySelectorAll('.listing-card-wrap'));
  var measured = [];

  wraps.forEach(function (wrap) {
    var card = wrap.querySelector('.listing-card');
    var lat = card ? parseFloat(card.getAttribute('data-lat')) : NaN;
    var lng = card ? parseFloat(card.getAttribute('data-lng')) : NaN;
    var slot = wrap.querySelector('[data-distance]');
    if (isNaN(lat) || isNaN(lng)) { measured.push({ wrap: wrap, km: Infinity }); return; }

    var km = haversine(oLat, oLng, lat, lng);
    if (slot) slot.textContent = '· ' + format(km);
    measured.push({ wrap: wrap, km: km });
  });

  // nearest first, within this page of results
  measured.sort(function (a, b) { return a.km - b.km; });
  measured.forEach(function (m) { grid.appendChild(m.wrap); });
})();