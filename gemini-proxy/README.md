# Gemini Proxy

Small Node/Express proxy that forwards requests to the Gemini API. Keep your API key server-side.

Local run

1. Install dependencies

```powershell
cd E:/aita-pro/gemini-proxy
npm install
```

2. Create a `.env` file in `gemini-proxy` with:

```
GEMINI_API_KEY=your_key_here
```

3. Start the proxy

```powershell
npm start
# listens on port 3001 by default
```

Render deployment

- In Render, create a new Web Service and choose "Deploy from a subdirectory" pointing to `gemini-proxy`.
- Build command: `npm install`
- Start command: `npm start`
- Set an environment variable `GEMINI_API_KEY` in Render's environment settings.

Notes
- The proxy exposes POST `/api/gemini` and proxies the body to the Gemini generate endpoint. It must not be called directly from the public without CORS/authorization if you want to restrict usage.
# gemini-proxy

Small Node/Express proxy used to forward requests from the frontend to the Gemini API.

Run locally

1. Install dependencies:

   

2. Add `.env` with:

   GEMINI_API_KEY=your_key_here

3. Start:

   npm start

Render deployment

When creating a Render service from this repo, set the "Root Directory" (or "Base Directory") to `gemini-proxy` so Render installs and starts from that folder. Use the start command:

   npm install && npm start

If you prefer, deploy `gemini-proxy` as a separate repo/service and connect the frontend to its URL.

Notes
- The proxy exposes POST /api/gemini and forwards JSON bodies to the Gemini generate endpoint using the key in `.env`.
- Keep the `.env` value secret in Render's environment variables (do not commit `.env` to the repo).
