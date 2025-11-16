// GPT-5 – chat-pinecone – direct to n8n (no proxy)

const messagesDiv = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");

const N8N_URL = "http://localhost:5678/webhook/chatpine";

// Add message to chat window
function addMessage(content, sender = "bot", html = false) {
    const msg = document.createElement("div");
    msg.classList.add("message");
    if (sender === "user") msg.classList.add("user");

    if (html) {
        msg.innerHTML = content;
    } else {
        msg.textContent = content;
    }

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Greeting
addMessage("Hello Bill 👋 I'm ready to help with your Pinecone RAG chat.", "bot");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    input.value = "";

    try {
        const response = await fetch(N8N_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text })
        });

        const raw = await response.text();   // ← always read as text first

        // Try JSON first
        let json = null;
        try {
            json = JSON.parse(raw);
        } catch (_) {
            json = null;
        }

        if (json && json.response_html) {
            addMessage(json.response_html, "bot", true);
        } else if (json && json.response) {
            addMessage(json.response, "bot");
        } else {
            // Otherwise treat entire response as HTML
            addMessage(raw, "bot", true);
        }

    } catch (err) {
        addMessage("Error contacting server.", "bot");
        console.error(err);
    }
});
