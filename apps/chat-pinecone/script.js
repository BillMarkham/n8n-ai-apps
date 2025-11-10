// Display live UK time
function updateTime() {
  const now = new Date().toLocaleTimeString("en-GB", { hour12: false });
  document.getElementById("localTime").textContent = now;
}
setInterval(updateTime, 1000);
updateTime();

// Handle chat send
const sendBtn = document.getElementById("sendBtn");
const userInput = document.getElementById("userInput");
const chatBox = document.getElementById("chatBox");

// Replace this with your n8n webhook (via ngrok)
const WEBHOOK_URL = "https://2ee79675c706.ngrok-free.app/webhook/chatpine";

sendBtn.addEventListener("click", async () => {
  const message = userInput.value.trim();
  if (!message) return;

  const userDiv = document.createElement("div");
  userDiv.className = "user-message";
  userDiv.textContent = `You: ${message}`;
  chatBox.appendChild(userDiv);
  userInput.value = "";

  const aiDiv = document.createElement("div");
  aiDiv.className = "ai-message";
  aiDiv.textContent = "Thinking...";
  chatBox.appendChild(aiDiv);

  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: message })
    });
    const data = await response.json();
    aiDiv.innerHTML = data?.answer || "No response from n8n.";
  } catch (err) {
    aiDiv.textContent = "Error contacting n8n webhook.";
    console.error(err);
  }

  chatBox.scrollTop = chatBox.scrollHeight;
});
