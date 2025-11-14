// server.js  (Stable CommonJS proxy)
// ---------------------------------------------------
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

// Your known-working local n8n webhook
const LOCAL_WEBHOOK = "http://localhost:5678/webhook/chatpine";
const LOCAL_PORT = 4000;

// ---------------------------------------------------
// Auto-detect ngrok → ONLY for display
// ---------------------------------------------------
async function detectNgrok() {
  console.log("Waiting for ngrok auto-detection...");

  while (true) {
    try {
      const res = await fetch("http://127.0.0.1:4040/api/tunnels");
      const body = await res.json();

      if (body.tunnels && body.tunnels.length > 0) {
        const httpsTunnel = body.tunnels.find(t =>
          t.public_url.startsWith("https://")
        );
        if (httpsTunnel) {
          console.log("✔ Detected ngrok →", httpsTunnel.public_url);
          return httpsTunnel.public_url;
        }
      }
    } catch (err) {
      // Ignore until ngrok actually starts
    }

    await new Promise(r => setTimeout(r, 1000));
  }
}

// ---------------------------------------------------
// Start proxy server
// ---------------------------------------------------
(async () => {
  const ngrokUrl = await detectNgrok();

  console.log("\n------------------------------------------");
  console.log("CORS Proxy running at:", `http://localhost:${LOCAL_PORT}`);
  console.log("Forwarding:");
  console.log(`  http://localhost:${LOCAL_PORT}/chatpine`);
  console.log("           →", LOCAL_WEBHOOK);
  console.log("\n(ngrok detected for display only →", ngrokUrl, ")");
  console.log("------------------------------------------\n");

  // ------------------------------------------------
  //  /chatpine → forward directly to local n8n
  // ------------------------------------------------
  app.post("/chatpine", async (req, res) => {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] POST /chatpine`);

      const upstream = await fetch(LOCAL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const text = await upstream.text();

      // n8n almost always returns JSON; attempt parse
      try {
        return res.json(JSON.parse(text));
      } catch {
        // If not JSON, still return raw text
        return res.send(text);
      }
    } catch (err) {
      console.error("❌ Proxy error:", err.message);
      return res.status(500).json({ error: "Proxy failed" });
    }
  });

  // Start server
  app.listen(LOCAL_PORT, () => {
    console.log(`🌐 Proxy ready at http://localhost:${LOCAL_PORT}\n`);
  });
})();
