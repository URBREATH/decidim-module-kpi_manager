// A KPI's snapshotted value history (`[[isoTime, value], ...]`, oldest
// first, see ApiClient#history) seen over a period: filtering it between
// two calendar days, averaging it by day or month when the period is long,
// and plotting it with Chart.js. Shared by the KPI modal's period picker
// (kpi_modal.js) and by the period charts embedded in content
// (inline_chart.js), so both draw the same chart for the same period.
//
// A period is `{ granularity, from, to }`: `from`/`to` are local calendar
// days ("YYYY-MM-DD", both included) and `granularity` ("day", "month" or
// "year") is the unit it was picked in, which is how it gets displayed.

import Chart from "chart.js/auto";

const ENDPOINT = "/kpi_manager/history";

export const GRANULARITIES = ["day", "month", "year"];

const pad = (number) => String(number).padStart(2, "0");
export const locale = () => document.documentElement.lang || undefined;

// Local calendar day of a Date or ISO time, so periods match the times shown.
export const dayKey = (time) => {
  const date = time instanceof Date ? time : new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parseDay = (key) => new Date(`${key}T00:00:00`);

export const addDays = (key, days) => {
  const date = parseDay(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};

export const monthStart = (key) => `${key.slice(0, 7)}-01`;
export const monthEnd = (key) => {
  const date = parseDay(monthStart(key));
  return dayKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};
export const yearStart = (key) => `${key.slice(0, 4)}-01-01`;
export const yearEnd = (key) => `${key.slice(0, 4)}-12-31`;

// Widens a period to whole months/years when picked in those units.
export const snapPeriod = ({ granularity, from, to }) => {
  if (granularity === "month") {
    return { granularity, from: monthStart(from), to: monthEnd(to) };
  }
  if (granularity === "year") {
    return { granularity, from: yearStart(from), to: yearEnd(to) };
  }
  return { granularity, from, to };
};

// [start, end) instants: from the first day's midnight to the one after the last day.
const periodBounds = ({ from, to }) => [parseDay(from), parseDay(addDays(to, 1))];

export const pointsInPeriod = (history, period) => {
  const [start, end] = periodBounds(period);
  return history.filter(([time]) => {
    const date = new Date(time);
    return date >= start && date < end;
  });
};

export const formatTime = (iso) => new Date(iso).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" });
export const formatHour = (iso) => new Date(iso).toLocaleTimeString(locale(), { timeStyle: "short" });
export const formatDay = (key, dateStyle = "medium") => parseDay(key).toLocaleDateString(locale(), { dateStyle });
export const formatMonth = (key, month = "long") => parseDay(monthStart(key)).toLocaleDateString(locale(), { month, year: "numeric" });

export const formatPeriod = ({ granularity, from, to }) => {
  const format = { day: formatDay, month: formatMonth, year: (key) => key.slice(0, 4) }[granularity] || formatDay;
  const [start, end] = [format(from), format(to)];
  return start === end ? start : `${start} – ${end}`;
};

// How finely a period gets plotted: every measurement for up to a week
// (hourly data: ~170 points), daily averages up to about six months, then
// monthly averages - so a year of hourly data stays readable.
export const resolution = ({ from, to }) => {
  const days = Math.round((parseDay(to) - parseDay(from)) / 86400000) + 1;
  if (days <= 7) {
    return "raw";
  }
  return days <= 186 ? "day" : "month";
};

// The points as plotted: each measurement, or the average of each day/month
// (`from`/`to` being the bucket's own period, to drill down into it).
export const aggregate = (points, step) => {
  if (step === "raw") {
    return points.map(([time, value]) => ({ key: time, time, value, count: 1 }));
  }

  const buckets = new Map();
  points.forEach(([time, value]) => {
    const day = dayKey(time);
    const key = step === "day" ? day : day.slice(0, 7);
    if (!buckets.has(key)) {
      buckets.set(key, { key, from: step === "day" ? day : monthStart(day), to: step === "day" ? day : monthEnd(day), sum: 0, count: 0 });
    }
    const bucket = buckets.get(key);
    bucket.sum += value;
    bucket.count += 1;
  });

  return [...buckets.values()].map((bucket) => ({ ...bucket, value: Math.round((bucket.sum / bucket.count) * 100) / 100 }));
};

export const bucketLabel = (bucket, step) => {
  if (step === "raw") {
    return formatTime(bucket.time);
  }
  return step === "day" ? formatDay(bucket.key, "short") : formatMonth(bucket.key, "short");
};

export const valueWithUnit = (value, unit) => [value, unit].filter((part) => part !== null && part !== undefined && part !== "").join(" ");

const cssColor = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// Line for line/area KPIs, bars otherwise: pie-like types make no sense
// over time.
const chartType = (type) => (["line", "area"].includes(String(type).toLowerCase()) ? "line" : "bar");

// `labels` comes from the "editor" translations (see CatalogController);
// `onClick(bucket)` makes the points clickable.
export const drawHistoryChart = (canvas, { buckets, step, type, unit, target, labels, onClick }) => {
  const color = cssColor("--secondary", "#3e4c5c");
  const seriesLabel = { raw: labels.value, day: labels.daily_average, month: labels.monthly_average }[step] || labels.value;
  const datasets = [{
    label: seriesLabel,
    data: buckets.map((bucket) => bucket.value),
    backgroundColor: color,
    borderColor: color,
    borderWidth: 1.5,
    pointRadius: 1.5,
    tension: 0.3
  }];

  if (target !== null && target !== undefined && target !== "") {
    datasets.push({
      type: "line",
      label: labels.target,
      data: buckets.map(() => Number(target)),
      borderColor: cssColor("--alert", "#ec5840"),
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false
    });
  }

  return new Chart(canvas, {
    type: chartType(type),
    data: { labels: buckets.map((bucket) => bucketLabel(bucket, step)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${valueWithUnit(context.formattedValue, unit)}` } }
      },
      scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } } },
      onClick: (_event, elements) => {
        if (onClick && elements.length) {
          onClick(buckets[elements[0].index]);
        }
      }
    }
  });
};

// A featured KPI's history (see CatalogController#history), optionally only
// within a period, plus what's needed to plot it: name, unit, target,
// chart type and the chart's labels.
export const fetchHistory = (selectionId, period = null) => {
  const params = new URLSearchParams();
  if (period) {
    const [start, end] = periodBounds(period);
    params.set("from", start.toISOString());
    params.set("to", end.toISOString());
  }
  const query = params.toString();

  return fetch(`${ENDPOINT}/${encodeURIComponent(selectionId)}.json${query ? `?${query}` : ""}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin"
  }).then((response) => {
    if (!response.ok) {
      throw new Error(response.status);
    }
    return response.json();
  });
};

// The `kpi_chart` query param of a KPI link inserted as a period chart:
// "<selection id>~<granularity>~<from>~<to>".
export const buildChartParam = (selectionId, { granularity, from, to }) => [selectionId, granularity, from, to].join("~");

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const parseChartParam = (value) => {
  const [selectionId, granularity, from, to] = String(value || "").split("~");
  if (!/^\d+$/.test(selectionId || "") || !GRANULARITIES.includes(granularity) || !DAY.test(from || "") || !DAY.test(to || "")) {
    return null;
  }
  return { selectionId, period: { granularity, from, to } };
};
