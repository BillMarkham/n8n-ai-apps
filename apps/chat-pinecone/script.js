const chatContainer = document.getElementById("chat-container");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const connectionStatus = document.getElementById("connection-status");

const N8N_WEBHOOK_URL = "http://localhost:4000/chatpine";

/* Smooth scroll helper */
function scrollToBottom() {
  setTimeout(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, 50);
}

/* Render a chat bubble */
function addMessage(content, sender = "bot") {
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${sender}-bubble`;
  bubble.innerHTML = content;
  chatContainer.appendChild(bubble);
  scrollToBottom();
}

/* Typing indicator */
function showTyping() {
  const bubble = document.createElement("div");
  bubble.className = "message-bubble bot-bubble typing";
  bubble.innerHTML = `
    <div class="typing-bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  chatContainer.appendChild(bubble);
  scrollToBottom();
}

function removeTyping() {
  const t = document.querySelector(".typing");
  if (t) t.remove();
}

/* Greeting */
function loadGreeting() {
  addMessage("I'm ready to help with your Pinecone RAG chat.", "bot");
}
loadGreeting();

/* Call proxy → n8n */
async function sendToN8N(question) {
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    if (!res.ok) return "Error contacting n8n webhook.";

    return await res.text();
  } catch {
    return "Network error contacting n8n.";
  }
}

/* Submit handler */
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

/* Fake connection pill */
setTimeout(() => {
  connectionStatus.textContent = "● Connected";
  connectionStatus.style.background = "#ddffdd";
  connectionStatus.style.color = "#006600";
}, 300);
