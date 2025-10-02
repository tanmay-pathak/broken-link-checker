const form = document.getElementById('sitemap-form');
const input = document.getElementById('sitemapUrl');
const scanButton = document.getElementById('scanButton');
const buttonText = scanButton.querySelector('.button-text');
const logPanel = document.getElementById('log-panel');
const logEl = document.getElementById('log');
const clearLogButton = document.getElementById('clear-log');
const progressPanel = document.getElementById('progress-panel');
const progressBarFill = document.getElementById('progress-bar-fill');
const summaryPanel = document.getElementById('summary-panel');
const summaryEl = document.getElementById('summary');
const resultsPanel = document.getElementById('results-panel');
const resultsEl = document.getElementById('results');
const searchInput = document.getElementById('search-results');
const exportButton = document.getElementById('export-results');
const filterButton = document.getElementById('filter-broken');

let currentResults = [];
let showBrokenOnly = false;

// Helper function to add delays between requests
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

clearLogButton.addEventListener('click', () => {
  logEl.textContent = '';
  logPanel.hidden = true;
});

searchInput?.addEventListener('input', (e) => {
  filterResults(e.target.value);
});

exportButton?.addEventListener('click', () => {
  exportToJSON();
});

filterButton?.addEventListener('click', () => {
  showBrokenOnly = !showBrokenOnly;
  filterButton.textContent = showBrokenOnly ? '✓ Show All' : 'Show Broken Only';
  filterResults(searchInput?.value || '');
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
  buttonText.textContent = 'Scanning…';
  progressPanel.hidden = false;
  updateProgress(0, 'crawl', 'active', 'Collecting sitemap...');

  try {
    log(`Starting scan for ${sitemapUrl.href}`);
    
    // Phase 1: Collect all page URLs from sitemap
    const pageUrls = await collectSitemapUrls(sitemapUrl.href);
    if (!pageUrls.length) {
      log('No page URLs were discovered in the sitemap. Nothing to scan.', 'warn');
      return;
    }
    log(`Discovered ${pageUrls.length} page URL${pageUrls.length === 1 ? '' : 's'}.`);

    const uniquePages = [...new Set(pageUrls)];
    
    // Phase 2: Crawl all pages and extract links
    log('Phase 1: Crawling pages and extracting links...');
    updateProgress(10, 'crawl', 'active', `Crawling ${uniquePages.length} pages...`);
    
    const pageLinksMap = new Map(); // pageUrl -> Set of link URLs
    const allLinks = new Set(); // All unique links across all pages
    
    for (let i = 0; i < uniquePages.length; i++) {
      const pageUrl = uniquePages[i];
      const links = await crawlPageForLinks(pageUrl);
      if (links) {
        pageLinksMap.set(pageUrl, new Set(links));
        links.forEach(link => allLinks.add(link));
      }
      const progress = 10 + Math.floor((i + 1) / uniquePages.length * 30);
      updateProgress(progress, 'crawl', 'active', `Crawled ${i + 1}/${uniquePages.length} pages`);
      
      // Add small delay between page crawls to appear more human-like
      if (i < uniquePages.length - 1) {
        await sleep(100 + Math.random() * 200); // 100-300ms delay
      }
    }
    
    updateProgress(40, 'crawl', 'completed', `✓ Crawled ${pageLinksMap.size} pages`);
    log(`Extracted ${allLinks.size} unique link${allLinks.size === 1 ? '' : 's'} from ${pageLinksMap.size} page${pageLinksMap.size === 1 ? '' : 's'}.`);
    
    // Phase 3: Check all unique links
    log('Phase 2: Checking all unique links...');
    updateProgress(40, 'check', 'active', `Checking ${allLinks.size} unique links...`);
    
    const linkStatusMap = new Map(); // linkUrl -> status result
    const uniqueLinksArray = [...allLinks];
    
    for (let i = 0; i < uniqueLinksArray.length; i++) {
      const link = uniqueLinksArray[i];
      const result = await checkLink(link);
      linkStatusMap.set(link, result);
      const progress = 40 + Math.floor((i + 1) / uniqueLinksArray.length * 50);
      updateProgress(progress, 'check', 'active', `Checked ${i + 1}/${uniqueLinksArray.length} links`);
      
      // Add small delay between link checks to avoid rate limiting
      if (i < uniqueLinksArray.length - 1) {
        await sleep(50 + Math.random() * 100); // 50-150ms delay
      }
    }
    
    updateProgress(90, 'check', 'completed', `✓ Checked ${allLinks.size} links`);
    
    // Phase 4: Build results structure
    log('Phase 3: Building results...');
    updateProgress(90, 'build', 'active', 'Building results...');
    
    const pages = [];
    for (const [pageUrl, pageLinks] of pageLinksMap.entries()) {
      const linkResults = [];
      for (const link of pageLinks) {
        const status = linkStatusMap.get(link);
        if (status) {
          linkResults.push(status);
        }
      }
      pages.push({
        page: pageUrl,
        links: linkResults,
      });
    }

    updateProgress(100, 'build', 'completed', '✓ Complete');
    currentResults = pages;
    
    renderSummary(pages, allLinks.size);
    renderResults(pages);
    log('Scan complete.');
    
    // Hide progress after 2 seconds
    setTimeout(() => {
      progressPanel.hidden = true;
      resetProgress();
    }, 2000);
  } catch (error) {
    log(error.message || 'Scan failed.', 'error');
    progressPanel.hidden = true;
    resetProgress();
  } finally {
    scanButton.disabled = false;
    buttonText.textContent = 'Start Scan';
  }
});

