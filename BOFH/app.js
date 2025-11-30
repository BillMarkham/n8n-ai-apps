import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.2/+esm";

const supabaseUrlInput = document.getElementById("supabaseUrl");
const supabaseKeyInput = document.getElementById("supabaseKey");
const pageSizeInput = document.getElementById("pageSize");
const connectionStatus = document.getElementById("connectionStatus");
const summaryBody = document.getElementById("summaryBody");
const summaryMeta = document.getElementById("summaryMeta");
const pageIndicator = document.getElementById("pageIndicator");
const pageUpBtn = document.getElementById("pageUpBtn");
const pageDownBtn = document.getElementById("pageDownBtn");
const detailPageUpBtn = document.getElementById("detailPageUpBtn");
const detailPageDownBtn = document.getElementById("detailPageDownBtn");
const detailPubDate = document.getElementById("detailPubDate");
const detailSummary = document.getElementById("detailSummary");
const detailContent = document.getElementById("detailContent");
const summaryView = document.getElementById("summaryView");
const detailView = document.getElementById("detailView");
const returnBtn = document.getElementById("returnBtn");

const state = {
  client: null,
  page: 0,
  pageSize: 12,
  rows: [],
  total: null,
  loading: false,
  selectedGlobalIndex: null,
};

function loadSavedSettings() {
  const savedUrl = localStorage.getItem("bofh_supabase_url") || "";
  const savedKey = localStorage.getItem("bofh_supabase_key") || "";
  const savedPageSize = localStorage.getItem("bofh_page_size");
  if (savedUrl) supabaseUrlInput.value = savedUrl;
  if (savedKey) supabaseKeyInput.value = savedKey;
  if (savedPageSize) {
    pageSizeInput.value = savedPageSize;
    state.pageSize = Number(savedPageSize);
  }
}

function saveSettings(url, key, pageSize) {
  localStorage.setItem("bofh_supabase_url", url);
  localStorage.setItem("bofh_supabase_key", key);
  localStorage.setItem("bofh_page_size", String(pageSize));
}

function setConnectionStatus(text, tone = "muted") {
  connectionStatus.textContent = text;
  connectionStatus.style.color = tone === "error" ? "#b9484a" : tone === "ok" ? "#1b7a46" : "#364a63";
}

function formatDate(value) {
  if (!value) return "---";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  doc.querySelectorAll("script,style,link,iframe,object,embed").forEach((el) => el.remove());
  return doc.body.innerHTML || "<p class='muted'>No clean_html provided.</p>";
}

function renderPlaceholder(message) {
  summaryBody.innerHTML = `
    <tr class="empty-row">
      <td colspan="2">${message}</td>
    </tr>
  `;
}

function renderRows() {
  if (!state.client) {
    renderPlaceholder("Connect to Supabase to load bofh_episodes.");
    return;
  }

  if (state.loading) {
    renderPlaceholder("Loading episodes...");
    return;
  }

  if (!state.rows.length) {
    renderPlaceholder("No episodes found on this page.");
    return;
  }

  summaryBody.innerHTML = "";
  state.rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.index = index;
    tr.innerHTML = `
      <td class="col-date">${formatDate(row.pub_date)}</td>
      <td>
        <div class="summary-text">${row.summary || "No summary available."}</div>
      </td>
    `;
    summaryBody.appendChild(tr);
  });
}

