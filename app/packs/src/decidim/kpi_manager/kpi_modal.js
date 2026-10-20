// Modal opened by the KPI buttons (rich text editor toolbar and comment
// forms, see editor_button.js) to pick what to insert. Laid out like the
// IDRA "Saved datasets" modal, in two steps:
//
// 1. the KPIs/measures featured in the current space's KPI gallery, each
//    with "Current value" (inserted right away) and "Past measurement";
// 2. the KPI's snapshotted history over a period, picked between two days,
//    months or years: plotted as a chart (averaged by day or month when the
//    period is long, click a day/month to zoom into it) and listed below,
//    to insert either one measurement or the chart of the whole period.
//
// The data comes from /kpi_manager/catalog.json and, for the history,
// /kpi_manager/history/:id.json (CatalogController): past measurements are
// the history snapshotted when the admin featured or refreshed the KPI,
// since participants can't call the KPI API themselves.

import {
  GRANULARITIES, aggregate, addDays, bucketLabel, dayKey, drawHistoryChart, fetchHistory, formatMonth,
  formatPeriod, formatTime, monthEnd, monthStart, pointsInPeriod, resolution, snapPeriod, valueWithUnit
} from "src/decidim/kpi_manager/history";

export { formatTime, valueWithUnit };

const ENDPOINT = "/kpi_manager/catalog.json";
let labels = {};
let galleryUrl = null;

export const label = (key, fallback) => labels[key] || fallback;
export const getGalleryUrl = () => galleryUrl;

const currentSpaceGid = () => document.querySelector('meta[name="context-current-participatory-space"]')?.content;

let itemsPromise = null;
const loadItems = () => {
  if (!itemsPromise) {
    const gid = currentSpaceGid();
    const url = gid ? `${ENDPOINT}?participatory_space_gid=${encodeURIComponent(gid)}` : ENDPOINT;

    itemsPromise = fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" }).
      then((response) => {
        if (!response.ok) {
          throw new Error(response.status);
        }
        return response.json();
      }).
      then((data) => {
        labels = data.labels || {};
        galleryUrl = data.gallery_url || null;
        return data.items;
      }).
      catch((error) => {
        itemsPromise = null;
        throw error;
      });
  }
  return itemsPromise;
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
};

let current = null;

const closeModal = () => {
  current?.chart?.destroy();
  current?.overlay.remove();
  current?.returnFocus?.focus();
  current = null;
};

const field = (text, control) => {
  const wrapper = el("label", "kpi-manager-modal__field");
  wrapper.append(el("span", null, text), control);
  return wrapper;
};

// Every month ("YYYY-MM") and year the history covers, for the period selects.
const coveredMonths = (firstDay, lastDay) => {
  const months = [];
  for (let key = monthStart(firstDay); key <= lastDay; key = addDays(monthEnd(key), 1)) {
    months.push(key.slice(0, 7));
  }
  return months;
};

const coveredYears = (firstDay, lastDay) => {
  const years = [];
  for (let year = Number(firstDay.slice(0, 4)); year <= Number(lastDay.slice(0, 4)); year += 1) {
    years.push(String(year));
  }
  return years;
};

