apps/
=====

Quick reference for the app folders.

- chat-pinecone/: Multi-bot Research Copilot shell (Pinecone RAG, SQL, Chat html). Open index.html.
- chat-html/: Standalone Chat html client posting to the ngrok webhook. Open index.html.
- chat-sql/: Legacy redirect into the multi-bot shell.

To add another app, duplicate one of the folders, point script.js at your new n8n webhook, and update the text in index.html/theme.css.
