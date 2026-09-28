// Renders a small, non-interactive map (OpenStreetMap tiles via Leaflet,
// already a dependency of this app - no API key, no Decidim.maps config
// needed) in a KPI card's [data-kpi-manager-map] container (see
// decidim/kpi_manager/selections/index.html.erb). It is decorative only:
// no dragging/zooming.
//
// Not initialized on page load: the container starts hidden
// (display: none, inside .kpi-manager-card__details) until the card is
// expanded, and Leaflet can't size a map inside a hidden element. Instead,
// initMapIfNeeded is called from card_expand.js right after a card is
// expanded, when the container is actually visible.

import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Leaflet's default marker icons reference relative image paths that break
// once bundled; point them at the actual (fingerprinted) asset URLs instead.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

export const initMapIfNeeded = (container) => {
  if (!container || container.dataset.loaded) {
    return;
  }

  const lat = parseFloat(container.dataset.lat);
  const lng = parseFloat(container.dataset.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return;
  }

  container.dataset.loaded = "true";

  const map = L.map(container, {
    center: [lat, lng],
    zoom: 13,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    zoomControl: false,
    attributionControl: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    // Required by OpenStreetMap's tile usage policy - do not remove.
    attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
    maxZoom: 18
  }).addTo(map);

  L.marker([lat, lng]).addTo(map);

  // The container had a size of 0x0 while hidden; now that it's visible,
  // Leaflet needs to recompute it or the tiles render offset/cropped.
  requestAnimationFrame(() => map.invalidateSize());
};
