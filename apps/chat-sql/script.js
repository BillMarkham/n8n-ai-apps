// ---------------------------------------------
// CONFIGURATION
// ---------------------------------------------
const CONFIG = {
  title: "RAG with SQL",
  description: "Ask structured data questions and route them to the SQL workflow.",
  placeholder: "Ask about KPIs, joins, or dashboards...",
  typingText: "SQL assistant is thinking...",
  webhook: "http://localhost:5678/webhook/chatsql",
};

const STORAGE_KEYS = {
  theme: "chatSqlThemePref",
};

// ---------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const typingIndicator = document.getElementById("typingIndicator");
const themeToggle = document.getElementById("themeToggle");
const newThreadBtn = document.getElementById("newThreadBtn");
const panelGreeting = document.getElementById("panelGreeting");
const panelSubtitle = document.getElementById("panelSubtitle");

// ---------------------------------------------
// STATE
// ---------------------------------------------
let conversation = [];

// ---------------------------------------------
// STORAGE HELPERS
// ---------------------------------------------
function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // ignore storage failures (private browsing, etc.)
  }
}

// ---------------------------------------------
// RENDERING
// ---------------------------------------------
function createBubble({ sender, html }) {
  const bubble = document.createElement("div");
  bubble.classList.add("message");
  bubble.classList.add(sender === "user" ? "user" : "bot");
  bubble.innerHTML = html;
  return bubble;
}

function renderConversation() {
  if (!chatContainer) return;
  chatContainer.innerHTML = "";
  conversation.forEach((message) => chatContainer.appendChild(createBubble(message)));
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage(message) {
  conversation.push(message);
  renderConversation();
}

function escapeHtml(input = "") {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

function plainTextToHtml(text = "") {
  return escapeHtml(text).replace(/\n/g, "<br />");
}

function normalizeBotPayload(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const maybeHtml = trimmed.startsWith("<") && trimmed.endsWith(">");
  if (maybeHtml) return trimmed;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const candidate =
        (parsed && (parsed.html || parsed.output || parsed.answer || parsed.result)) || "";
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim().startsWith("<")
          ? candidate
          : plainTextToHtml(candidate);
      }
    } catch (_) {
      // fall through to plain-text conversion
    }
  }

  return plainTextToHtml(trimmed);
}

// ---------------------------------------------
// THEME HANDLING
// ---------------------------------------------
function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = next;
  if (themeToggle) {
    themeToggle.textContent = next === "dark" ? "Light mode" : "Dark mode";
  }
  safeStorageSet(STORAGE_KEYS.theme, next);
}

function initTheme() {
  const stored = safeStorageGet(STORAGE_KEYS.theme);
  if (stored) {
    applyTheme(stored);
    return;
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.body.dataset.theme || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

// ---------------------------------------------
// TYPING INDICATOR
// ---------------------------------------------
function showThinking() {
  if (!typingIndicator) return;
  typingIndicator.textContent = CONFIG.typingText;
  typingIndicator.classList.remove("hidden");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideThinking() {
  if (!typingIndicator) return;
  typingIndicator.classList.add("hidden");
}

// ---------------------------------------------
// ACTIONS
// ---------------------------------------------
function resetConversation() {
  conversation = [];
  renderConversation();
  if (userInput) {
    userInput.value = "";
    userInput.focus();
  }
}

async function sendPrompt(prompt) {
  showThinking();

  try {
    const res = await fetch(CONFIG.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: prompt }),
    });

    const html = await res.text();
    const normalized = normalizeBotPayload(html);
    hideThinking();
    addMessage({
      sender: "bot",
      html: normalized || "<p>Your SQL workflow returned an empty response.</p>",
    });
  } catch (err) {
    hideThinking();
    addMessage({
      sender: "bot",
      html: "<p>Error contacting the SQL webhook. Confirm n8n is running.</p>",
    });
  }
}

// ---------------------------------------------
// EVENT LISTENERS
// ---------------------------------------------
if (chatForm) {
  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = (userInput?.value || "").trim();
    if (!prompt) return;

    addMessage({ sender: "user", html: escapeHtml(prompt) });
    if (userInput) userInput.value = "";
    sendPrompt(prompt);
  });
}

if (newThreadBtn) {
  newThreadBtn.addEventListener("click", resetConversation);
}

// ---------------------------------------------
// INITIALIZE
// ---------------------------------------------
function hydratePanelCopy() {
  if (panelGreeting) panelGreeting.textContent = CONFIG.title;
  if (panelSubtitle) panelSubtitle.textContent = CONFIG.description;
  if (userInput) userInput.placeholder = CONFIG.placeholder;
  if (typingIndicator) typingIndicator.textContent = CONFIG.typingText;
  if (newThreadBtn) newThreadBtn.title = "Start a fresh SQL thread";
}

hydratePanelCopy();
renderConversation();
initTheme();
