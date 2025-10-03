const form = document.getElementById('sitemap-form');
const input = document.getElementById('sitemapUrl');
const scanButton = document.getElementById('scanButton');
const logPanel = document.getElementById('log-panel');
const logEl = document.getElementById('log');
const clearLogButton = document.getElementById('clear-log');
const summaryPanel = document.getElementById('summary-panel');
const summaryEl = document.getElementById('summary');
const resultsPanel = document.getElementById('results-panel');
const resultsEl = document.getElementById('results');

clearLogButton.addEventListener('click', () => {
  logEl.textContent = '';
  logPanel.hidden = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const sitemapValue = (input.value || '').trim();
  resetUI();

  if (!sitemapValue) {
    input.focus();
    return;
  }

  let sitemapUrl;
  try {
    sitemapUrl = new URL(sitemapValue);
  } catch (error) {
    log(`Invalid URL: ${error.message}`, 'error');
    input.focus();
    return;
  }

  if (!['http:', 'https:'].includes(sitemapUrl.protocol)) {
    log('Only HTTP and HTTPS URLs are supported.', 'error');
    input.focus();
    return;
  }

  scanButton.disabled = true;
  scanButton.textContent = 'Scanning…';

  try {
    log(`Starting scan for ${sitemapUrl.href}`);
    const pageUrls = await collectSitemapUrls(sitemapUrl.href);
    if (!pageUrls.length) {
      log('No page URLs were discovered in the sitemap. Nothing to scan.', 'warn');
      return;
    }

    log(`Discovered ${pageUrls.length} page URL${pageUrls.length === 1 ? '' : 's'}.`);

    const uniquePages = [...new Set(pageUrls)];
    const pages = [];

    for (const pageUrl of uniquePages) {
      const result = await scanPage(pageUrl);
      pages.push(result);
    }

    renderSummary(pages);
    renderResults(pages);
    log('Scan complete.');
  } catch (error) {
    log(error.message || 'Scan failed.', 'error');
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = 'Scan';
  }
});

function resetUI() {
  summaryPanel.hidden = true;
  resultsPanel.hidden = true;
  summaryEl.innerHTML = '';
  resultsEl.innerHTML = '';
  logEl.textContent = '';
  logPanel.hidden = true;
}

function log(message, level = 'info') {
  const stamp = new Date().toISOString();
  const prefix = level === 'error' ? '✖' : level === 'warn' ? '⚠' : '•';
  const entry = `[${stamp}] ${prefix} ${message}`;
  logEl.textContent += `${entry}\n`;
  logEl.scrollTop = logEl.scrollHeight;
  logPanel.hidden = false;
}

async function collectSitemapUrls(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl)) {
    log(`Already processed sitemap ${sitemapUrl}, skipping duplicate.`);
    return [];
  }
  visited.add(sitemapUrl);

  const response = await safeFetch(sitemapUrl, {
    accept: 'application/xml,text/xml,*/*;q=0.9',
  });

  if (!response.ok) {
    throw new Error(`Sitemap request failed (${response.status} ${response.statusText || ''}) for ${sitemapUrl}`);
  }

  const xmlText = response.body || '';
  const xmlDoc = parseXml(xmlText, sitemapUrl);

  const sitemapNodes = Array.from(xmlDoc.querySelectorAll('sitemap > loc'));
  if (sitemapNodes.length > 0) {
    log(`Sitemap index detected at ${sitemapUrl} with ${sitemapNodes.length} sitemap${sitemapNodes.length === 1 ? '' : 's'}.`);
    const nestedUrls = [];
    for (const node of sitemapNodes) {
      const locText = node.textContent?.trim();
      if (!locText) {
        continue;
      }
      const normalized = normalizeUrl(locText, sitemapUrl);
      if (!normalized) {
        log(`Skipping invalid sitemap index entry: ${locText}`, 'warn');
        continue;
      }
      const collected = await collectSitemapUrls(normalized, visited);
      nestedUrls.push(...collected);
    }
    return nestedUrls;
  }

  const urlNodes = Array.from(xmlDoc.querySelectorAll('url > loc'));
  if (!urlNodes.length) {
    log(`No <loc> entries found inside ${sitemapUrl}.`, 'warn');
    return [];
  }

  const urls = [];
  for (const node of urlNodes) {
    const locText = node.textContent?.trim();
    if (!locText) {
      continue;
    }
    const normalized = normalizeUrl(locText, sitemapUrl);
    if (!normalized) {
      log(`Skipping invalid URL entry: ${locText}`, 'warn');
      continue;
    }
    urls.push(normalized);
  }

  return urls;
}

async function scanPage(pageUrl) {
  log(`Fetching page ${pageUrl}`);
  try {
    const response = await safeFetch(pageUrl);
    if (!response.ok) {
      log(`Page returned ${response.status} ${response.statusText || ''}: ${pageUrl}`, 'warn');
      return {
        page: pageUrl,
        links: [
          {
            href: pageUrl,
            ok: false,
            status: response.status,
            message: response.statusText || `HTTP ${response.status}`,
          },
        ],
      };
    }

    const html = response.body || '';
    const links = extractLinks(html, pageUrl);
    log(`Found ${links.length} link${links.length === 1 ? '' : 's'} on ${pageUrl}.`);

    const results = [];
    for (const link of links) {
      const linkResult = await checkLink(link);
      results.push(linkResult);
    }

    return {
      page: pageUrl,
      links: results,
    };
  } catch (error) {
    log(`Failed to fetch page ${pageUrl}: ${error.message}`, 'error');
    return {
      page: pageUrl,
      links: [
        {
          href: pageUrl,
          ok: false,
          status: null,
          message: simplifyError(error.message),
        },
      ],
    };
  }
}

