// Expands a KPI/measure card in the public gallery on click (or Enter/Space)
// to reveal the full description, a larger map, and the source/last-update/
// featured-by metadata - all hidden or truncated by default (see the
// stylesheet). Toggling is a plain attribute/CSS change - the content is
// already in the DOM - except for the map's container, which changes size
// via CSS and needs Leaflet explicitly told to recompute it afterwards.

import { COLLAPSED_ZOOM, EXPANDED_ZOOM } from "src/decidim/kpi_manager/map_preview";

const toggleCard = (card) => {
  const wasExpanded = card.getAttribute("aria-expanded") === "true";
  const expanded = !wasExpanded;
  card.setAttribute("aria-expanded", expanded.toString());

  const map = card.querySelector("[data-kpi-manager-map]")?.kpiManagerMap;

  if (map) {
    // Let the CSS width/height transition run before Leaflet measures the
    // container again, or it picks up the pre-transition size.
    setTimeout(() => {
      map.invalidateSize();
      map.setZoom(expanded ? EXPANDED_ZOOM : COLLAPSED_ZOOM);
    }, 210);
  }
};

document.addEventListener("click", (event) => {
  const card = event.target.closest("[data-kpi-manager-expand]");

  if (card) {
    toggleCard(card);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const card = event.target.closest("[data-kpi-manager-expand]");

  if (card) {
    event.preventDefault();
    toggleCard(card);
  }
});
