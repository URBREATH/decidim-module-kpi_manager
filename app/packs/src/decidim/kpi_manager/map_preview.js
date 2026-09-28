// Renders a small, non-interactive map (OpenStreetMap tiles via Leaflet,
// already a dependency of this app - no API key, no Decidim.maps config
// needed) in a KPI card's [data-kpi-manager-map] container (see
// decidim/kpi_manager/selections/index.html.erb). It is decorative only:
// no dragging/zooming. The container is a small square by default and
// grows into a full map when the card is expanded (see the stylesheet and
// card_expand.js, which calls invalidateSize()/setZoom() after that resize
// - Leaflet caches the size/zoom it had at init and doesn't notice a
// CSS-driven resize on its own).

import L from "leaflet";

export const COLLAPSED_ZOOM = 12;
export const EXPANDED_ZOOM = 15;

// A small centered dot instead of Leaflet's default pin (which is anchored
// at its bottom tip, not its center, and too large/detailed to read well at
// 56px) - styled in the stylesheet as .kpi-manager-card__marker.
const markerIcon = L.divIcon({
  className: "kpi-manager-card__marker",
  iconSize: [10, 10],
  iconAnchor: [5, 5]
});

const initMap = (container) => {
  const lat = parseFloat(container.dataset.lat);
  const lng = parseFloat(container.dataset.lng);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return;
  }

  const map = L.map(container, {
    center: [lat, lng],
    zoom: COLLAPSED_ZOOM,
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

  L.marker([lat, lng], { icon: markerIcon }).addTo(map);

  // Stashed so card_expand.js can call invalidateSize()/setZoom() on it once
  // the container is resized (small square <-> full map).
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
