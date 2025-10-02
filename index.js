if (typeof globalThis.File === 'undefined') {
  try {
    const { File } = require('node:buffer');
    if (File) {
      globalThis.File = File;
    }
  } catch (error) {
    // ignore, will fall back to stub
  }

  if (typeof globalThis.File === 'undefined') {
    globalThis.File = class File {};
  }
}

const path = require('path');
const express = require('express');
const { gunzipSync } = require('node:zlib');

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/proxy', async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter.' });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL supplied.' });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'Only http and https protocols are allowed.' });
  }

  const requestInit = {
    method: req.query.method === 'HEAD' ? 'HEAD' : 'GET',
    redirect: 'follow',
    headers: buildForwardHeaders(req),
  };

  if (req.query.accept && typeof req.query.accept === 'string') {
    requestInit.headers.accept = req.query.accept;
  }

  try {
    const response = await fetch(parsed.href, requestInit);
    const headers = Object.fromEntries(response.headers.entries());
    const status = response.status;
    const statusText = response.statusText;

    let buffer = Buffer.from(await response.arrayBuffer());
    const contentEncoding = (response.headers.get('content-encoding') || '').toLowerCase();
    const contentType = response.headers.get('content-type') || '';
    const isGzip =
      contentEncoding.includes('gzip') ||
      parsed.pathname.toLowerCase().endsWith('.gz');

    if (isGzip && buffer.length) {
      try {
        buffer = gunzipSync(buffer);
      } catch (error) {
        console.warn(`Failed to decompress gzip content for ${parsed.href}: ${error.message}`);
      }
    }

    const textTypes = /^(text\/|application\/(json|xml|javascript|xhtml\+xml))/i;
    const body = textTypes.test(contentType) || !contentType ? buffer.toString('utf8') : buffer.toString('base64');
    const encoding = textTypes.test(contentType) || !contentType ? 'utf8' : 'base64';

    res.status(status);
    res.set({
      'cache-control': 'no-store',
      'x-proxied-url': parsed.href,
    });

    return res.json({ status, statusText, headers, body, encoding });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Upstream fetch failed.' });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

function buildForwardHeaders(req) {
  // Use a realistic browser user agent to avoid bot detection
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  ];
  
  const headers = {
    'user-agent': req.get('user-agent') || userAgents[Math.floor(Math.random() * userAgents.length)],
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br',
    'dnt': '1',
    'upgrade-insecure-requests': '1',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'cache-control': 'max-age=0',
  };

  const accept = req.get('accept');
  if (accept) {
    headers.accept = accept;
  } else {
    headers.accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
  }

  const referer = req.get('referer');
  if (referer) {
    headers.referer = referer;
  }

  return headers;
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