// Step 2b: the history over a period picked between two days, months or
// years (the latest week at first).
const renderPeriodPicker = (item, history, onInsert) => {
  const { body } = current;
  body.innerHTML = "";

  if (history.length === 0) {
    body.appendChild(el("p", "kpi-manager-modal__empty", label("no_history", "No past measurements available yet.")));
    return;
  }

  const firstDay = dayKey(history[0][0]);
  const lastDay = dayKey(history[history.length - 1][0]);
  const latestWeek = addDays(lastDay, -6);
  const months = coveredMonths(firstDay, lastDay);
  const years = coveredYears(firstDay, lastDay);
  const chartLabels = {
    value: label("value", "Value"),
    target: label("target", "Target"),
    daily_average: label("daily_average", "Daily average"),
    monthly_average: label("monthly_average", "Monthly average")
  };

  let period = { granularity: "day", from: latestWeek > firstDay ? latestWeek : firstDay, to: lastDay };
  let selectedTime = history[history.length - 1][0];
  let selectedPoint = null;
  let step = "raw";
  let buckets = [];
  let rows = new Map();

  const granularitySelect = el("select");
  GRANULARITIES.forEach((granularity) => {
    const option = el("option", null, label(`granularity_${granularity}`, granularity));
    option.value = granularity;
    granularitySelect.appendChild(option);
  });
  const bounds = el("div", "kpi-manager-modal__bounds");
  const periodBox = el("div", "kpi-manager-modal__period");
  periodBox.append(field(label("period", "Period"), granularitySelect), bounds);

  const chartBox = el("div", "kpi-manager-modal__chart");
  const canvas = el("canvas");
  chartBox.appendChild(canvas);
  const summary = el("p", "kpi-manager-modal__summary");
  const list = el("div", "kpi-manager-modal__scroll kpi-manager-modal__points");

  const insertActions = el("div", "kpi-manager-modal__insert-actions");
  const insertPoint = el("button", "button button__sm button__secondary kpi-manager-modal__insert");
  insertPoint.type = "button";
  const insertChart = el("button", "button button__sm button__transparent-secondary kpi-manager-modal__insert");
  insertChart.type = "button";
  insertActions.append(insertPoint, insertChart);

  body.append(periodBox, chartBox, summary, list, insertActions);

  // Highlights the picked measurement, without redrawing the chart.
  const showSelection = () => {
    selectedPoint = step === "raw" ? history.find(([time]) => time === selectedTime) || null : null;
    rows.forEach((row, key) => row.setAttribute("aria-pressed", String(key === selectedTime)));
    rows.get(selectedTime)?.scrollIntoView({ block: "nearest" });

    if (current.chart && step === "raw") {
      const dataset = current.chart.data.datasets[0];
      const color = dataset.borderColor;
      const highlight = getComputedStyle(document.documentElement).getPropertyValue("--alert").trim() || "#ec5840";
      dataset.backgroundColor = buckets.map((bucket) => (bucket.key === selectedTime ? highlight : color));
      dataset.pointRadius = buckets.map((bucket) => (bucket.key === selectedTime ? 5 : 1.5));
      current.chart.update("none");
    }

    insertPoint.hidden = !selectedPoint;
    if (selectedPoint) {
      insertPoint.textContent = label("insert_measurement", "Insert %{date}: %{value}").
        replace("%{date}", formatTime(selectedPoint[0])).
        replace("%{value}", valueWithUnit(selectedPoint[1], item.unit));
    }
  };

  // A measurement gets picked; a day or month (averaged) gets zoomed into.
  // Deferred: the chart is redrawn, so not from inside its own click handler.
  const pick = (bucket) => {
    if (step === "raw") {
      selectedTime = bucket.time;
      showSelection();
      return;
    }
    const granularity = step === "day" ? "day" : "month";
    window.setTimeout(() => setPeriod({ granularity, from: bucket.from, to: bucket.to })); // eslint-disable-line no-use-before-define
  };

  const update = () => {
    const points = pointsInPeriod(history, period);
    step = resolution(period);
    buckets = aggregate(points, step);
    if (step === "raw" && points.length && !points.some(([time]) => time === selectedTime)) {
      selectedTime = points[points.length - 1][0];
    }

    current.chart?.destroy();
    current.chart = null;
    chartBox.hidden = buckets.length === 0;
    if (buckets.length) {
      current.chart = drawHistoryChart(canvas, {
        buckets, step, type: item.chart_type, unit: item.unit, target: item.target, labels: chartLabels, onClick: pick
      });
    }

    if (buckets.length === 0) {
      summary.textContent = label("no_data_in_period", "No measurements in this period.");
    } else {
      summary.textContent = label(`hint_${step}`, "");
    }

    list.innerHTML = "";
    rows = new Map();
    buckets.forEach((bucket) => {
      const row = el("button", "kpi-manager-modal__point");
      row.type = "button";
      const when = step === "raw" ? formatTime(bucket.time) : bucketLabel(bucket, step);
      const value = el("strong", null, valueWithUnit(bucket.value, item.unit));
      row.append(el("span", null, when));
      if (step !== "raw") {
        row.append(el("span", "kpi-manager-modal__count", label("measurements_count", "%{count} measurements").replace("%{count}", bucket.count)));
      }
      row.append(value);
      row.addEventListener("click", () => pick(bucket));
      list.appendChild(row);
      rows.set(bucket.key, row);
    });
    if (step !== "raw") {
      list.scrollTop = list.scrollHeight;
    }

    insertChart.disabled = points.length === 0;
    insertChart.textContent = label("insert_chart", "Insert chart: %{period}").replace("%{period}", formatPeriod(period));

    showSelection();
  };

  const boundControl = (which) => {
    const { granularity } = period;
    let control = null;
    if (granularity === "day") {
      control = el("input");
      control.type = "date";
      control.min = firstDay;
      control.max = lastDay;
      control.value = period[which];
    } else {
      control = el("select");
      (granularity === "month" ? months : years).forEach((key) => {
        const option = el("option", null, granularity === "month" ? formatMonth(key) : key);
        option.value = key;
        control.appendChild(option);
      });
      control.value = period[which].slice(0, granularity === "month" ? 7 : 4);
    }
    control.addEventListener("change", () => changeBound(which, control.value)); // eslint-disable-line no-use-before-define
    return control;
  };

  const setPeriod = (next) => {
    period = next;
    granularitySelect.value = period.granularity;
    bounds.innerHTML = "";
    bounds.append(field(label("from", "From"), boundControl("from")), field(label("to", "To"), boundControl("to")));
    update();
  };

  // Moving one end past the other drags the other one along.
  const changeBound = (which, value) => {
    if (!value) {
      return;
    }
    const { granularity } = period;
    const day = { day: value, month: `${value}-01`, year: `${value}-01-01` }[granularity];
    let { from, to } = period;
    if (which === "from") {
      from = day;
      to = to < from ? from : to;
    } else {
      to = day;
      from = from > to ? to : from;
    }
    setPeriod(snapPeriod({ granularity, from, to }));
  };

  granularitySelect.addEventListener("change", () => setPeriod(snapPeriod({ ...period, granularity: granularitySelect.value })));

  // Closed first: closing gives focus back to the button that opened it,
  // which would otherwise steal it from the text just inserted.
  insertPoint.addEventListener("click", () => {
    const point = selectedPoint;
    closeModal();
    onInsert(item, { point });
  });
  insertChart.addEventListener("click", () => {
    const chosen = period;
    closeModal();
    onInsert(item, { period: chosen });
  });

  setPeriod(period);
};

