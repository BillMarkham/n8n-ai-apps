// ===========================================================
// Chat Pinecone Web App — n8n RAG Frontend
// Bill Markham — final version with smooth top alignment
// ===========================================================

const API_BASE = "https://5af501d7ca3c.ngrok-free.app/chatpine"; // proxy endpoint

const chatContainer = document.getElementById("chat-container");
const chatInner = document.getElementById("chat-inner");
const inputField = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

let typingBubble = null;

// ===========================================================
// 🟢 Connection Status (auto-ping every 10s)
// ===========================================================
async function checkConnection() {
  try {
    const res = await fetch(API_BASE, { method: "OPTIONS" });
    const connected = res.ok;
    statusDot.style.background = connected ? "limegreen" : "red";
    statusText.textContent = connected ? "Connected" : "Disconnected";
  } catch {
    statusDot.style.background = "red";
    statusText.textContent = "Disconnected";
  }
}
checkConnection();
setInterval(checkConnection, 10000);

// ===========================================================
// 💬 Smooth scroll helper — align latest message ~50px below header
// ===========================================================
function scrollToMessage(element) {
  const containerRect = chatContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Slight positive offset to keep input bubble fully visible
  const offset = elementRect.top - containerRect.top + 10;

  // avoid small jitter
  if (Math.abs(offset) > 5) {
    chatContainer.scrollBy({
      top: offset,
      behavior: "smooth",
    });
  }
}

// ===========================================================
// 💬 Append message bubbles (user / bot)
// ===========================================================
function appendMessage(content, sender, isHTML = false) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender === "user" ? "user-message" : "bot-message");

  const bubble = document.createElement("div");
  bubble.classList.add(sender === "user" ? "user-bubble" : "bot-bubble");

  if (isHTML) {
    const sandbox = document.createElement("div");
    sandbox.classList.add("bot-html-wrapper");
    sandbox.innerHTML = content
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "")
      .replace(/\sstyle="[^"]*"/gi, "");
    bubble.appendChild(sandbox);
  } else {
    bubble.textContent = content;
  }

  msg.appendChild(bubble);
  chatInner.appendChild(msg);

  // Scroll the new message into position
  scrollToMessage(msg);
}

// ===========================================================
// ⌛ Typing indicator
// ===========================================================
function showTyping() {
  typingBubble = document.createElement("div");
  typingBubble.classList.add("message", "bot-message");

  const inner = document.createElement("div");
  inner.classList.add("bot-bubble");
  inner.innerHTML = `<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>`;

  typingBubble.appendChild(inner);
  chatInner.appendChild(typingBubble);
  scrollToMessage(typingBubble);
}

function hideTyping() {
  if (typingBubble) {
    typingBubble.remove();
    typingBubble = null;
  }
}

// ===========================================================
// 📤 Send user message to proxy → n8n
// ===========================================================
async function sendMessage() {
  const question = inputField.value.trim();
  if (!question) return;

  appendMessage(question, "user");
  inputField.value = "";
  showTyping();

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const raw = await res.text();
    hideTyping();

    if (!res.ok) {
      appendMessage(`HTTP ${res.status}: ${raw}`, "bot", true);
      return;
    }

    if (raw.trim().startsWith("<")) {
      appendMessage(raw, "bot", true);
    } else {
      try {
        const json = JSON.parse(raw);
        const output = json.answer || json.message || JSON.stringify(json);
        appendMessage(output, "bot", true);
      } catch {
        appendMessage(raw, "bot", true);
      }
    }

    // Keep reply visible and aligned
    scrollToMessage(chatInner.lastElementChild);
  } catch (err) {
    hideTyping();
    appendMessage("Error contacting n8n webhook.", "bot");
  }
}

// ===========================================================
// 🎛️ Event Listeners
// ===========================================================
sendButton.addEventListener("click", sendMessage);
inputField.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// ===========================================================
// 👋 Align greeting bubble when page first loads
// ===========================================================
window.addEventListener("load", () => {
  const firstMsg = chatInner.firstElementChild;
  if (firstMsg) scrollToMessage(firstMsg);
});
