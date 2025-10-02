# Broken Link Checker

A fast, efficient web-based tool to scan websites for broken links using sitemaps.

## Features

- **Smart Scanning**: Crawls all pages, dedupes links, then checks them efficiently
- **Modern UI**: Beautiful, responsive interface with real-time progress tracking
- **CSV Export**: Export results to CSV for easy analysis in Google Sheets or Excel
- **Link Text Extraction**: See the actual anchor text to easily locate links on your pages
- **Anti-Bot Detection**: Uses realistic browser headers and smart rate limiting to avoid false positives
- **Smart Retries**: Automatic retry with exponential backoff for rate-limited requests
- **CORS Proxy**: Built-in server-side proxy to bypass CORS restrictions

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open your browser to
http://localhost:3000
```

## Usage

1. Enter your sitemap URL (e.g., `https://example.com/sitemap.xml`)
2. Click "Start Scan"
3. Watch the progress as it:
   - Crawls all pages from the sitemap
   - Extracts and deduplicates all links
   - Checks each unique link once
4. Review results with filtering and search
5. Export to CSV for further analysis

## Development

```bash
# Start with auto-reload
npm run dev
```

## How It Works

1. **Phase 1**: Fetches sitemap and extracts all page URLs
2. **Phase 2**: Crawls each page and extracts links with their anchor text
3. **Phase 3**: Checks all unique links (HEAD request first, falls back to GET if blocked)
4. **Phase 4**: Builds results mapping links back to source pages

## Export Format

CSV exports include:

- Page URL (where the link was found)
- Link Text (anchor text)
- Link URL (the actual link)
- Status (OK or Broken)
- Status Code (HTTP status)
- Message (error details if broken)
