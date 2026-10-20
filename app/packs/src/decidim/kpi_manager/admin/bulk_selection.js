// Bulk actions on the admin's featured KPIs list and KPI catalog (see
// admin/selections/index.html.erb): within each [data-kpi-manager-bulk]
// block, the header checkbox checks/unchecks every row, and the bulk
// buttons are only enabled - and show how many rows they'll act on - while
// at least one row is checked.

const update = (form) => {
  const items = [...form.querySelectorAll("[data-kpi-manager-bulk-item]")];
  const checked = items.filter((item) => item.checked).length;

  const all = form.querySelector("[data-kpi-manager-bulk-all]");
  if (all) {
    all.checked = checked > 0 && checked === items.length;
    all.indeterminate = checked > 0 && checked < items.length;
  }

  form.querySelectorAll("[data-kpi-manager-bulk-action]").forEach((button) => {
    button.disabled = checked === 0;
  });
  form.querySelectorAll("[data-kpi-manager-bulk-count]").forEach((count) => {
    count.textContent = checked > 0 ? `(${checked})` : "";
  });
};

document.addEventListener("change", (event) => {
  const form = event.target.closest("[data-kpi-manager-bulk]");
  if (!form) {
    return;
  }

  if (event.target.matches("[data-kpi-manager-bulk-all]")) {
    form.querySelectorAll("[data-kpi-manager-bulk-item]").forEach((item) => {
      item.checked = event.target.checked;
    });
  }
  update(form);
});

document.addEventListener("DOMContentLoaded", () => {
  // Browsers may restore checkbox states on back navigation.
  document.querySelectorAll("[data-kpi-manager-bulk]").forEach(update);
});
