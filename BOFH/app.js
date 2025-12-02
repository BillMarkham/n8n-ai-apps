const EDGE_FUNCTION_URL = "https://uekubxqptklrqzprezcu.supabase.co/functions/v1/bofh-proxy";
// Supabase anon/public key is required to call Edge Functions. Service key stays server-side.
const EDGE_FUNCTION_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVla3VieHFwdGtscnF6cHJlemN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMjU5NDcsImV4cCI6MjA3MjkwMTk0N30.CkGArpC16uFHo3fXas8XXkzN0Uku9eHDy-b2-k71pMc";
const pageSizeInput = document.getElementById("pageSize");
const refreshBtn = document.getElementById("refreshBtn");
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
  page: 0,
  pageSize: 12,
  rows: [],
  total: null,
  loading: false,
  selectedGlobalIndex: null,
};

function loadSavedSettings() {
  const savedPageSize = localStorage.getItem("bofh_page_size");
  if (savedPageSize) {
    pageSizeInput.value = savedPageSize;
    state.pageSize = Number(savedPageSize);
  }
}

function saveSettings(pageSize) {
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
  } else {
    summaryMeta.textContent = "Using Supabase Edge function (service key stays server-side)";
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
  if (targetPage < 0) return false;
  if (!EDGE_FUNCTION_URL || EDGE_FUNCTION_URL.includes("YOUR_PROJECT_ID")) {
    setConnectionStatus("Set EDGE_FUNCTION_URL in app.js to your Supabase function URL.", "error");
    renderPlaceholder("Configure EDGE_FUNCTION_URL to load data.");
    return false;
  }
  if (state.total !== null && targetPage * state.pageSize >= state.total && state.total !== 0) return false;

  state.loading = true;
  renderRows();
  updatePaginationMeta();

  if (!EDGE_FUNCTION_ANON_KEY || EDGE_FUNCTION_ANON_KEY === "YOUR_SUPABASE_ANON_KEY") {
    setConnectionStatus("Set EDGE_FUNCTION_ANON_KEY in app.js to your Supabase anon key.", "error");
    renderPlaceholder("Missing EDGE_FUNCTION_ANON_KEY.");
    updatePaginationMeta();
    return false;
  }

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EDGE_FUNCTION_ANON_KEY,
      Authorization: `Bearer ${EDGE_FUNCTION_ANON_KEY}`,
    },
    body: JSON.stringify({ page: targetPage, pageSize: state.pageSize }),
  }).catch((err) => ({ ok: false, statusText: err.message }));

  state.loading = false;

  if (!response || !response.ok) {
    const message = response?.statusText || "Network error";
    setConnectionStatus("Error loading bofh_episodes", "error");
    summaryMeta.textContent = message;
    renderPlaceholder(message);
    updatePaginationMeta();
    return false;
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.error) {
    const message = payload?.error || "Unexpected response";
    setConnectionStatus("Error loading bofh_episodes", "error");
    summaryMeta.textContent = message;
    renderPlaceholder(message);
    updatePaginationMeta();
    return false;
  }

  state.page = targetPage;
  state.rows = payload.data || [];
  state.total = typeof payload.count === "number" ? payload.count : state.total;
  if (!preserveSelection) {
    state.selectedGlobalIndex = null;
  }
  setConnectionStatus("Connected via Edge function", "ok");
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

async function refreshData() {
  const size = Number(pageSizeInput.value) || state.pageSize;
  state.pageSize = Math.min(Math.max(size, 5), 100);
  pageSizeInput.value = state.pageSize;
  saveSettings(state.pageSize);
  state.page = 0;
  state.selectedGlobalIndex = null;
  summaryMeta.textContent = "Loading via Edge function...";
  await loadPage(0);
}

function setupInteractions() {
  refreshBtn.addEventListener("click", () => refreshData());
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
  refreshData();
}

init();