async function checkLink(linkUrl) {
  try {
    const headResponse = await safeFetch(linkUrl, { method: 'HEAD' });
    if (headResponse.ok) {
      return {
        href: linkUrl,
        ok: true,
        status: headResponse.status,
        message: headResponse.statusText || 'OK',
      };
    }

    if ([403, 405].includes(headResponse.status)) {
      log(`HEAD request blocked (${headResponse.status}). Retrying with GET for ${linkUrl}.`, 'warn');
      const getResponse = await safeFetch(linkUrl, { method: 'GET' });
      return {
        href: linkUrl,
        ok: getResponse.ok,
        status: getResponse.status,
        message: getResponse.ok
          ? getResponse.statusText || 'OK'
          : getResponse.statusText || `HTTP ${getResponse.status}`,
      };
    }

    return {
      href: linkUrl,
      ok: false,
      status: headResponse.status,
      message: headResponse.statusText || `HTTP ${headResponse.status}`,
    };
  } catch (error) {
    return {
      href: linkUrl,
      ok: false,
      status: null,
      message: simplifyError(error.message),
    };
  }
}

async function safeFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const accept = options.accept;
  log(`${method} ${url}`);
  try {
    const payload = await proxyRequest(url, { method, accept });
    log(`↳ ${method} ${url} → ${payload.status} ${payload.statusText || ''}`);
    return payload;
  } catch (error) {
    const message = simplifyError(error.message || String(error));
    log(`${method} ${url} failed: ${message}`, 'error');
    throw new Error(`${method} ${url} failed: ${message}`);
  }
}

async function proxyRequest(url, { method = 'GET', accept } = {}) {
  const params = new URLSearchParams({ url, method });
  if (accept) {
    params.set('accept', accept);
  }

  const response = await fetch(`/proxy?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const payload = await response.json();

  if (!response.ok && payload.error) {
    throw new Error(payload.error);
  }

  if (payload.encoding === 'base64' && typeof payload.body === 'string') {
    const decoder = new TextDecoder();
    const bytes = Uint8Array.from(atob(payload.body), (c) => c.charCodeAt(0));
    payload.body = decoder.decode(bytes);
    payload.encoding = 'utf8';
  }

  payload.ok = payload.status >= 200 && payload.status < 300;
  return payload;
}

function parseXml(xmlText, sourceUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    const message = parserError.textContent || 'Unknown XML parsing error';
    throw new Error(`Failed to parse sitemap XML from ${sourceUrl}: ${message}`);
  }
  return doc;
}

function extractLinks(html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  const links = new Set();

  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href')?.trim();
    if (!rawHref) continue;
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;

    try {
      const absolute = new URL(rawHref, baseUrl);
      if (!['http:', 'https:'].includes(absolute.protocol)) {
        continue;
      }
      links.add(absolute.href);
    } catch (error) {
      log(`Failed to resolve link ${rawHref} on ${baseUrl}: ${error.message}`, 'warn');
    }
  }

  return [...links];
}

function normalizeUrl(candidate, base) {
  try {
    const resolved = new URL(candidate, base);
    if (!['http:', 'https:'].includes(resolved.protocol)) {
      return null;
    }
    return resolved.href;
  } catch (error) {
    return null;
  }
}

function renderSummary(pages) {
  const pageCount = pages.length;
  let totalLinks = 0;
  let brokenLinks = 0;

  for (const page of pages) {
    totalLinks += page.links.length;
    brokenLinks += page.links.filter((link) => !link.ok).length;
  }

  const summaryItems = [
    { label: 'Pages Scanned', value: pageCount },
    { label: 'Links Checked', value: totalLinks },
    { label: 'Broken Links', value: brokenLinks },
  ];

  summaryEl.innerHTML = summaryItems
    .map(
      (item) => `
        <div class="summary-card">
          <strong>${item.value}</strong>
          <span>${item.label}</span>
        </div>
      `,
    )
    .join('');

  summaryPanel.hidden = false;
}

function renderResults(pages) {
  resultsEl.innerHTML = '';

  for (const page of pages) {
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = page.page;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = page.page;
    heading.append(link);
    section.append(heading);

    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Link</th>
          <th>Status</th>
          <th>Message</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');

    for (const linkResult of page.links) {
      const row = document.createElement('tr');
      row.className = linkResult.ok ? 'ok' : 'broken';

      const linkCell = document.createElement('td');
      const linkAnchor = document.createElement('a');
      linkAnchor.href = linkResult.href;
      linkAnchor.target = '_blank';
      linkAnchor.rel = 'noopener';
      linkAnchor.textContent = linkResult.href;
      linkCell.append(linkAnchor);

      const statusCell = document.createElement('td');
      const statusSpan = document.createElement('span');
      statusSpan.className = `status-pill ${linkResult.ok ? 'ok' : 'broken'}`;
      statusSpan.textContent = linkResult.status !== null ? linkResult.status : 'N/A';
      statusCell.append(statusSpan);

      const messageCell = document.createElement('td');
      messageCell.textContent = linkResult.message || '';

      row.append(linkCell, statusCell, messageCell);
      tbody.append(row);
    }

    table.append(tbody);
    section.append(table);
    resultsEl.append(section);
  }

  resultsPanel.hidden = false;
}

function simplifyError(message) {
  if (!message) return 'Unknown error';
  if (/TypeError: Failed to fetch/i.test(message)) {
    return 'Request blocked or network error (check CORS, HTTPS, or availability).';
  }
  if (/NetworkError/i.test(message)) {
    return 'Network error while fetching resource.';
  }
  return message;
}
