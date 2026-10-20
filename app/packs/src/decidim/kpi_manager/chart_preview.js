// Draws the chart in a KPI card's [data-kpi-manager-chart] container (see
// decidim/kpi_manager/selections/index.html.erb) with Chart.js, already a
// dependency of decidim-core. The chart type comes from the KPI's
// `dashboard.chart.type` in the API; it plots the snapshotted value history,
// or - when there is none - the current value next to its target.
//
// The container sits in the card's details, hidden (display: none) until the
// card is expanded, so each chart is only created the first time it becomes
// visible: Chart.js can't size a canvas inside a hidden element.

import Chart from "chart.js/auto";

// API chart types that Chart.js names differently, or doesn't have.
const TYPE_ALIASES = {
  column: "bar",
  area: "line",
  pie: "pie",
  donut: "doughnut",
  polar: "polarArea"
};
const SUPPORTED_TYPES = ["bar", "line", "pie", "doughnut", "radar", "polarArea"];
const CIRCULAR_TYPES = ["pie", "doughnut", "polarArea"];
// One slice per point on pie-like charts, so they need distinct colors.
const CIRCULAR_PALETTE = ["#2a78b5", "#e8833a", "#3c9d5d", "#c94f7c", "#8a6cc4", "#d1b23a", "#4fb3bf", "#9c6644"];

const chartType = (type) => {
  const normalized = TYPE_ALIASES[String(type).toLowerCase()] || type;
  return SUPPORTED_TYPES.includes(normalized) ? normalized : "bar";
};

const cssColor = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

const formatTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(document.documentElement.lang || undefined, { dateStyle: "short", timeStyle: "short" });
};

// Value history over time, with the target as a flat dashed line on
// cartesian charts.
const historyConfig = (data, labels, type, color) => {
  const circular = CIRCULAR_TYPES.includes(type);
  const datasets = [{
    label: labels.value,
    data: data.history.map(([, value]) => value),
    backgroundColor: circular
      ? data.history.map((_point, index) => CIRCULAR_PALETTE[index % CIRCULAR_PALETTE.length])
      : color,
    borderColor: color,
    fill: false,
    tension: 0.3
  }];

  if (data.target !== null && !circular && type !== "radar") {
    datasets.push({
      type: "line",
      label: labels.target,
      data: data.history.map(() => data.target),
      borderColor: cssColor("--alert", "#ec5840"),
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false
    });
  }

  return { labels: data.history.map(([time]) => formatTime(time)), datasets };
};

// No history: just the current value, next to its target if there is one.
const valueConfig = (data, labels, color) => {
  const points = [[labels.value, data.value, color]];
  if (data.target !== null) {
    points.push([labels.target, data.target, cssColor("--gray-2", "#999")]);
  }

  return {
    labels: points.map(([label]) => label),
    datasets: [{
      label: labels.value,
      data: points.map(([, value]) => value),
      backgroundColor: points.map(([, , pointColor]) => pointColor)
    }]
  };
};

const initChart = (container) => {
  const data = JSON.parse(container.dataset.kpiManagerChart);
  const labels = JSON.parse(container.dataset.labels);
  const color = cssColor("--secondary", "#3e4c5c");
  const hasHistory = data.history.length > 1;
  // A single value vs target is a comparison of two bars whatever the
  // configured type: a line or radar of two points says nothing.
  const type = hasHistory ? chartType(data.type) : "bar";
  const circular = CIRCULAR_TYPES.includes(type);
  const unit = data.unit ? ` ${data.unit}` : "";

  container.kpiManagerChart = new Chart(container.querySelector("canvas"), {
    type,
    data: hasHistory ? historyConfig(data, labels, type, color) : valueConfig(data, labels, color),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: hasHistory && (circular || data.target !== null) },
        tooltip: {
          callbacks: { label: (context) => `${context.dataset.label}: ${context.formattedValue}${unit}` }
        }
      },
      scales: circular || type === "radar"
        ? {}
        : {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
          y: { beginAtZero: type === "bar", ticks: { callback: (value) => `${value}${unit}` } }
        }
    }
  });
};

const observer = new IntersectionObserver((entries) => {
  entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
    observer.unobserve(entry.target);
    initChart(entry.target);
  });
});

const scan = () => document.querySelectorAll("[data-kpi-manager-chart]:not([data-loaded])").forEach((container) => {
  container.dataset.loaded = "true";
  observer.observe(container);
});

document.addEventListener("DOMContentLoaded", () => {
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
