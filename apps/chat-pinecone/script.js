// ---------------------------------------------
// SHARED CONFIG
// ---------------------------------------------
const BOT_CONFIGS = [
  {
    id: "pinecone",
    label: "Pinecone RAG",
    description: "Ask anything about the indexed Pinecone workspace.",
    placeholder: "Ask something about the Pinecone documents...",
    greeting: "Hi, I'm your Pinecone RAG assistant.",
    typingText: "Pinecone assistant is thinking...",
    webhook: "http://localhost:5678/webhook/chatpine",
  },
  {
    id: "sql-analyst",
    label: "SQL Analyst",
    description: "Coming soon - query company data via SQL workflows.",
    placeholder: "Coming soon: ask SQL questions here.",
    greeting: "Hi, I'm your SQL analyst assistant.",
    typingText: "SQL analyst is thinking...",
    webhook: "", // update when the SQL chatbot workflow is ready
  },
  {
    id: "automation",
    label: "Automation Copilot",
    description: "Coming soon - orchestrate HTML + automation workflows.",
    placeholder: "Coming soon: describe an automation you'd like.",
    greeting: "Hi, I'm your automation copilot.",
    typingText: "Automation copilot is thinking...",
    webhook: "", // update when the automation chatbot workflow is ready
  },
];

const STORAGE_KEYS = {
  theme: "chatThemePref",
  conversations: "chatConversationsByBot",
  activeBot: "chatActiveBotId",
};

const FALLBACK_PLACEHOLDER = "Enter your query here.";
const FALLBACK_TYPING = "n8n is thinking...";

// ---------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const typingIndicator = document.getElementById("typingIndicator");
const themeToggle = document.getElementById("themeToggle");
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
  const serializable = {};
  conversationStore.forEach((messages, id) => {
    serializable[id] = messages;
  });

  safeStorageSet(STORAGE_KEYS.conversations, JSON.stringify(serializable));
}

function hydrateConversations() {
  const raw = safeStorageGet(STORAGE_KEYS.conversations);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      Object.keys(parsed).forEach((id) => {
        if (Array.isArray(parsed[id])) {
          conversationStore.set(id, parsed[id]);
        }
      });
    } catch (_) {
      // if parsing fails we start fresh
    }
  }

  BOT_CONFIGS.forEach((bot) => {
    if (!conversationStore.has(bot.id)) {
      conversationStore.set(bot.id, []);
    } else {
      stripGreetingBubbles(bot.id);
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

function stripGreetingBubbles(botId) {
  const bot = getBot(botId);
  if (!bot?.greeting) return;
  const greetingText = bot.greeting.trim();
  if (!greetingText) return;

  const conversation = ensureConversation(botId);
  const filtered = conversation.filter((message) => {
    if (message.sender !== "bot") return true;
    const div = document.createElement("div");
    div.innerHTML = message.html || "";
    const text = (div.textContent || "").trim();
    return text !== greetingText;
  });

  if (filtered.length !== conversation.length) {
    conversationStore.set(botId, filtered);
    persistConversations();
  }
}

function resetConversation(botId) {
  conversationStore.set(botId, []);
  persistConversations();
  if (botId === activeBotId) {
    renderConversation(botId);
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

function renderConversation(botId) {
  if (!chatContainer) return;
  const conversation = ensureConversation(botId);
  chatContainer.innerHTML = "";
  conversation.forEach((message) => {
    chatContainer.appendChild(createBubble(message));
  });
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessageToConversation(botId, message) {
  const conversation = ensureConversation(botId);
  conversation.push(message);
  persistConversations();
  if (botId === activeBotId) {
    renderConversation(botId);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

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
}

// ---------------------------------------------
// TYPING INDICATOR
// ---------------------------------------------
function showThinking(bot = getActiveBot()) {
  if (!typingIndicator) return;
  typingIndicator.textContent = bot?.typingText || FALLBACK_TYPING;
  typingIndicator.classList.remove("hidden");
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function hideThinking() {
  if (!typingIndicator) return;
  typingIndicator.classList.add("hidden");
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
    if (userInput) userInput.value = "";

    showThinking(bot);

    if (!bot.webhook) {
      hideThinking();
      addMessageToConversation(bot.id, {
        sender: "bot",
        html: `<p>This assistant is not connected to an n8n workflow yet. Update <code>BOT_CONFIGS</code> with the webhook URL when it's ready.</p>`,
      });
      return;
    }

    try {
      const res = await fetch(bot.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, botId: bot.id }),
      });

      const html = await res.text();
      hideThinking();
      addMessageToConversation(bot.id, {
        sender: "bot",
        html: html || "<p>Your workflow returned an empty response.</p>",
      });
    } catch (err) {
      hideThinking();
      addMessageToConversation(bot.id, {
        sender: "bot",
        html: "<p>Error contacting the configured n8n webhook.</p>",
      });
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
    if (userInput) {
      userInput.focus();
    }
  });
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
