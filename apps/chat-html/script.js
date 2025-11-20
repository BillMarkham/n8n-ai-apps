// ---------------------------------------------
// CONFIGURATION
// ---------------------------------------------
const N8N_WEBHOOK = "https://c2a23186d2fa.ngrok-free.app/webhook/chathtml"; // POST JSON { question }

const CONFIG = {
  title: "Chat html",
  description: "Send prompts to the Chat html workflow and render the returned HTML.",
  placeholder: "Ask for HTML snippets or content to generate...",
  typingText: "Chat html assistant is thinking...",
  webhook: N8N_WEBHOOK,
};

const STORAGE_KEYS = {
  theme: "chatHtmlThemePref",
};

const COPY = {
  emptyBotReply: "<p>Your Chat html workflow returned an empty response.</p>",
  webhookError: "<p>Error contacting the Chat html webhook. Confirm n8n is running.</p>",
};

const BOT_PAYLOAD_FIELDS = ["html", "output", "answer", "result"];

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

function scrollChatToBottom() {
  if (!chatContainer) return;
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function renderConversation() {
  if (!chatContainer) return;
  const fragment = document.createDocumentFragment();
  conversation.forEach((message) => fragment.appendChild(createBubble(message)));
  chatContainer.replaceChildren(fragment);
  scrollChatToBottom();
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim();
}

function firstPresentField(obj, fields) {
  return fields.map((field) => obj?.[field]).find(isNonEmptyString) || "";
}

function normalizeBotPayload(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const maybeHtml = trimmed.startsWith("<") && trimmed.endsWith(">");
  if (maybeHtml) return trimmed;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = safeJsonParse(trimmed);
    const candidate = firstPresentField(parsed, BOT_PAYLOAD_FIELDS);
    if (isNonEmptyString(candidate)) {
      return candidate.trim().startsWith("<") ? candidate : plainTextToHtml(candidate);
    }
  }

  return plainTextToHtml(trimmed);
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
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
  scrollChatToBottom();
}

function hideThinking() {
  if (!typingIndicator) return;
  typingIndicator.classList.add("hidden");
}

// ---------------------------------------------
// SMOKE-TEST NOTE
// ---------------------------------------------
// To smoke test the workflow directly, POST JSON like { question: "hello" }
// to N8N_WEBHOOK. The UI uses the same endpoint.

// ---------------------------------------------
// ACTIONS
// ---------------------------------------------
function resetConversation() {
  conversation = [];
  renderConversation();
  clearAndFocusInput();
}

function clearAndFocusInput() {
  if (!userInput) return;
  userInput.value = "";
  userInput.focus();
}

async function sendPrompt(prompt) {
  showThinking();

  try {
    const res = await fetch(CONFIG.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: prompt }),
    });

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}`);
    }

    const responseText = await res.text();
    const normalized = normalizeBotPayload(responseText);
    addMessage({
      sender: "bot",
      html: normalized || COPY.emptyBotReply,
    });
  } catch (err) {
    console.error(err);
    addMessage({
      sender: "bot",
      html: COPY.webhookError,
    });
  } finally {
    hideThinking();
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
    clearAndFocusInput();
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
  if (newThreadBtn) newThreadBtn.title = "Start a fresh Chat html thread";
}

hydratePanelCopy();
renderConversation();
initTheme();
