n8n-ai-apps
============

Lightweight HTML/CSS/JS front-ends that send prompts to n8n webhook workflows and render the returned HTML.

Apps
- chat-pinecone/: Research Copilot (multi-bot shell) with tabs for Pinecone RAG (POST http://localhost:5678/webhook/chatpine), RAG with SQL (POST http://localhost:5678/webhook/chatsql), and Chat html (POST https://c2a23186d2fa.ngrok-free.app/webhook/chathtml).
- chat-html/: Single-page Chat html client posting to https://c2a23186d2fa.ngrok-free.app/webhook/chathtml.
- chat-sql/: Legacy redirect into the multi-bot shell.
- cors-proxy/: Legacy CORS/ngrok proxy (not required for direct local use).

Workflows
- workflows/: n8n workflow templates including error handlers and automation workflows. See workflows/README.md for details.

Run an app
1) Ensure the corresponding n8n workflow is running and reachable at its webhook URL (ngrok must be active for the Chat html endpoint).
2) Open the app's index.html in your browser (e.g., double-click or use VS Code Live Server).
3) Type a prompt and the page will POST JSON to the webhook and inject the HTML response into the chat thread.

Customize
- Update webhook endpoints in each app's script.js.
- Adjust copy/layout in index.html and styling in theme.css.

Troubleshooting
- Blank replies: make sure the n8n Respond to Webhook node returns pure HTML (not JSON).
- Network errors: verify the webhook URL (http vs https) and that ngrok/n8n are running.
