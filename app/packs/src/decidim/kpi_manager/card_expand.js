// Expands a KPI/measure card in the public gallery on click (or Enter/Space)
// to reveal the full description, a larger navigable map, and the
// source/last-update/featured-by metadata - all hidden or truncated by
// default (see the stylesheet). Toggling is a plain attribute/CSS change -
// the content is already in the DOM - except for the map, whose container
// changes size via CSS (Leaflet needs invalidateSize()/setZoom() called
// explicitly afterwards, since it caches the size/zoom from init and won't
// notice a CSS-driven resize on its own) and which becomes draggable/
// zoomable only once expanded (see setInteractive()).

import { COLLAPSED_ZOOM, EXPANDED_ZOOM, setInteractive } from "src/decidim/kpi_manager/map_preview";

const toggleCard = (card) => {
  const wasExpanded = card.getAttribute("aria-expanded") === "true";
  const expanded = !wasExpanded;
  card.setAttribute("aria-expanded", expanded.toString());

  const mapContainer = card.querySelector("[data-kpi-manager-map]");
  const map = mapContainer?.kpiManagerMap;

  if (map) {
    // Let the CSS width/height transition run before Leaflet measures the
    // container again, or it picks up the pre-transition size.
    setTimeout(() => {
      map.invalidateSize();
      map.setZoom(expanded ? EXPANDED_ZOOM : COLLAPSED_ZOOM);
      setInteractive(mapContainer, expanded);
    }, 210);
  }
};

document.addEventListener("click", (event) => {
  // Once expanded, the map becomes a real navigable map (dragging, its own
  // zoom control): clicks/drags on it should pan/zoom it, not collapse the
  // card back.
  if (event.target.closest(".kpi-manager-card__map--interactive")) {
    return;
  }

  const card = event.target.closest("[data-kpi-manager-expand]");

  if (card) {
    toggleCard(card);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  if (event.target.closest(".kpi-manager-card__map--interactive")) {
    return;
  }

  const card = event.target.closest("[data-kpi-manager-expand]");

  if (card) {
    event.preventDefault();
    toggleCard(card);
  }
});
