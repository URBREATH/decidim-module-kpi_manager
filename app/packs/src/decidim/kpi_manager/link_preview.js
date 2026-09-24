// Shows a detail card when hovering (or focusing) a KPI link inserted by
// the editor button (see editor_button.js). Runs globally - on any page,
// not just the editor - because these links end up in published content
// (proposals, blog posts, ...) read by anyone, not just their author.
//
// The KPI's name/value/unit/source/date travel in the link's query string
// (see editor_button.js for why: it's the one attribute that survives both
// the editor's own link parsing and Decidim's server-side sanitizer, unlike
// e.g. title or data-* attributes).

const parsed = new WeakMap();

const parseLink = (link) => {
  if (parsed.has(link)) {
    return parsed.get(link);
  }

  let data = null;

  try {
    const raw = new URL(link.getAttribute("href"), window.location.origin).searchParams.get("kpi") || "";
    const [marker, name, value, unit, source, recordedAt] = raw.split("|");

    data = marker === "KPI" ? { name, value, unit, source, recordedAt } : null;
  } catch {
    data = null;
  }

  parsed.set(link, data);

  return data;
};

let card = null;
const closeCard = () => {
  card?.remove();
  card = null;
};

const openCard = (link) => {
  const data = parseLink(link);

  if (!data) {
    return;
  }

  closeCard();

  card = document.createElement("div");
  card.className = "kpi-manager-preview";
  card.setAttribute("role", "tooltip");

  const rows = [
    data.value ? `${data.value} ${data.unit ?? ""}`.trim() : null,
    data.source || null,
    data.recordedAt || null
  ].filter(Boolean);

  card.innerHTML = `
    <strong class="kpi-manager-preview__name"></strong>
    ${rows.map(() => `<div class="kpi-manager-preview__row"><span></span></div>`).join("")}
  `;
  card.querySelector(".kpi-manager-preview__name").textContent = data.name;
  card.querySelectorAll(".kpi-manager-preview__row span").forEach((span, index) => {
    span.textContent = rows[index];
  });

  document.body.appendChild(card);

  const rect = link.getBoundingClientRect();
  card.style.top = `${rect.bottom + window.scrollY + 6}px`;
  card.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
};

document.addEventListener("mouseover", (event) => {
  const link = event.target.closest(".kpi-manager-link");

  if (link) {
    openCard(link);
  } else if (!event.target.closest(".kpi-manager-preview")) {
    closeCard();
  }
});

document.addEventListener("focusin", (event) => {
  const link = event.target.closest(".kpi-manager-link");

  if (link) {
    openCard(link);
  }
});

document.addEventListener("focusout", (event) => {
  if (event.target.closest(".kpi-manager-link")) {
    closeCard();
  }
});