function resetUI() {
  summaryPanel.hidden = true;
  resultsPanel.hidden = true;
  progressPanel.hidden = true;
  summaryEl.innerHTML = '';
  resultsEl.innerHTML = '';
  logEl.textContent = '';
  logPanel.hidden = true;
  currentResults = [];
  showBrokenOnly = false;
  if (searchInput) searchInput.value = '';
  if (filterButton) filterButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 10.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5z"/>
    </svg>
    Show Broken Only
  `;
  resetProgress();
}

function updateProgress(percentage, step, status, message) {
  progressBarFill.style.width = `${percentage}%`;
  
  const steps = ['crawl', 'check', 'build'];
  steps.forEach(s => {
    const el = document.getElementById(`step-${s}`);
    if (!el) return;
    
    el.classList.remove('active', 'completed');
    
    if (s === step) {
      el.classList.add(status);
      const statusEl = el.querySelector('.step-status');
      if (statusEl) statusEl.textContent = message;
    } else {
      const stepIndex = steps.indexOf(s);
      const currentIndex = steps.indexOf(step);
      if (stepIndex < currentIndex || (stepIndex === currentIndex && status === 'completed')) {
        el.classList.add('completed');
        const statusEl = el.querySelector('.step-status');
        if (statusEl && !statusEl.textContent.startsWith('✓')) {
          // Keep the existing message if already has a checkmark
        }
      }
    }
  });
}

function resetProgress() {
  progressBarFill.style.width = '0%';
  ['crawl', 'check', 'build'].forEach(step => {
    const el = document.getElementById(`step-${step}`);
    if (!el) return;
    el.classList.remove('active', 'completed');
    const statusEl = el.querySelector('.step-status');
    if (statusEl) statusEl.textContent = '—';
  });
}

function filterResults(searchTerm = '') {
  const sections = resultsEl.querySelectorAll('section');
  const term = searchTerm.toLowerCase();
  
  sections.forEach(section => {
    const pageUrl = section.querySelector('h3 a')?.textContent || '';
    const rows = section.querySelectorAll('tbody tr');
    let visibleRows = 0;
    
    rows.forEach(row => {
      const linkUrl = row.querySelector('td:first-child a')?.textContent || '';
      const isBroken = row.classList.contains('broken');
      
      const matchesSearch = !term || pageUrl.toLowerCase().includes(term) || linkUrl.toLowerCase().includes(term);
      const matchesFilter = !showBrokenOnly || isBroken;
      
      if (matchesSearch && matchesFilter) {
        row.style.display = '';
        visibleRows++;
      } else {
        row.style.display = 'none';
      }
    });
    
    section.style.display = visibleRows > 0 ? '' : 'none';
  });
}

function exportToJSON() {
  if (!currentResults.length) {
    alert('No results to export. Please run a scan first.');
    return;
  }
  
  const data = {
    exportDate: new Date().toISOString(),
    summary: {
      pagesScanned: currentResults.length,
      totalLinks: currentResults.reduce((sum, page) => sum + page.links.length, 0),
      brokenLinks: currentResults.reduce((sum, page) => 
        sum + page.links.filter(link => !link.ok).length, 0
      ),
    },
    results: currentResults,
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broken-links-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  log('Results exported to JSON file.');
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

async function crawlPageForLinks(pageUrl) {
  log(`Crawling page ${pageUrl}`);
  try {
    const response = await safeFetch(pageUrl);
    if (!response.ok) {
      log(`Page returned ${response.status} ${response.statusText || ''}: ${pageUrl}`, 'warn');
      return null;
    }

    const html = response.body || '';
    const links = extractLinks(html, pageUrl);
    log(`Found ${links.length} link${links.length === 1 ? '' : 's'} on ${pageUrl}.`);

    return links;
  } catch (error) {
    log(`Failed to fetch page ${pageUrl}: ${error.message}`, 'error');
    return null;
  }
}

async function checkLink(linkUrl, retryCount = 0) {
  const maxRetries = 2;
  
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

    // Retry on rate limiting or temporary errors
    if (retryCount < maxRetries && [429, 503, 504].includes(headResponse.status)) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff
      log(`Rate limited (${headResponse.status}). Retrying in ${delay}ms for ${linkUrl}...`, 'warn');
      await sleep(delay);
      return checkLink(linkUrl, retryCount + 1);
    }

    if ([403, 405].includes(headResponse.status)) {
      log(`HEAD request blocked (${headResponse.status}). Retrying with GET for ${linkUrl}.`, 'warn');
      await sleep(200); // Small delay before GET
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
    // Retry on network errors
    if (retryCount < maxRetries && error.message.includes('fetch')) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      log(`Network error. Retrying in ${delay}ms for ${linkUrl}...`, 'warn');
      await sleep(delay);
      return checkLink(linkUrl, retryCount + 1);
    }
    
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

function renderSummary(pages, uniqueLinksCount) {
  const pageCount = pages.length;
  const brokenLinksSet = new Set();

  for (const page of pages) {
    page.links.filter((link) => !link.ok).forEach(link => brokenLinksSet.add(link.href));
  }

  const summaryItems = [
    { label: 'Pages Scanned', value: pageCount },
    { label: 'Unique Links Checked', value: uniqueLinksCount },
    { label: 'Broken Links', value: brokenLinksSet.size },
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
