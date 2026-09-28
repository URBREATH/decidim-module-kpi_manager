// Expands a KPI/measure card in the public gallery on click (or Enter/Space)
// to reveal its description, map and other details, hidden by default (see
// .kpi-manager-card__details in the stylesheet). Toggling is a plain
// attribute/CSS change - the content is already in the DOM - except for the
// map, which is only initialized the first time a card is expanded (see
// map_preview.js for why).

import { initMapIfNeeded } from "src/decidim/kpi_manager/map_preview";

const toggleCard = (card) => {
  const expanded = card.getAttribute("aria-expanded") === "true";
  card.setAttribute("aria-expanded", (!expanded).toString());

  if (!expanded) {
    initMapIfNeeded(card.querySelector("[data-kpi-manager-map]"));
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
