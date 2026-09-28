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
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";

// City-level zoom in both states - close enough to place the point, far
// enough out to still recognize the city around it.
export const COLLAPSED_ZOOM = 10;
export const EXPANDED_ZOOM = 12;

// Leaflet's own pin, scaled down (its default size, ~25x41, is too big for
// a 56px thumbnail) - same familiar shape, just smaller, rather than a
// different marker style.
const markerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [16, 26],
  iconAnchor: [8, 26],
  shadowSize: [26, 26],
  shadowAnchor: [8, 26]
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
