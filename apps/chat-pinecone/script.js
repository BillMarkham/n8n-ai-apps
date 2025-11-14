const chatContainer = document.getElementById("chat-container");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const connectionStatus = document.getElementById("connection-status");

const N8N_WEBHOOK_URL = "http://localhost:4000/chatpine";

// Scroll helper
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Add a message bubble
function addMessage(content, sender = "bot") {
  const bubble = document.createElement("div");
  bubble.classList.add("message-bubble");
  if (sender === "user") bubble.classList.add("user-bubble");
  else bubble.classList.add("bot-bubble");

  bubble.innerHTML = content;
  chatContainer.appendChild(bubble);
  scrollToBottom();
}

// Typing indicator
function showTyping() {
  const wrap = document.createElement("div");
  wrap.classList.add("message-bubble", "bot-bubble", "typing");

  wrap.innerHTML = `
    <div class="typing-bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;

  chatContainer.appendChild(wrap);
  scrollToBottom();
}

function removeTyping() {
  const t = document.querySelector(".typing");
  if (t) t.remove();
}

// Initial greeting (matches what you want)
function loadGreeting() {
  addMessage("Hello Bill 👋 I'm ready to help with your Pinecone RAG chat.", "bot");
}

loadGreeting();

// Call proxy → n8n, expecting TEXT (HTML) back
async function sendToN8N(question) {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    if (!res.ok) {
      return "Error contacting n8n webhook.";
    }

    const text = await res.text(); // n8n returns HTML/text
    return text;
  } catch (err) {
    return "Network error while contacting n8n.";
  }
}

// Form submission handler
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = messageInput.value.trim();
  if (!text) return;

  addMessage(text, "user");
  messageInput.value = "";

  showTyping();
  const reply = await sendToN8N(text);
  removeTyping();

  addMessage(reply, "bot");
});

// Optional: make the pill purely cosmetic for now
setTimeout(() => {
  connectionStatus.textContent = "● Connected";
  connectionStatus.style.background = "#ddffdd";
  connectionStatus.style.color = "#006600";
}, 500);
