// ---------------------------------------------
// SHARED CONFIG
// ---------------------------------------------
// Expected webhook endpoints for smoke tests / configuration
const N8N_WEBHOOKS = {
  pinecone: "http://localhost:5678/webhook/chatpine",
  sql: "http://localhost:5678/webhook/chatsql",
  chatHtml: "https://c2a23186d2fa.ngrok-free.app/webhook/chathtml",
};

const BOT_CONFIGS = [
  {
    id: "pinecone",
    label: "Pinecone RAG",
    description: "Ask anything about the indexed Pinecone workspace.",
    placeholder: "Ask something about the Pinecone documents...",
    greeting: "Hi, I'm your Pinecone RAG assistant.",
    typingText: "Pinecone assistant is thinking...",
    webhook: N8N_WEBHOOKS.pinecone,
  },
  {
    id: "sql-analyst",
    label: "RAG with SQL",
    description: "Ask anything about the indexed SQL workspace via n8n.",
    placeholder: "Ask about KPIs, tables, or joins...",
    greeting: "Hi, I'm your RAG with SQL assistant.",
    typingText: "SQL assistant is thinking...",
    webhook: N8N_WEBHOOKS.sql,
  },
  {
    id: "chat-html",
    label: "Chat html",
    description: "Send prompts to the Chat html workflow via n8n.",
    placeholder: "Ask for HTML snippets or content to generate...",
    greeting: "Hi, I'm your Chat html assistant.",
    typingText: "Chat html assistant is thinking...",
    webhook: N8N_WEBHOOKS.chatHtml,
  },
];

const STORAGE_KEYS = {
  theme: "chatThemePref",
  activeBot: "chatActiveBotId",
};

const FALLBACK_PLACEHOLDER = "Enter your query here.";
const FALLBACK_TYPING = "n8n is thinking...";
const COPY = {
  emptyBotReply: "<p>Your workflow returned an empty response.</p>",
  webhookError: "<p>Error contacting the configured n8n webhook.</p>",
  disconnected:
    "<p>This assistant is not connected to an n8n workflow yet. Update <code>BOT_CONFIGS</code> with the webhook URL when it's ready.</p>",
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
const sendButton = chatForm?.querySelector('button[type="submit"]');
const panelGreeting = document.getElementById("panelGreeting");
const panelSubtitle = document.getElementById("panelSubtitle");
const botSwitcher = document.getElementById("botSwitcher");
const newThreadBtn = document.getElementById("newThreadBtn");

// ---------------------------------------------
// STATE
// ---------------------------------------------
const conversationStore = new Map();
const botChips = new Map();
let activeBotId = null;
const pendingBots = new Set();

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
    // storage may be disabled (private mode, etc.)
  }
}

function persistConversations() {
  // chat histories stay in-memory only for the active session
}

function hydrateConversations() {
  BOT_CONFIGS.forEach((bot) => {
    if (!conversationStore.has(bot.id)) {
      conversationStore.set(bot.id, []);
    }
  });
}

// ---------------------------------------------
// BOT HELPERS
// ---------------------------------------------
function getBot(botId) {
  return BOT_CONFIGS.find((bot) => bot.id === botId);
}

function getActiveBot() {
  return getBot(activeBotId);
}

function ensureConversation(botId) {
  if (!conversationStore.has(botId)) {
    conversationStore.set(botId, []);
  }

  return conversationStore.get(botId);
}

function resetConversation(botId) {
  conversationStore.set(botId, []);
  if (botId === activeBotId) {
    renderConversation(botId);
    pendingBots.delete(botId);
    updateThinkingIndicator();
    updateActionState();
  }
}

