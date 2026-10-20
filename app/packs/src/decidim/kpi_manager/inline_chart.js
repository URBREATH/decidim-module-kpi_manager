// Draws the chart of a period right after each KPI link inserted as a
// period chart (the KPI modal's "Insert chart", see editor_button.js, or a
// [[KPI#<id>~<granularity>/<from>/<to>: ...]] comment tag rendered by
// KpiRenderer): those links carry a `kpi_chart` param with the featured
// selection's id and the period. The history is fetched when the chart
// scrolls into view, so only KPIs still featured in a published gallery get
// one; the link itself stays as it is anyway.
//
// Loaded globally with link_preview.js, since these links end up in any
// published content. Links inside an editor are left alone: an extra node
// there would end up in the edited content.

import {
  aggregate, drawHistoryChart, fetchHistory, formatPeriod, parseChartParam, pointsInPeriod, resolution
} from "src/decidim/kpi_manager/history";

const chartSpec = (link) => {
  try {
    return parseChartParam(new URL(link.getAttribute("href"), window.location.origin).searchParams.get("kpi_chart"));
  } catch {
    return null;
  }
};

const draw = (box, { selectionId, period }) => {
  fetchHistory(selectionId, period).
    then((data) => {
      // The server already filters by period; this also drops points past
      // its last day in the viewer's own time zone.
      const points = pointsInPeriod(data.history || [], period);
      const labels = data.labels || {};
      if (points.length === 0) {
        box.querySelector(".kpi-manager-inline-chart__area").remove();
        box.append(labels.no_data_in_period || "");
        return;
      }

      const step = resolution(period);
      box.querySelector(".kpi-manager-inline-chart__title").textContent = `${data.name} · ${formatPeriod(period)}`;
      drawHistoryChart(box.querySelector("canvas"), {
        buckets: aggregate(points, step), step, type: data.chart_type, unit: data.unit, target: data.target, labels
      });
    }).
    catch(() => box.remove());
};

const observer = new IntersectionObserver((entries) => {
  entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
    observer.unobserve(entry.target);
    draw(entry.target, entry.target.kpiManagerChartSpec);
  });
});

const attach = (link) => {
  if (link.dataset.kpiManagerChart || link.closest("[contenteditable], .editor-container")) {
    return;
  }
  const spec = chartSpec(link);
  if (!spec) {
    return;
  }
  link.dataset.kpiManagerChart = "true";

  // A span, as the link usually sits inside a paragraph.
  const box = document.createElement("span");
  box.className = "kpi-manager-inline-chart";
  const title = document.createElement("span");
  title.className = "kpi-manager-inline-chart__title";
  // Sized wrapper: Chart.js sizes the canvas after its container.
  const area = document.createElement("span");
  area.className = "kpi-manager-inline-chart__area";
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", link.textContent.trim());
  area.appendChild(canvas);
  box.append(title, area);
  box.kpiManagerChartSpec = spec;
  link.after(box);
  observer.observe(box);
};

const scan = () => document.querySelectorAll("a.kpi-manager-link").forEach(attach);

document.addEventListener("DOMContentLoaded", () => {
  scan();
  // Comments get loaded (and added) after the page.
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