// Step 2: loads the KPI's history (it isn't part of the catalog: it can be
// long), then shows the period picker.
const renderMeasurementStep = (item, onInsert) => {
  const { body, title } = current;
  body.innerHTML = "";
  current.chart?.destroy();
  current.chart = null;

  const back = el("button", "kpi-manager-modal__back", `‹ ${label("back", "Back")}`);
  back.type = "button";
  back.addEventListener("click", () => renderListStep(onInsert)); // eslint-disable-line no-use-before-define
  title.textContent = item.name;
  title.prepend(back);

  // Ignores the answer if the author went back (or closed) meanwhile.
  const request = {};
  current.request = request;
  body.appendChild(el("p", "kpi-manager-modal__empty", "…"));

  fetchHistory(item.selection_id).
    then((data) => {
      if (current?.request === request) {
        renderPeriodPicker(item, data.history || [], onInsert);
      }
    }).
    catch(() => {
      if (current?.request === request) {
        body.innerHTML = "";
        body.appendChild(el("p", "kpi-manager-modal__empty", label("history_error", "Could not load the past measurements.")));
      }
    });
};

const renderItem = (item, onInsert) => {
  const row = el("div", "kpi-manager-modal__item");

  const info = el("div", "kpi-manager-modal__info");
  info.append(
    el("strong", "kpi-manager-modal__name", item.name),
    el("span", "kpi-manager-modal__meta", [item.source, item.recorded_at].filter(Boolean).join(" · "))
  );

  const value = el("span", "kpi-manager-modal__value", valueWithUnit(item.value, item.unit));

  const actions = el("div", "kpi-manager-modal__actions");
  const currentButton = el("button", "button button__sm button__secondary", label("current_value", "Current value"));
  currentButton.type = "button";
  currentButton.addEventListener("click", () => {
    closeModal();
    onInsert(item, null);
  });
  actions.appendChild(currentButton);

  const pastButton = el("button", "button button__sm button__transparent-secondary", `${label("pick_measurement", "Past measurement")} ›`);
  pastButton.type = "button";
  // Even a single point is a dated measurement worth quoting.
  if (item.has_history) {
    pastButton.addEventListener("click", () => renderMeasurementStep(item, onInsert));
  } else {
    pastButton.disabled = true;
    pastButton.title = label("no_history", "No past measurements available yet.");
  }
  actions.appendChild(pastButton);

  row.append(info, value, actions);
  return row;
};

