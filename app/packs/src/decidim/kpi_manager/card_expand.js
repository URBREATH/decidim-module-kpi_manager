// Expands a KPI card (in the public gallery) on click to show, on demand,
// the measures that KPI is computed from. Only cards with
// [data-kpi-manager-expand] (KPIs, not measures) are clickable.

const escapeHtml = (value) => {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
};

const renderMeasures = (panel, items, emptyLabel) => {
  if (items.length === 0) {
    panel.innerHTML = `<p class="kpi-manager-card__measures-empty">${escapeHtml(emptyLabel)}</p>`;
    return;
  }

  panel.innerHTML = items.map((item) => `
    <div class="kpi-manager-card__measure">
      <span class="kpi-manager-card__measure-name">${escapeHtml(item.name)}</span>
      <span class="kpi-manager-card__measure-value">${escapeHtml(item.value)} ${escapeHtml(item.unit)}</span>
    </div>
  `).join("");
};

const toggleCard = (card) => {
  const panel = card.querySelector(".kpi-manager-card__measures");
  const expanded = card.getAttribute("aria-expanded") === "true";

  card.setAttribute("aria-expanded", (!expanded).toString());
  panel.hidden = expanded;

  if (expanded || card.dataset.loaded) {
    return;
  }

  panel.hidden = false;
  panel.innerHTML = `<p class="kpi-manager-card__measures-empty">${card.dataset.loadingLabel}</p>`;

  fetch(card.dataset.measuresUrl, { headers: { Accept: "application/json" }, credentials: "same-origin" }).
    then((response) => response.json()).
    then((data) => {
      card.dataset.loaded = "true";
      renderMeasures(panel, data.items || [], card.dataset.emptyLabel);
    }).
    catch(() => {
      panel.innerHTML = `<p class="kpi-manager-card__measures-empty">${card.dataset.emptyLabel}</p>`;
    });
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
