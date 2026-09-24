// Adds an "Insert KPI" button to every Decidim rich text editor toolbar
// (public and admin forms, e.g. blog posts and proposals). It lists the
// KPIs/measures already featured in the current participatory space's KPI
// component (the same ones shown in its public gallery) and inserts the
// selected one as a bold link - plain rich text, no brackets - pointing to
// that gallery.

const ENDPOINT = "/kpi_manager/catalog.json";
let labels = {};
let galleryUrl = null;
const label = (key, fallback) => labels[key] || fallback;

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

const escapeHtml = (value) => {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
};

// The data shown on hover (see link_preview.js) has to travel through two
// filters: Decidim's server-side content sanitizer when the content is
// saved, AND - before that even happens - the editor's own Link mark, which
// only recognizes href/target/rel/class and silently drops anything else
// (title included) the moment the link is inserted. `href` is the one
// attribute both keep intact, so the data rides along in its query string
// instead; the base URL still points at the gallery, so the link keeps
// working normally when clicked.
const buildHref = (item) => {
  const featuredBy = label("featured_by", "Featured by %{name}").replace("%{name}", item.featured_by ?? "");

  const params = new URLSearchParams({
    kpi: ["KPI", item.name, item.value, item.unit, item.source, item.recorded_at, featuredBy].
      map((part) => (part ?? "").toString().replace(/\|/g, "/")).
      join("|")
  });

  return `${galleryUrl}?${params.toString()}`;
};

// Builds the rich text inserted into the editor: a bold link reading
// "Name: value unit" (no brackets, no shortcode). If this space has no KPI
// gallery to link to, it falls back to plain bold text (not hoverable: with
// no href, there is no attribute left that survives insertion to carry the
// detail data through).
const buildInsertHtml = (item) => {
  const text = escapeHtml(`${item.name}: ${[item.value, item.unit].filter(Boolean).join(" ")}`.trim());
  const inner = `<strong>${text}</strong>`;

  const html = galleryUrl
    ? `<a href="${escapeHtml(buildHref(item))}" class="kpi-manager-link">${inner}</a>`
    : inner;

  return `${html}&nbsp;`;
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
    editor.chain().focus().insertContent(buildInsertHtml(item)).run();
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
