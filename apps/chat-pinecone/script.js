// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const N8N_URL = "http://localhost:5678/webhook/chatpine";   // your existing working n8n webhook

// ---------------------------------------------
// DOM ELEMENTS
// ---------------------------------------------
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const typingIndicator = document.getElementById("typingIndicator");
const themeToggle = document.getElementById("themeToggle");

// ---------------------------------------------
// THEME TOGGLE
// ---------------------------------------------
const THEME_KEY = "chatThemePref";

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  if (themeToggle) {
    themeToggle.textContent = nextTheme === "dark" ? "Light mode" : "Dark mode";
  }
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch (_) {
    // if storage is unavailable we silently ignore
  }
}

function initTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch (_) {
    stored = null;
  }

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

initTheme();

// ---------------------------------------------
// INITIAL GREETING (one-time)
// ---------------------------------------------
appendMessage(
  `<p>Hi, I'm your Pinecone RAG assistant.</p>`,
  "bot"
);

// ---------------------------------------------
// ADD MESSAGE TO SCREEN
// ---------------------------------------------
function appendMessage(html, sender) {
  const bubble = document.createElement("div");
  bubble.classList.add("message");

  if (sender === "user") bubble.classList.add("user");
  else bubble.classList.add("bot");

  bubble.innerHTML = html;

  chatContainer.appendChild(bubble);

  // scroll to latest
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ---------------------------------------------
// TYPING INDICATOR
// ---------------------------------------------
function showThinking() {
  typingIndicator.classList.remove("hidden");
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideThinking() {
  typingIndicator.classList.add("hidden");
}

// ---------------------------------------------
// SUBMIT HANDLER
// ---------------------------------------------
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  // Add user message
  appendMessage(text, "user");
  userInput.value = "";

  // Show thinking indicator
  showThinking();

  try {
    const res = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text })   // *** REQUIRED FOR YOUR n8n WORKFLOW ***
    });

    const html = await res.text();

    hideThinking();
    appendMessage(html, "bot");

  } catch (err) {
    hideThinking();
    appendMessage("<p>Error contacting n8n webhook.</p>", "bot");
  }
});