// Step 1: the list of KPIs, with a search box.
const renderListStep = (onInsert) => {
  const { body, title } = current;
  current.request = null;
  current.chart?.destroy();
  current.chart = null;
  title.textContent = label("modal_title", "KPIs & measures");
  body.innerHTML = "";

  const search = el("input", "kpi-manager-modal__search");
  search.type = "search";
  search.placeholder = label("search", "Search…");
  const list = el("div", "kpi-manager-modal__scroll");
  body.append(search, list);

  const renderList = (items) => {
    list.innerHTML = "";
    const query = search.value.trim().toLowerCase();
    const filtered = items.filter((item) => item.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
      list.appendChild(el("p", "kpi-manager-modal__empty", label("empty", "No KPIs found.")));
      return;
    }
    filtered.forEach((item) => list.appendChild(renderItem(item, onInsert)));
  };

  list.appendChild(el("p", "kpi-manager-modal__empty", "…"));
  loadItems().
    then((items) => {
      if (!current) {
        return;
      }
      renderList(items);
      search.addEventListener("input", () => renderList(items));
      search.focus();
    }).
    catch(() => {
      list.innerHTML = "";
      list.appendChild(el("p", "kpi-manager-modal__empty", label("error", "Could not load your KPIs.")));
    });
};

// Opens the modal; `onInsert(item, choice)` gets the chosen KPI and either
// null (current value), `{ point }` (an `[isoTime, value]` history point)
// or `{ period }` (the chart of a period, see history.js).
export const openKpiModal = (onInsert) => {
  closeModal();

  const overlay = el("div", "kpi-manager-modal-overlay");
  const modal = el("div", "kpi-manager-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = el("div", "kpi-manager-modal__header");
  const title = el("h2", "kpi-manager-modal__title title-decorator");
  title.id = "kpi-manager-modal-title";
  modal.setAttribute("aria-labelledby", title.id);
  const close = el("button", "kpi-manager-modal__close", "×");
  close.type = "button";
  close.setAttribute("aria-label", label("close", "Close"));
  close.addEventListener("click", closeModal);
  header.append(title, close);

  const body = el("div", "kpi-manager-modal__body");
  modal.append(header, body);
  overlay.appendChild(modal);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });
  document.body.appendChild(overlay);

  current = { overlay, title, body, chart: null, returnFocus: document.activeElement };
  renderListStep(onInsert);
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && current) {
    closeModal();
  }
});
