document.addEventListener("DOMContentLoaded", () => {
    const chatWrapper = document.getElementById("chat-wrapper");
    const form = document.getElementById("message-form");
    const input = document.getElementById("message-input");

    // Initial Greeting
    addMessage("bot", "Hello Bill 👋 I'm ready to help with your Pinecone RAG chat.");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        addMessage("user", text);
        input.value = "";

        try {
            const proxyUrl = "http://localhost:4000/chatpine";

            const response = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: text })
            });

            const resultText = await response.text();   // ← IMPORTANT: result is HTML, not JSON

            if (!response.ok) {
                addMessage("bot", "Error contacting server.");
                return;
            }

            // Add bot reply as HTML
            addMessage("bot", resultText);

        } catch (err) {
            console.error("Error:", err);
            addMessage("bot", "Error contacting server.");
        }
    });

    function addMessage(sender, text) {
        const msg = document.createElement("div");
        msg.className = sender === "bot" ? "bot-message" : "user-message";

        // insert HTML from n8n for bot, textContent for user
        if (sender === "bot") {
            msg.innerHTML = text;
        } else {
            msg.textContent = text;
        }

        chatWrapper.appendChild(msg);
        chatWrapper.scrollTop = chatWrapper.scrollHeight;
    }
});
