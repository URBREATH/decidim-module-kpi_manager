// Adds an "Insert KPI" button to every Decidim rich text editor toolbar
// (public and admin forms, e.g. blog posts and proposals). It lists the
// signed-in user's KPIs/measures from /kpi_manager/kpis.json and inserts the
// selected `[[kpi ...]]` shortcode at the cursor.

const ENDPOINT = "/kpi_manager/kpis.json";
let labels = {};
const label = (key, fallback) => labels[key] || fallback;

let itemsPromise = null;
const loadItems = () => {
  if (!itemsPromise) {
    itemsPromise = fetch(ENDPOINT, { headers: { Accept: "application/json" }, credentials: "same-origin" }).
      then((response) => {
        if (!response.ok) {
          throw new Error(response.status);
        }
        return response.json();
      }).
      then((data) => {
        labels = data.labels || {};
        return data.items;
      }).
      catch((error) => {
        itemsPromise = null;
        throw error;
      });
  }
  return itemsPromise;
};

const closePicker = () => document.querySelectorAll(".kpi-manager-picker").forEach((el) => el.remove());

const renderItems = (list, items, query, insert) => {
  list.innerHTML = "";
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "kpi-manager-picker__empty";
    empty.textContent = label("empty", "No KPIs found.");
    list.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kpi-manager-picker__item";

    const text = document.createElement("span");
    text.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "kpi-manager-picker__meta";
    meta.textContent = [item.source, item.recorded_at].filter(Boolean).join(" · ");
    text.appendChild(meta);

    const value = document.createElement("span");
    value.className = "kpi-manager-picker__value";
    value.textContent = `${item.value ?? ""} ${item.unit ?? ""}`.trim();

    button.append(text, value);
    button.addEventListener("click", () => insert(item));
    list.appendChild(button);
  });
};

const openPicker = (anchor, editor) => {
  closePicker();

  const picker = document.createElement("div");
  picker.className = "kpi-manager-picker";
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", label("title", "Insert a KPI or measure"));

  const search = document.createElement("input");
  search.type = "search";
  search.className = "kpi-manager-picker__search";
  search.placeholder = label("search", "Search…");
  const list = document.createElement("div");
  picker.append(search, list);

  const rect = anchor.getBoundingClientRect();
  picker.style.top = `${rect.bottom + window.scrollY + 4}px`;
  picker.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;
  document.body.appendChild(picker);
  search.focus();

  const insert = (item) => {
    editor.chain().focus().insertContent(`${item.shortcode} `).run();
    closePicker();
  };

  loadItems().
    then((items) => {
      renderItems(list, items, "", insert);
      search.addEventListener("input", () => renderItems(list, items, search.value, insert));
    }).
    catch(() => {
      list.textContent = label("error", "Could not load your KPIs.");
      list.className = "kpi-manager-picker__empty";
    });
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
    openPicker(button, controller.editor);
  });
  group.appendChild(button);
  toolbar.appendChild(group);

  return true;
};

const scan = () => document.querySelectorAll(".editor-container").forEach(attachButton);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".kpi-manager-picker, [data-kpi-manager-button]")) {
    closePicker();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  scan();
  // Editors are created lazily by Stimulus, and admin forms render extra
  // (per-locale) editors, so keep watching for new ones.
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
