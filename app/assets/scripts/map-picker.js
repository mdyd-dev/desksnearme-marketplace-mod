(function () {
  'use strict';

  var wrap = document.getElementById('lf-map-wrap');
  if (!wrap || !window.L) return;

  var TILE_STYLE = 'osm-bright';

  var key  = wrap.getAttribute('data-map-key');
  var latF = document.getElementById('lf-lat');
  var lngF = document.getElementById('lf-lng');
  var verF = document.getElementById('lf-geo-verified');
  var note = document.getElementById('lf-map-note');

  var map = null;
  var marker = null;

  var pinIcon = L.divIcon({
    className: 'geo-pin geo-pin--drag',
    html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke="#fff" stroke-width="1.1" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    iconSize: [34, 34],
    iconAnchor: [17, 33],
    popupAnchor: [0, -30]
  });

  function setNote(text, state) {
    if (!note) return;
    note.textContent = text;
    if (state) { note.setAttribute('data-state', state); }
    else { note.removeAttribute('data-state'); }
  }

  function commit(latlng) {
    latF.value = latlng.lat.toFixed(6);
    lngF.value = latlng.lng.toFixed(6);
    verF.value = 'true';
    setNote('Pin position saved \u2713', 'set');
  }

  function show(lat, lng, approx) {
    wrap.hidden = false;

    if (!map) {
      map = L.map('lf-map', { scrollWheelZoom: false }).setView([lat, lng], 17);

      var retina = L.Browser.retina ? '@2x' : '';
      L.tileLayer(
        'https://maps.geoapify.com/v1/tile/' + TILE_STYLE + '/{z}/{x}/{y}' + retina + '.png?apiKey=' + key,
        {
          maxZoom: 20,
          attribution: '<a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | \u00a9 <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> \u00a9 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
        }
      ).addTo(map);

      marker = L.marker([lat, lng], { draggable: true, autoPan: true, icon: pinIcon }).addTo(map);
      marker.on('dragend', function () { commit(marker.getLatLng()); });
      map.on('click', function (e) { marker.setLatLng(e.latlng); commit(e.latlng); });
    } else {
      map.setView([lat, lng], 17);
      marker.setLatLng([lat, lng]);
    }

    setTimeout(function () { map.invalidateSize(); }, 60);

    if (approx) {
      setNote('This address only resolved to the street — please drag the pin to the exact entrance.', 'cleared');
    } else {
      setNote("This pin came from the address lookup \u2014 adjust it if it's off.", null);
    }
  }

  document.addEventListener('dnm:address-selected', function (e) {
    var d = e.detail || {};
    if (d.lat === undefined || d.lon === undefined) return;
    show(parseFloat(d.lat), parseFloat(d.lon), !!d.approx);
  });

  document.addEventListener('dnm:address-cleared', function () {
    wrap.hidden = true;
  });

  if (latF && latF.value && lngF && lngF.value) {
    show(parseFloat(latF.value), parseFloat(lngF.value), false);
    if (verF && verF.value === 'true') setNote('Pin position saved \u2713', 'set');
  }
})();