function updatePaginationMeta() {
  const totalPages = state.total ? Math.max(1, Math.ceil(state.total / state.pageSize)) : null;
  const currentPage = state.page + 1;
  pageIndicator.textContent = totalPages ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`;

  const showingFrom = state.total ? state.page * state.pageSize + 1 : null;
  const showingTo = state.total ? Math.min((state.page + 1) * state.pageSize, state.total) : null;
  if (showingFrom && showingTo && state.total) {
    summaryMeta.textContent = `Showing ${showingFrom}-${showingTo} of ${state.total} bofh_episodes`;
  } else if (state.client) {
    summaryMeta.textContent = "Connected to Supabase - bofh_episodes";
  }

  pageUpBtn.disabled = state.page === 0 || state.loading;
  if (totalPages) {
    pageDownBtn.disabled = state.page >= totalPages - 1 || state.loading;
  } else {
    pageDownBtn.disabled = state.loading;
  }

  const pageMaxIndex = state.page * state.pageSize + state.rows.length - 1;
  const atStart = state.selectedGlobalIndex === null || state.selectedGlobalIndex <= 0;
  const atEnd =
    state.selectedGlobalIndex === null
      ? true
      : state.total !== null
        ? state.selectedGlobalIndex >= state.total - 1
        : state.selectedGlobalIndex >= pageMaxIndex;
  detailPageUpBtn.disabled = atStart || state.loading;
  detailPageDownBtn.disabled = atEnd || state.loading;
}

async function loadPage(targetPage, options = {}) {
  const { preserveSelection = false } = options;
  if (!state.client) {
    setConnectionStatus("Add Supabase URL and key, then Connect.", "muted");
    return false;
  }
  if (targetPage < 0) return false;
  if (state.total !== null && targetPage * state.pageSize >= state.total && state.total !== 0) return false;

  state.loading = true;
  renderRows();
  updatePaginationMeta();
  const from = targetPage * state.pageSize;
  const to = from + state.pageSize - 1;

  const { data, error, count } = await state.client
    .from("bofh_episodes")
    .select("id,pub_date,summary,clean_html", { count: "exact" })
    .order("pub_date", { ascending: false })
    .range(from, to);

  state.loading = false;

  if (error) {
    setConnectionStatus("Error loading bofh_episodes", "error");
    summaryMeta.textContent = error.message;
    renderPlaceholder(error.message);
    updatePaginationMeta();
    return false;
  }

  state.page = targetPage;
  state.rows = data || [];
  state.total = typeof count === "number" ? count : state.total;
  if (!preserveSelection) {
    state.selectedGlobalIndex = null;
  }
  setConnectionStatus("Connected", "ok");
  renderRows();
  updatePaginationMeta();
  return true;
}

function toggleView(showDetail) {
  if (showDetail) {
    summaryView.classList.add("hidden");
    detailView.classList.remove("hidden");
  } else {
    detailView.classList.add("hidden");
    summaryView.classList.remove("hidden");
  }
}

function openDetail(row, localIndex) {
  if (!row) return;
  const globalIndex = state.page * state.pageSize + localIndex;
  state.selectedGlobalIndex = globalIndex;
  detailPubDate.textContent = formatDate(row.pub_date);
  detailSummary.textContent = row.summary || "No summary available.";
  detailContent.innerHTML = sanitizeHtml(row.clean_html);
  toggleView(true);
  updatePaginationMeta();
}

async function shiftDetail(offset) {
  if (state.selectedGlobalIndex === null) return;
  const target = state.selectedGlobalIndex + offset;
  if (target < 0) return;
  if (state.total !== null && target >= state.total) return;

  const desiredPage = Math.floor(target / state.pageSize);
  if (desiredPage !== state.page) {
    const ok = await loadPage(desiredPage, { preserveSelection: true });
    if (!ok) return;
  }

  const localIndex = target - state.page * state.pageSize;
  const row = state.rows[localIndex];
  if (row) openDetail(row, localIndex);
}

async function handleConnect(event) {
  event.preventDefault();
  const url = supabaseUrlInput.value.trim();
  const key = supabaseKeyInput.value.trim();
  const size = Number(pageSizeInput.value) || state.pageSize;

  if (!url || !key) {
    setConnectionStatus("Supabase URL and anon key are required.", "error");
    return;
  }

  state.pageSize = Math.min(Math.max(size, 5), 100);
  pageSizeInput.value = state.pageSize;
  state.client = createClient(url, key);
  saveSettings(url, key, state.pageSize);
  state.page = 0;
  state.selectedGlobalIndex = null;
  summaryMeta.textContent = "Connecting to Supabase...";
  await loadPage(0);
}

function setupInteractions() {
  document.getElementById("connectionForm").addEventListener("submit", handleConnect);
  pageDownBtn.addEventListener("click", () => loadPage(state.page + 1));
  pageUpBtn.addEventListener("click", () => loadPage(state.page - 1));

  summaryBody.addEventListener("dblclick", (event) => {
    const row = event.target.closest("tr");
    if (!row) return;
    const index = Number(row.dataset.index);
    openDetail(state.rows[index], index);
  });

  returnBtn.addEventListener("click", () => toggleView(false));
  detailPageDownBtn.addEventListener("click", () => shiftDetail(1));
  detailPageUpBtn.addEventListener("click", () => shiftDetail(-1));
}

function init() {
  loadSavedSettings();
  setupInteractions();
}

init();
