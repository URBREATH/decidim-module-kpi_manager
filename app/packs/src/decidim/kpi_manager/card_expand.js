// Expands a KPI/measure card in the public gallery on click (or Enter/Space)
// to show its full description, instead of the 2-line clamp shown by
// default. Purely a CSS toggle - the full text is already in the DOM (see
// .kpi-manager-card__description in the stylesheet), so no fetch involved.

const toggleCard = (card) => {
  const expanded = card.getAttribute("aria-expanded") === "true";
  card.setAttribute("aria-expanded", (!expanded).toString());
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
