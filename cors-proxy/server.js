import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const LOCAL_N8N = "http://localhost:5678/webhook/chatpine";

app.post("/chatpine", async (req, res) => {
  try {
    const upstream = await fetch(LOCAL_N8N, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });

    const text = await upstream.text();   // ALWAYS text — no JSON parsing

    res.status(200).send(text);           // return raw HTML to browser
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy failed");
  }
});

app.listen(4000, () => {
  console.log("Proxy running on port 4000");
});
