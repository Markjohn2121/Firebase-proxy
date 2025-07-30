// server.js
const express = require('express');
const fetch = require('node-fetch'); // Use node-fetch v2
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for any domain
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Root check
app.get('/', (req, res) => {
  res.send('✅ Firebase Proxy Server is running.');
});

// Proxy route
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("❌ Missing 'url' query parameter.");
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

    // Pass through content type
    const contentType = response.headers.get('content-type');
    res.setHeader('Content-Type', contentType);

    // Stream response directly
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send(`🔥 Proxy error: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`🧠 Firebase Proxy running on http://localhost:${PORT}`);
});
