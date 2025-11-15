// Updated on 15 Nov by Bill

import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Allow calls from your chat front-end
app.use(
  cors({
    origin: "http://localhost:52966",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// n8n webhook URL
const N8N_URL = "http://localhost:5678/webhook/chatpine";

app.post("/chatpine", async (req, res) => {
  try {
    const response = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    res.status(200).send(text);
  } catch (err) {
    res.status(500).send("Error contacting n8n.");
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
