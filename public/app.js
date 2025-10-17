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
const statusBanner = document.getElementById('status-banner');
const feedbackEl = document.getElementById('sitemap-feedback');
const demoButton = document.getElementById('load-demo');
const pasteButton = document.getElementById('paste-clipboard');
const resultsEmptyState = document.getElementById('results-empty');
const resultsEmptyTitle = document.getElementById('results-empty-title');
const resultsEmptyMessage = document.getElementById('results-empty-message');
const returnToFormButton = document.getElementById('return-to-form');

const statusIcons = {
  info: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.667a8.333 8.333 0 110 16.666 8.333 8.333 0 010-16.666zm0 4.166a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zm1.042 9.167V9.583H9.375v1.667h.834v3.75h.833z"/></svg>',
  success: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.667a8.333 8.333 0 110 16.666 8.333 8.333 0 010-16.666zm3.541 6.458l-4 4a.833.833 0 01-1.18.02l-1.833-1.75a.833.833 0 111.16-1.194l1.258 1.2 3.416-3.417a.833.833 0 111.179 1.141z"/></svg>',
  warn: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.983 2.275l7.5 13.333A1.667 1.667 0 0116.983 18H3.017a1.667 1.667 0 01-1.5-2.392l7.5-13.333a1.667 1.667 0 012.966 0zM9.167 7.5v3.333a.833.833 0 101.666 0V7.5a.833.833 0 10-1.666 0zm.833 7.5a1.041 1.041 0 100-2.083 1.041 1.041 0 000 2.083z"/></svg>',
  error: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.667a8.333 8.333 0 110 16.666 8.333 8.333 0 010-16.666zm2.357 5.31a.833.833 0 00-1.18 0L10 8.154 8.823 6.977a.833.833 0 00-1.18 1.178L8.82 9.333l-1.177 1.178a.833.833 0 001.178 1.18L10 10.513l1.178 1.178a.833.833 0 101.178-1.179L11.18 9.332l1.178-1.178a.833.833 0 000-1.178z"/></svg>',
};

const filterButtonIcons = {
  filter: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6 10.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm-2-3a.5.5 0 01.5-.5h11a.5.5 0 010 1h-11a.5.5 0 01-.5-.5z"/></svg>',
  all: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M2.75 8a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0V8zm4-4.5a.75.75 0 011.5 0v9a.75.75 0 01-1.5 0v-9zm4 2a.75.75 0 011.5 0v7a.75.75 0 01-1.5 0v-7zm4-3a.75.75 0 011.5 0v10a.75.75 0 01-1.5 0v-10z"/></svg>',
};

const defaultEmptyState = {
  title: 'Ready when you are',
  message: 'Run a scan to see link checks appear here.',
  variant: 'info',
};

let currentResults = [];
let showBrokenOnly = false;

// Helper function to add delays between requests
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setStatusBanner(message, variant = 'info') {
  if (!statusBanner) return;
  const icon = statusIcons[variant] || statusIcons.info;
  statusBanner.dataset.variant = variant;
  statusBanner.hidden = false;
  statusBanner.innerHTML = '';

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'status-icon';
  iconWrapper.innerHTML = icon;

  const textWrapper = document.createElement('span');
  textWrapper.className = 'status-text';
  textWrapper.textContent = message;

  statusBanner.append(iconWrapper, textWrapper);
}

function clearStatusBanner() {
  if (!statusBanner) return;
  statusBanner.hidden = true;
  statusBanner.innerHTML = '';
  delete statusBanner.dataset.variant;
}

