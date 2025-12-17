require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(express.json({ limit: '50mb' })); // Allow up to 50MB payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Optional shared secret to restrict access to the proxy.
// If set (PROXY_SECRET), requests to /api/* must include header `x-proxy-key: <PROXY_SECRET>`
const PROXY_SECRET = process.env.PROXY_SECRET || null;

// Health endpoints (root and /health) - useful for quick checks and browser visits.
app.get('/', (req, res) => res.send('Gemini proxy is up. POST to /api/gemini'));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'gemini-proxy' }));

// Simple middleware to protect /api routes when PROXY_SECRET is set.
const apiAuth = (req, res, next) => {
  if (!PROXY_SECRET) return next();
  const key = req.headers['x-proxy-key'];
  if (!key || key !== PROXY_SECRET) return res.status(401).json({ error: 'Unauthorized: missing or invalid x-proxy-key' });
  return next();
};

const apiRouter = express.Router();
apiRouter.use(apiAuth);

apiRouter.post('/gemini', async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Missing GEMINI_API_KEY on server' });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

app.use('/api', apiRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Gemini proxy running on port ${PORT}`));
