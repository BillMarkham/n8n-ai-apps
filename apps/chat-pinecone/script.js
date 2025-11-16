// script.js – direct-call mode for chat-pinecone
// Uses http://localhost:5678/webhook/chatpine

document.addEventListener("DOMContentLoaded", () => {
  const n8nEndpoint = "http://localhost:5678/webhook/chatpine";

  const chatContainer = document.getElementById("chatContainer");
  const chatForm = document.getElementById("chatForm");
  const userInput = document.getElementById("userInput");
  const sendButton = document.getElementById("sendButton");
  const typingIndicator = document.getElementById("typingIndicator");

  function scrollToBottom(smooth = true) {
    if (!chatContainer) return;
    const opts = { top: chatContainer.scrollHeight };
    if (smooth) opts.behavior = "smooth";
    chatContainer.scrollTo(opts);
  }

  function setTyping(visible) {
    if (!typingIndicator) return;
    typingIndicator.classList.toggle("hidden", !visible);
    if (visible) scrollToBottom(false);
  }

  function appendMessage({ sender, text, html }) {
    const row = document.createElement("div");
    row.classList.add("message-row", sender === "user" ? "user" : "bot");

    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble", sender === "user" ? "user" : "bot", "fade-in");

    if (sender === "bot" && html) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("bot-html-wrapper");
      wrapper.innerHTML = html;
      bubble.appendChild(wrapper);
    } else {
      bubble.textContent = text || "";
    }

    row.appendChild(bubble);
    chatContainer.appendChild(row);
    scrollToBottom();
  }

  async function sendToN8n(question) {
    const payload = { question }; // matches tried-and-tested n8n workflow

    const response = await fetch(n8nEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errorText || "Request failed"}`);
    }

    return await response.text(); // n8n returns HTML
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const value = userInput.value.trim();
    if (!value) return;

    appendMessage({ sender: "user", text: value });
    userInput.value = "";
    autoResizeTextarea();

    sendButton.disabled = true;
    setTyping(true);

    try {
      const html = await sendToN8n(value);
      setTyping(false);
      appendMessage({ sender: "bot", html });
    } catch (err) {
      console.error("Error calling n8n:", err);
      setTyping(false);
      appendMessage({
        sender: "bot",
        text: "There was a problem contacting the n8n workflow. Check that n8n is running at http://localhost:5678."
      });
    } finally {
      sendButton.disabled = false;
      userInput.focus();
    }
  }

  function autoResizeTextarea() {
    if (!userInput) return;
    userInput.style.height = "auto";
    userInput.style.height = userInput.scrollHeight + "px";
  }

  chatForm.addEventListener("submit", handleSubmit);

  userInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });

  userInput.addEventListener("input", autoResizeTextarea);

  autoResizeTextarea();
  scrollToBottom(false);
});