function showFeedback(message, variant = 'info') {
  if (!feedbackEl) return;
  feedbackEl.textContent = message;
  feedbackEl.dataset.variant = variant;
  feedbackEl.hidden = false;
  if (input) {
    if (variant === 'error') {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  }
}

function clearFeedback() {
  if (!feedbackEl) return;
  feedbackEl.hidden = true;
  feedbackEl.textContent = '';
  delete feedbackEl.dataset.variant;
  if (input) {
    input.removeAttribute('aria-invalid');
  }
}

function updateFilterButton() {
  if (!filterButton) return;
  const icon = showBrokenOnly ? filterButtonIcons.all : filterButtonIcons.filter;
  const label = showBrokenOnly ? 'Show All Links' : 'Show Broken Only';
  filterButton.innerHTML = `${icon} ${label}`;
  filterButton.setAttribute('aria-pressed', String(showBrokenOnly));
}

function updateResultsEmptyState(title, message, variant = 'info', { show = true } = {}) {
  if (!resultsEmptyState) return;
  if (resultsEmptyTitle) {
    resultsEmptyTitle.textContent = title;
  }
  if (resultsEmptyMessage) {
    resultsEmptyMessage.textContent = message;
  }
  resultsEmptyState.dataset.variant = variant;
  resultsEmptyState.hidden = !show;
}

function hideResultsEmptyState() {
  if (!resultsEmptyState) return;
  resultsEmptyState.hidden = true;
}

updateFilterButton();
updateResultsEmptyState(defaultEmptyState.title, defaultEmptyState.message, defaultEmptyState.variant, { show: false });

input?.addEventListener('input', () => {
  if (feedbackEl && !feedbackEl.hidden && feedbackEl.dataset.variant === 'error') {
    clearFeedback();
  }
});

demoButton?.addEventListener('click', () => {
  const sitemap = demoButton.dataset.sitemap;
  if (!sitemap) return;
  input.value = sitemap;
  showFeedback('Loaded demo sitemap. Press “Start Scan” to try it out.', 'success');
  setStatusBanner('Loaded the demo sitemap—ready when you are.', 'info');
  input.focus({ preventScroll: true });
});

pasteButton?.addEventListener('click', async () => {
  if (!navigator.clipboard?.readText) {
    showFeedback('Clipboard access is not available in this browser.', 'warn');
    setStatusBanner('Clipboard access is not available. Paste manually instead.', 'warn');
    return;
  }

  try {
    const text = (await navigator.clipboard.readText())?.trim();
    if (!text) {
      showFeedback('Your clipboard was empty. Copy a sitemap URL first.', 'warn');
      return;
    }
    input.value = text;
    showFeedback('Pasted sitemap URL from your clipboard.', 'success');
    input.focus({ preventScroll: true });
  } catch (error) {
    showFeedback('We could not read from the clipboard. Paste manually instead.', 'warn');
    setStatusBanner(error.message || 'Clipboard access was denied.', 'error');
  }
});

returnToFormButton?.addEventListener('click', () => {
  input.focus({ preventScroll: false });
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

clearLogButton?.addEventListener('click', () => {
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
  updateFilterButton();
  setStatusBanner(
    showBrokenOnly
      ? 'Showing broken links only. Toggle again to see everything.'
      : 'Showing all scanned links.',
    'info',
  );
  filterResults(searchInput?.value || '');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const sitemapValue = (input.value || '').trim();
  resetUI();

  if (!sitemapValue) {
    showFeedback('Please enter a sitemap URL to begin.', 'error');
    setStatusBanner('We need a sitemap URL before starting.', 'warn');
    input.focus();
    return;
  }

  let sitemapUrl;
  try {
    sitemapUrl = new URL(sitemapValue);
  } catch (error) {
    const message = `Invalid URL: ${error.message}`;
    log(message, 'error');
    showFeedback('That URL looks invalid. Double-check the format and try again.', 'error');
    setStatusBanner(message, 'error');
    input.focus();
    return;
  }

  if (!['http:', 'https:'].includes(sitemapUrl.protocol)) {
    const message = 'Only HTTP and HTTPS URLs are supported.';
    log(message, 'error');
    showFeedback(message, 'error');
    setStatusBanner(message, 'error');
    input.focus();
    return;
  }

  scanButton.disabled = true;
  buttonText.textContent = 'Scanning…';
  progressPanel.hidden = false;
  updateProgress(0, 'crawl', 'active', 'Collecting sitemap...');
  setStatusBanner('Working through your sitemap…', 'info');
  showFeedback("Hang tight—we're crawling your pages.", 'info');

  try {
    log(`Starting scan for ${sitemapUrl.href}`);

    // Phase 1: Collect all page URLs from sitemap
    const pageUrls = await collectSitemapUrls(sitemapUrl.href);
    if (!pageUrls.length) {
      const message = 'No page URLs were discovered in the sitemap. Nothing to scan.';
      log(message, 'warn');
      showFeedback('We could not find any page URLs in that sitemap.', 'warn');
      setStatusBanner('We could not find any page URLs in that sitemap.', 'warn');
      updateResultsEmptyState(
        'No pages discovered',
        'Double-check that your sitemap lists <loc> entries or try another sitemap.',
        'warn',
      );
      resultsPanel.hidden = false;
      progressPanel.hidden = true;
      resetProgress();
      return;
    }
    log(`Discovered ${pageUrls.length} page URL${pageUrls.length === 1 ? '' : 's'}.`);

    const uniquePages = [...new Set(pageUrls)];
    
    // Phase 2: Crawl all pages and extract links
    log('Phase 1: Crawling pages and extracting links...');
    updateProgress(10, 'crawl', 'active', `Crawling ${uniquePages.length} pages...`);
    
    const pageLinksMap = new Map(); // pageUrl -> Map of link URLs to link text
    const allLinksText = new Map(); // All unique link URLs -> combined link text
    
    for (let i = 0; i < uniquePages.length; i++) {
      const pageUrl = uniquePages[i];
      const linksMap = await crawlPageForLinks(pageUrl);
      if (linksMap) {
        pageLinksMap.set(pageUrl, linksMap);
        // Merge link text from different pages
        for (const [url, text] of linksMap.entries()) {
          if (allLinksText.has(url)) {
            const existingText = allLinksText.get(url);
            if (existingText !== text && !existingText.includes(text)) {
              allLinksText.set(url, `${existingText} | ${text}`);
            }
          } else {
            allLinksText.set(url, text);
          }
        }
      }
      const progress = 10 + Math.floor((i + 1) / uniquePages.length * 30);
      updateProgress(progress, 'crawl', 'active', `Crawled ${i + 1}/${uniquePages.length} pages`);
      
      // Add small delay between page crawls to appear more human-like
      if (i < uniquePages.length - 1) {
        await sleep(100 + Math.random() * 200); // 100-300ms delay
      }
    }
    
    updateProgress(40, 'crawl', 'completed', `✓ Crawled ${pageLinksMap.size} pages`);
    log(`Extracted ${allLinksText.size} unique link${allLinksText.size === 1 ? '' : 's'} from ${pageLinksMap.size} page${pageLinksMap.size === 1 ? '' : 's'}.`);
    
    // Phase 3: Check all unique links
    log('Phase 2: Checking all unique links...');
    updateProgress(40, 'check', 'active', `Checking ${allLinksText.size} unique links...`);
    
    const linkStatusMap = new Map(); // linkUrl -> status result with text
    const uniqueLinksArray = [...allLinksText.keys()];
    
    for (let i = 0; i < uniqueLinksArray.length; i++) {
      const link = uniqueLinksArray[i];
      const result = await checkLink(link);
      // Add link text to the result
      result.text = allLinksText.get(link);
      linkStatusMap.set(link, result);
      const progress = 40 + Math.floor((i + 1) / uniqueLinksArray.length * 50);
      updateProgress(progress, 'check', 'active', `Checked ${i + 1}/${uniqueLinksArray.length} links`);
      
      // Add small delay between link checks to avoid rate limiting
      if (i < uniqueLinksArray.length - 1) {
        await sleep(50 + Math.random() * 100); // 50-150ms delay
      }
    }
    
    updateProgress(90, 'check', 'completed', `✓ Checked ${allLinksText.size} links`);
    
    // Phase 4: Build results structure
    log('Phase 3: Building results...');
    updateProgress(90, 'build', 'active', 'Building results...');
    
    const pages = [];
    for (const [pageUrl, linksMap] of pageLinksMap.entries()) {
      const linkResults = [];
      for (const [linkUrl, linkText] of linksMap.entries()) {
        const status = linkStatusMap.get(linkUrl);
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
    
    const summaryData = renderSummary(pages, allLinksText.size);
    renderResults(pages);
    log('Scan complete.');
    let feedbackMessage = 'Scan complete.';
    let feedbackVariant = 'success';
    if (summaryData.uniqueLinksCount === 0) {
      feedbackMessage = 'Scan complete—no links were detected on the scanned pages.';
      feedbackVariant = 'warn';
    } else if (summaryData.brokenLinks) {
      feedbackMessage = 'Scan complete—review the broken links highlighted below.';
      feedbackVariant = 'warn';
    } else {
      feedbackMessage = 'Scan complete. Everything looks healthy!';
      feedbackVariant = 'success';
    }
    showFeedback(feedbackMessage, feedbackVariant);
    let bannerMessage;
    let bannerVariant;
    if (summaryData.uniqueLinksCount === 0) {
      bannerMessage = 'Scan complete! No links were found on the scanned pages.';
      bannerVariant = 'info';
    } else if (summaryData.brokenLinks) {
      bannerMessage = `Scan complete! Found ${summaryData.brokenLinks} broken link${summaryData.brokenLinks === 1 ? '' : 's'}.`;
      bannerVariant = 'warn';
    } else {
      bannerMessage = 'Scan complete! No broken links were found.';
      bannerVariant = 'success';
    }
    setStatusBanner(bannerMessage, bannerVariant);

    // Hide progress after 2 seconds
    setTimeout(() => {
      progressPanel.hidden = true;
      resetProgress();
    }, 2000);
  } catch (error) {
    log(error.message || 'Scan failed.', 'error');
    progressPanel.hidden = true;
    resetProgress();
    setStatusBanner(`Scan failed: ${error.message || 'Unknown error.'}`, 'error');
    updateResultsEmptyState(
      'Scan failed',
      'Check the activity log below for more details and try again when you are ready.',
      'warn',
    );
    resultsPanel.hidden = false;
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
  updateFilterButton();
  clearFeedback();
  clearStatusBanner();
  updateResultsEmptyState(defaultEmptyState.title, defaultEmptyState.message, defaultEmptyState.variant, { show: false });
  hideResultsEmptyState();
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

  let visibleSections = 0;

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

    if (visibleRows > 0) {
      section.style.display = '';
      visibleSections++;
    } else {
      section.style.display = 'none';
    }
  });

  if (!sections.length) {
    updateResultsEmptyState(
      'No links detected',
      'The crawler did not find any links on the scanned pages.',
      'info',
    );
    return;
  }

  if (!visibleSections) {
    if (showBrokenOnly) {
      updateResultsEmptyState(
        'No broken links 🎉',
        'We could not find any broken links. Toggle “Show All Links” to review healthy ones.',
        'success',
      );
    } else if (term) {
      updateResultsEmptyState(
        'No matches for your search',
        'Try searching for a different URL, anchor text, or keyword.',
        'warn',
      );
    } else {
      updateResultsEmptyState(
        defaultEmptyState.title,
        defaultEmptyState.message,
        defaultEmptyState.variant,
      );
    }
  } else {
    hideResultsEmptyState();
  }
}

function exportToJSON() {
  if (!currentResults.length) {
    alert('No results to export. Please run a scan first.');
    return;
  }
  
  // Build CSV
  const rows = [];
  
  // Header row
  rows.push(['Page URL', 'Link Text', 'Link URL', 'Status', 'Status Code', 'Message']);
  
  // Data rows
  for (const page of currentResults) {
    for (const link of page.links) {
      rows.push([
        escapeCsvValue(page.page),
        escapeCsvValue(link.text || ''),
        escapeCsvValue(link.href),
        link.ok ? 'OK' : 'Broken',
        link.status !== null ? link.status : 'N/A',
        escapeCsvValue(link.message || ''),
      ]);
    }
  }
  
  // Convert to CSV string
  const csv = rows.map(row => row.join(',')).join('\n');
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broken-links-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  log('Results exported to CSV file.');
}

function escapeCsvValue(value) {
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
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
    const linksMap = extractLinks(html, pageUrl);
    log(`Found ${linksMap.size} link${linksMap.size === 1 ? '' : 's'} on ${pageUrl}.`);

    return linksMap;
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
  const linksMap = new Map(); // Map of URL -> link text

  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute('href')?.trim();
    if (!rawHref) continue;
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue;

    try {
      const absolute = new URL(rawHref, baseUrl);
      if (!['http:', 'https:'].includes(absolute.protocol)) {
        continue;
      }
      
      // Extract link text, fallback to URL if empty
      const linkText = (anchor.textContent || '').trim() || anchor.getAttribute('aria-label') || absolute.href;
      
      // If we already have this URL, append the text if different
      if (linksMap.has(absolute.href)) {
        const existingText = linksMap.get(absolute.href);
        if (existingText !== linkText && !existingText.includes(linkText)) {
          linksMap.set(absolute.href, `${existingText} | ${linkText}`);
        }
      } else {
        linksMap.set(absolute.href, linkText);
      }
    } catch (error) {
      log(`Failed to resolve link ${rawHref} on ${baseUrl}: ${error.message}`, 'warn');
    }
  }

  return linksMap;
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

  const brokenLinksCount = brokenLinksSet.size;

  const summaryItems = [
    { label: 'Pages Scanned', value: pageCount },
    { label: 'Unique Links Checked', value: uniqueLinksCount },
    { label: 'Broken Links', value: brokenLinksCount },
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

  return {
    pageCount,
    uniqueLinksCount,
    brokenLinks: brokenLinksCount,
  };
}

function renderResults(pages) {
  resultsEl.innerHTML = '';

  let pagesWithLinks = 0;

  for (const page of pages) {
    if (!page.links.length) {
      continue;
    }

    pagesWithLinks++;
    const section = document.createElement('section');
    const heading = document.createElement('h3');
    const link = document.createElement('a');
    link.href = page.page;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = page.page;
    heading.append(link);

    const brokenCount = page.links.filter(linkResult => !linkResult.ok).length;
    const badge = document.createElement('span');
    badge.className = 'page-count-badge';
    badge.textContent = `${page.links.length} link${page.links.length === 1 ? '' : 's'}`;
    if (brokenCount > 0) {
      badge.dataset.variant = 'alert';
      badge.textContent += ` • ${brokenCount} broken`;
    } else {
      badge.dataset.variant = 'ok';
      badge.textContent += ' • All healthy';
    }
    heading.append(badge);
    section.append(heading);

    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Link Text</th>
          <th>URL</th>
          <th>Status</th>
          <th>Message</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');

    for (const linkResult of page.links) {
      const row = document.createElement('tr');
      row.className = linkResult.ok ? 'ok' : 'broken';

      const textCell = document.createElement('td');
      textCell.textContent = linkResult.text || linkResult.href;
      textCell.style.maxWidth = '200px';

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

      row.append(textCell, linkCell, statusCell, messageCell);
      tbody.append(row);
    }

    table.append(tbody);
    section.append(table);
    resultsEl.append(section);
  }

  resultsPanel.hidden = false;

  if (!pagesWithLinks) {
    updateResultsEmptyState(
      'No links detected',
      'The crawler did not find any links on the scanned pages.',
      'info',
    );
    return;
  }

  hideResultsEmptyState();
  filterResults(searchInput?.value || '');
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
