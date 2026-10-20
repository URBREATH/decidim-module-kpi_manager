// KPI buttons: one added to every Decidim rich text editor toolbar (public
// and admin forms, e.g. blog posts and proposals), plus the one rendered in
// the comment form cell (overridden by decidim-idra, next to its saved
// datasets button). Both open the KPI modal (see kpi_modal.js), which lists
// the KPIs/measures featured in the current participatory space's KPI
// gallery and lets the author insert a KPI's current value, one of its past
// measurements, or the chart of its history over a period:
//
// - in rich text, as a bold link pointing to that gallery;
// - in comments, as a [[KPI#<id>...]] tag, turned into the same link on
//   display by KpiRenderer (see buildShortcode for why).

import { openKpiModal, label, getGalleryUrl, formatTime, valueWithUnit } from "src/decidim/kpi_manager/kpi_modal";
import { buildChartParam, formatPeriod } from "src/decidim/kpi_manager/history";

const escapeHtml = (value) => {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
};

const clean = (part) => (part ?? "").toString().replace(/\|/g, "/");

// The data shown on hover (see link_preview.js) has to travel through two
// filters: Decidim's server-side content sanitizer when the content is
// saved, AND - before that even happens - the editor's own Link mark, which
// only recognizes href/target/rel/class and silently drops anything else
// (title included) the moment the link is inserted. `href` is the one
// attribute both keep intact, so the data rides along in its query string
// instead; the base URL still points at the gallery, so the link keeps
// working normally when clicked.
//
// `choice` is what was picked in the KPI modal: null for the current value,
// `{ point }` for a past measurement (an `[isoTime, value]` history entry,
// which replaces the value and adds its time) or `{ period }` for the chart
// of a period, which adds the period to the hover data and a `kpi_chart`
// param, from which inline_chart.js draws the chart after the link.
const buildHref = (item, choice) => {
  const { point, period } = choice || {};
  const featuredBy = label("featured_by", "Featured by %{name}").replace("%{name}", item.featured_by ?? "");
  const value = point ? point[1] : item.value;
  const measuredAt = point ? formatTime(point[0]) : "";
  const periodLabel = period ? formatPeriod(period) : "";

  const params = new URLSearchParams({
    kpi: ["KPI", item.name, item.description, value, item.unit, item.source, item.recorded_at, featuredBy, measuredAt, periodLabel].
      map(clean).
      join("|")
  });
  if (period) {
    params.set("kpi_chart", buildChartParam(item.selection_id, period));
  }

  return `${getGalleryUrl()}?${params.toString()}`;
};

const linkText = (item, { point, period } = {}) => {
  if (period) {
    return label("chart_link", "%{name}: chart %{period}").replace("%{name}", item.name).replace("%{period}", formatPeriod(period));
  }
  const name = point ? `${item.name} (${formatTime(point[0])})` : item.name;
  return `${name}: ${valueWithUnit(point ? point[1] : item.value, item.unit)}`.trim();
};

// Builds the rich text inserted into the editor: a bold link reading
// "Name: value unit", "Name (date time): value unit" for a past measurement
// or "Name: chart <period>" for a period chart. If this space has no KPI
// gallery to link to, it falls back to plain bold text (and no chart).
const buildLinkHtml = (item, choice) => {
  const inner = `<strong>${escapeHtml(linkText(item, choice || {}))}</strong>`;

  const html = getGalleryUrl()
    ? `<a href="${escapeHtml(buildHref(item, choice))}" class="kpi-manager-link">${inner}</a>`
    : inner;

  return `${html}&nbsp;`;
};

// Comments are plain text (their sanitizer strips any link), so they get the
// [[KPI#<selection id>(@<measurement time>|~<granularity>/<from>/<to>): ...]]
// tag instead, which the server-side KpiRenderer turns into the same link as
// above. The rest of the tag is only there to keep it readable while still
// being typed.
const buildShortcode = (item, choice) => {
  const { point, period } = choice || {};
  let suffix = "";
  let parts = [item.name, valueWithUnit(point ? point[1] : item.value, item.unit), item.source, point ? point[0].slice(0, 10) : item.recorded_at];
  if (point) {
    suffix = `@${point[0]}`;
  } else if (period) {
    suffix = `~${period.granularity}/${period.from}/${period.to}`;
    parts = [item.name, formatPeriod(period), item.source];
  }

  return `[[KPI#${item.selection_id}${suffix}: ${parts.map((part) => clean(part).replace(/[[\]]/g, "").trim()).join(" | ")}]] `;
};

const insertIntoTextarea = (textarea, text) => {
  textarea.focus();
  textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, "end");
  // Lets the character counter and the submit button state catch up.
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
};

const attachButton = (container) => {
  const toolbar = container.querySelector(".editor-toolbar");
  const controller = window.Stimulus?.getControllerForElementAndIdentifier(container, "editor");

  if (!toolbar || !controller?.editor || toolbar.querySelector("[data-kpi-manager-button]")) {
    return false;
  }

  const group = document.createElement("div");
  group.className = "editor-toolbar-group";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-toolbar-control";
  button.dataset.kpiManagerButton = "true";
  button.textContent = label("button", "KPI");
  button.title = label("title", "Insert a KPI or measure");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openKpiModal((item, choice) => controller.editor.chain().focus().insertContent(buildLinkHtml(item, choice)).run());
  });
  group.appendChild(button);
  toolbar.appendChild(group);

  return true;
};

// The comment form's KPI button is rendered by the cell itself, with the
// id of the textarea it fills in.
document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-kpi-manager-comment-target]");
  const textarea = trigger && document.getElementById(trigger.dataset.kpiManagerCommentTarget);

  if (textarea) {
    event.preventDefault();
    openKpiModal((item, choice) => insertIntoTextarea(textarea, buildShortcode(item, choice)));
  }
});

const scan = () => document.querySelectorAll(".editor-container").forEach(attachButton);

document.addEventListener("DOMContentLoaded", () => {
  scan();
  // Editors are created lazily by Stimulus, and admin forms render extra
  // (per-locale) editors, so keep watching for new ones.
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
