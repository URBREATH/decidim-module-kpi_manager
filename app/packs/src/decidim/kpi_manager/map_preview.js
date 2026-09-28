// Renders a small, non-interactive map (OpenStreetMap tiles via Leaflet,
// already a dependency of this app - no API key, no Decidim.maps config
// needed) in a KPI card's [data-kpi-manager-map] container (see
// decidim/kpi_manager/selections/index.html.erb). It is decorative only:
// no dragging/zooming. The container is a small square by default and
// grows into a full map when the card is expanded (see the stylesheet and
// card_expand.js, which calls invalidateSize() after that resize - Leaflet
// caches the size it had at init and doesn't notice CSS-driven resizes on
// its own).

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

const initMap = (container) => {
  const lat = parseFloat(container.dataset.lat);
  const lng = parseFloat(container.dataset.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return;
  }

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

  // Stashed so card_expand.js can call invalidateSize() on it once the
  // container is resized (small square <-> full map).
  container.kpiManagerMap = map;
};

const scan = () => document.querySelectorAll("[data-kpi-manager-map]:not([data-loaded])").forEach((container) => {
  container.dataset.loaded = "true";
  initMap(container);
});

document.addEventListener("DOMContentLoaded", () => {
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
