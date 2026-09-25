// Shows a detail card when hovering (or focusing) a KPI link inserted by
// the editor button (see editor_button.js). Runs globally - on any page,
// not just the editor - because these links end up in published content
// (proposals, blog posts, ...) read by anyone, not just their author.
//
// The KPI's name/value/unit/source/date/author travel in the link's query
// string (see editor_button.js for why: it's the one attribute that
// survives both the editor's own link parsing and Decidim's server-side
// sanitizer, unlike e.g. title or data-* attributes).
//
// The card reuses the exact same markup/classes as the public gallery (see
// decidim/kpi_manager/selections/index.html.erb) so it looks identical,
// down to the remixicon icons - whose sprite path (content-hashed by the
// asset pipeline) is read off any icon already on the page rather than
// hardcoded.

const parsed = new WeakMap();

const parseLink = (link) => {
  if (parsed.has(link)) {
    return parsed.get(link);
  }

  let data = null;

  try {
    const raw = new URL(link.getAttribute("href"), window.location.origin).searchParams.get("kpi") || "";
    const [marker, name, description, value, unit, source, recordedAt, featuredBy] = raw.split("|");

    data = marker === "KPI" ? { name, description, value, unit, source, recordedAt, featuredBy } : null;
  } catch {
    data = null;
  }

  parsed.set(link, data);

  return data;
};

const spriteHref = () => document.querySelector('svg use[href*="remixicon"]')?.getAttribute("href")?.split("#")[0];

const iconSvg = (name, extraClass = "") => {
  const sprite = spriteHref();

  if (!sprite) {
    return "";
  }

  return `<svg width="1em" height="1em" role="img" aria-hidden="true" class="${extraClass}"><use href="${sprite}#ri-${name}"></use></svg>`;
};

const escapeHtml = (value) => {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
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
  card.className = "card__grid kpi-manager-card kpi-manager-preview";
  card.setAttribute("role", "tooltip");

  card.innerHTML = `
    <div class="card__grid-text">
      <div class="kpi-manager-card__icon">${iconSvg("bar-chart-2-line", "w-5 h-5 text-white fill-current")}</div>
      <h3 class="h4 text-secondary">${escapeHtml(data.name)}</h3>
      ${data.description ? `<p class="text-sm text-gray-2">${escapeHtml(data.description)}</p>` : ""}
      <p class="kpi-manager-card__value">
        ${escapeHtml(data.value)} <span class="kpi-manager-card__unit">${escapeHtml(data.unit)}</span>
      </p>
      <div class="card__grid-metadata">
        ${data.source ? `<div>${iconSvg("map-pin-line")}${escapeHtml(data.source)}</div>` : ""}
        ${data.recordedAt ? `<div>${iconSvg("calendar-line")}${escapeHtml(data.recordedAt)}</div>` : ""}
      </div>
      ${data.featuredBy ? `<p class="text-sm text-gray-2 mt-2">${iconSvg("user-line", "inline-block")} ${escapeHtml(data.featuredBy)}</p>` : ""}
    </div>
  `;

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
