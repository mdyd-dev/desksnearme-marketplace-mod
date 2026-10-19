(function () {
  'use strict';

  if (!window.L) return;

  var TILE_STYLE = 'osm-bright';

  function tileLayer(key) {
    var retina = L.Browser.retina ? '@2x' : '';
    return L.tileLayer(
      'https://maps.geoapify.com/v1/tile/' + TILE_STYLE + '/{z}/{x}/{y}' + retina + '.png?apiKey=' + key,
      {
        maxZoom: 20,
        attribution: '<a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | \u00a9 <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> \u00a9 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }
    );
  }

  var pinIcon = L.divIcon({
    className: 'geo-pin',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="#fff" stroke-width="1.1" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    iconSize: [34, 34],
    iconAnchor: [17, 33],
    popupAnchor: [0, -30]
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function popupHtml(p) {
    var parts = [];
    if (p.url) parts.push('<a class="geo-pop__title" href="' + p.url + '">' + escapeHtml(p.title || 'View space') + '</a>');
    else parts.push('<span class="geo-pop__title">' + escapeHtml(p.title || '') + '</span>');
    if (p.price) parts.push('<span class="geo-pop__price">' + escapeHtml(p.price) + '</span>');
    if (p.fuzzy) parts.push('<span class="geo-pop__note">Approximate area</span>');
    return '<div class="geo-pop">' + parts.join('') + '</div>';
  }

  document.querySelectorAll('[data-geo-map]').forEach(function (el) {
    var key = el.getAttribute('data-map-key');
    if (!key) return;

    var points = [];
    var srcId = el.getAttribute('data-points-from');
    if (srcId) {
      var node = document.getElementById(srcId);
      if (node) {
        try { points = JSON.parse(node.textContent) || []; } catch (e) { points = []; }
      }
    }

    if (!points.length) return;

    el.classList.remove('map-ph');
    el.innerHTML = '';

    // Dedicated map panels (e.g. the browse sidebar) opt into always-on
    // wheel zoom via data-scroll-zoom="always". Inline maps stay cooperative:
    // wheel-zoom activates only once the map is clicked/focused, so scrolling
    // the page over the map doesn't hijack the scroll.
    var alwaysZoom = el.getAttribute('data-scroll-zoom') === 'always';
    var map = L.map(el, { scrollWheelZoom: alwaysZoom, attributionControl: false });
    if (!alwaysZoom) {
      map.on('focus', function () { map.scrollWheelZoom.enable(); });
      map.on('blur', function () { map.scrollWheelZoom.disable(); });
    }
    L.control.attribution({ prefix: false }).addTo(map);
    tileLayer(key).addTo(map);

    var anyFuzzy = points.some(function (p) { return p.fuzzy; });

    var lats = points.map(function (p) { return p.lat; });
    var lngs = points.map(function (p) { return p.lng; });
    var bounds = L.latLngBounds(
      [Math.min.apply(null, lats), Math.min.apply(null, lngs)],
      [Math.max.apply(null, lats), Math.max.apply(null, lngs)]
    );

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], anyFuzzy ? 13 : 15);
    } else {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: anyFuzzy ? 14 : 15 });
    }

    map.whenReady(function () {
      points.forEach(function (p) {
        var layer;
        if (p.fuzzy) {
          layer = L.circle([p.lat, p.lng], {
            radius: 700,
            color: '#e08a2e',
            weight: 1.5,
            fillColor: '#e08a2e',
            fillOpacity: 0.14
          });
        } else {
          layer = L.marker([p.lat, p.lng], { icon: pinIcon, riseOnHover: true });
        }
        layer.bindPopup(popupHtml(p));
        layer.addTo(map);
      });
    });

    setTimeout(function () { map.invalidateSize(); }, 60);
  });
})();