// ---------------------------------------------
// RENDERING
// ---------------------------------------------
function createBubble({ html, sender }) {
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

function renderConversation(botId) {
  if (!chatContainer) return;
  const conversation = ensureConversation(botId);
  const fragment = document.createDocumentFragment();
  conversation.forEach((message) => fragment.appendChild(createBubble(message)));
  chatContainer.replaceChildren(fragment);
  scrollChatToBottom();
}

function addMessageToConversation(botId, message) {
  const conversation = ensureConversation(botId);
  conversation.push(message);
  if (botId === activeBotId) {
    renderConversation(botId);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
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

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function normalizeBotPayload(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const looksHtml = trimmed.startsWith("<") && trimmed.endsWith(">");
  if (looksHtml) return trimmed;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = safeJsonParse(trimmed);
    const candidate = firstPresentField(parsed, BOT_PAYLOAD_FIELDS);
    if (isNonEmptyString(candidate)) {
      const cleaned = candidate.trim();
      return cleaned.startsWith("<") ? cleaned : plainTextToHtml(cleaned);
    }
  }

  return plainTextToHtml(trimmed);
}

// ---------------------------------------------
// SMOKE-TEST NOTE
// ---------------------------------------------
// To smoke test each workflow, POST JSON like { question: "hello" }
// to the matching URL in N8N_WEBHOOKS. The UI uses the same endpoints.

// ---------------------------------------------
// THEME TOGGLE
// ---------------------------------------------
function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  if (themeToggle) {
    themeToggle.textContent = nextTheme === "dark" ? "Light mode" : "Dark mode";
  }
  safeStorageSet(STORAGE_KEYS.theme, nextTheme);
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
// BOT SWITCHING UI
// ---------------------------------------------
function buildBotSwitcher() {
  if (!botSwitcher) return;
  botSwitcher.innerHTML = "";
  BOT_CONFIGS.forEach((bot) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = bot.label;
    btn.className = "bot-chip";
    btn.setAttribute("role", "tab");
    btn.setAttribute("data-bot-id", bot.id);
    btn.addEventListener("click", () => {
      if (activeBotId !== bot.id) {
        setActiveBot(bot.id);
      }
    });
    botSwitcher.appendChild(btn);
    botChips.set(bot.id, btn);
  });
}

function updateBotChipState() {
  botChips.forEach((btn, id) => {
    if (!btn) return;
    if (id === activeBotId) {
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
    } else {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    }
  });
}

function setActiveBot(botId) {
  const bot = getBot(botId) || BOT_CONFIGS[0];
  activeBotId = bot.id;
  safeStorageSet(STORAGE_KEYS.activeBot, bot.id);
  updateBotChipState();

  if (panelGreeting) {
    panelGreeting.textContent = bot.greeting || "Hi there!";
  }

  if (panelSubtitle) {
    panelSubtitle.textContent = bot.description || "";
  }

  if (userInput) {
    userInput.placeholder = bot.placeholder || FALLBACK_PLACEHOLDER;
  }

  if (typingIndicator) {
    typingIndicator.textContent = bot.typingText || FALLBACK_TYPING;
  }

  renderConversation(bot.id);
  updateThinkingIndicator();
  updateActionState();
}

// ---------------------------------------------
// ACTION STATE
// ---------------------------------------------
function updateActionState() {
  const bot = getActiveBot();
  const isPending = bot ? pendingBots.has(bot.id) : false;
  if (sendButton) {
    sendButton.disabled = isPending;
  }
}

// ---------------------------------------------
// TYPING INDICATOR
// ---------------------------------------------
function updateThinkingIndicator() {
  const bot = getActiveBot();
  if (!typingIndicator || !bot) return;

  const isPending = pendingBots.has(bot.id);
  if (isPending) {
    typingIndicator.textContent = bot.typingText || FALLBACK_TYPING;
    typingIndicator.classList.remove("hidden");
    scrollChatToBottom();
  } else {
    typingIndicator.classList.add("hidden");
  }
}

function showThinking(bot = getActiveBot()) {
  if (!bot) return;
  pendingBots.add(bot.id);
  updateThinkingIndicator();
  updateActionState();
}

function hideThinking(bot = getActiveBot()) {
  if (!bot) return;
  pendingBots.delete(bot.id);
  updateThinkingIndicator();
  updateActionState();
}

// ---------------------------------------------
// SUBMIT HANDLER
// ---------------------------------------------
if (chatForm) {
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const bot = getActiveBot();
    if (!bot) return;

    const text = (userInput?.value || "").trim();
    if (!text) return;

    addMessageToConversation(bot.id, { sender: "user", html: escapeHtml(text) });
    clearAndFocusInput();

    showThinking(bot);

    if (!bot.webhook) {
      addMessageToConversation(bot.id, {
        sender: "bot",
        html: COPY.disconnected,
      });
      hideThinking(bot);
      return;
    }

    try {
      const res = await fetch(bot.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, botId: bot.id }),
      });

      if (!res.ok) {
        throw new Error(`Webhook returned ${res.status}`);
      }

      const bodyText = await res.text();
      const normalized = normalizeBotPayload(bodyText);
      addMessageToConversation(bot.id, {
        sender: "bot",
        html: normalized || COPY.emptyBotReply,
      });
    } catch (err) {
      console.error(err);
      addMessageToConversation(bot.id, {
        sender: "bot",
        html: COPY.webhookError,
      });
    } finally {
      hideThinking(bot);
    }
  });
}

// ---------------------------------------------
// NEW THREAD HANDLER
// ---------------------------------------------
if (newThreadBtn) {
  newThreadBtn.addEventListener("click", () => {
    if (!activeBotId) return;
    resetConversation(activeBotId);
    clearAndFocusInput();
  });
}

function clearAndFocusInput() {
  if (!userInput) return;
  userInput.value = "";
  userInput.focus();
}

// ---------------------------------------------
// INITIALIZE
// ---------------------------------------------
hydrateConversations();
buildBotSwitcher();
const storedBotId = safeStorageGet(STORAGE_KEYS.activeBot);
setActiveBot(storedBotId && getBot(storedBotId) ? storedBotId : BOT_CONFIGS[0].id);
updateBotChipState();
initTheme();
