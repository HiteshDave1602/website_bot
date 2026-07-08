import asyncio
import re
import os
import tempfile
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

os.environ.setdefault("CRAWL4_AI_BASE_DIRECTORY", tempfile.gettempdir())

app = FastAPI()

CRAWL_CONCURRENCY = int(os.getenv("CRAWL_CONCURRENCY", "3"))
CRAWL4AI_CONCURRENCY = int(os.getenv("CRAWL4AI_CONCURRENCY", "1"))
MAX_CRAWL_PAGES = int(os.getenv("MAX_CRAWL_PAGES", "20"))
CRAWL_PAGE_TIMEOUT = int(os.getenv("CRAWL_PAGE_TIMEOUT", "45"))
CRAWL_TOTAL_TIMEOUT = int(os.getenv("CRAWL_TOTAL_TIMEOUT", "240"))
USE_CRAWL4AI_FALLBACK = os.getenv("USE_CRAWL4AI_FALLBACK", "true").lower() in {"1", "true", "yes"}
MIN_CONTENT_LENGTH = int(os.getenv("MIN_CONTENT_LENGTH", "150"))


class CrawlRequest(BaseModel):
    url: str


@app.get("/health")
async def health():
    return {"status": "ok"}



class UrlList(BaseModel):
    urls: list[str]
    max_pages: int | None = None


def normalize_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="url must be a non-empty string")
    return cleaned


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "a":
            return
        attrs_dict = dict(attrs)
        href = attrs_dict.get("href")
        if href:
            self.links.append(href)


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        if not self.skip_depth and data.strip():
            self.parts.append(data.strip())


def simple_fetch(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urlopen(request, timeout=CRAWL_PAGE_TIMEOUT) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="ignore")


def normalize_internal_links(base_url: str, raw_links: list[str]) -> list[str]:
    parsed_base = urlparse(base_url)
    base_host = parsed_base.hostname or ""
    urls = [base_url.rstrip("/")]

    for href in raw_links:
        if not href or href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"}:
            continue
        if (parsed.hostname or "").replace("www.", "", 1) != base_host.replace("www.", "", 1):
            continue
        clean_url = parsed._replace(query="", fragment="").geturl().rstrip("/")
        urls.append(clean_url)

    return list(dict.fromkeys(urls))


def html_to_text(html: str) -> str:
    parser = TextParser()
    parser.feed(html)
    return re.sub(r"\s+", " ", " ".join(parser.parts)).strip()


async def simple_discover(url: str) -> list[str]:
    html = await asyncio.to_thread(simple_fetch, url)
    parser = LinkParser()
    parser.feed(html)
    return normalize_internal_links(url, parser.links)


async def simple_crawl(url: str) -> dict:
    try:
        html = await asyncio.to_thread(simple_fetch, url)
        text = html_to_text(html)
        if text:
            return {
                "url": url,
                "status": "completed",
                "markdown": text,
                "crawler": "simple-html",
            }
        return {
            "url": url,
            "status": "empty_content",
            "crawler": "simple-html",
        }
    except Exception as exc:
        return {
            "url": url,
            "status": "failed",
            "error": str(exc),
            "crawler": "simple-html",
        }


def page_is_weak(page) -> bool:
    if isinstance(page, dict):
        status = page.get("status")
        if status in {"failed", "empty_content"}:
            return True
        markdown = page.get("markdown")
        return not markdown or len(markdown.strip()) < MIN_CONTENT_LENGTH
    markdown = getattr(page, "markdown", None)
    return not markdown or len(markdown.strip()) < MIN_CONTENT_LENGTH


async def discover_with_crawl4ai(url: str):
    from crawl4ai import AsyncWebCrawler

    async with AsyncWebCrawler() as crawler:
        return await crawler.arun(url=url)


def urls_from_crawl4ai_result(url: str, result) -> list[str]:
    urls = [url]

    for link in result.links.get("internal", []):
        if isinstance(link, dict):
            href = link.get("href")
            if href:
                urls.append(href)

    urls = list(dict.fromkeys(urls))

    return urls


@app.post("/discover")
async def discover(data: CrawlRequest):
    url = normalize_url(data.url)
    simple_error = None
    urls: list[str] = []

    try:
        urls = await simple_discover(url)
        if len(urls) > 1 or not USE_CRAWL4AI_FALLBACK:
            return {
                "website": url,
                "pages_found": len(urls),
                "urls": urls,
                "crawler": "simple-html",
            }
        simple_error = "only the homepage was found (likely a JS-rendered site)"
    except Exception as exc:
        simple_error = exc

    if not USE_CRAWL4AI_FALLBACK:
        raise HTTPException(status_code=502, detail=f"simple discovery failed: {simple_error}")

    try:
        result = await asyncio.wait_for(
            discover_with_crawl4ai(url),
            timeout=CRAWL_PAGE_TIMEOUT,
        )
        crawl4ai_urls = urls_from_crawl4ai_result(url, result)
    except Exception as exc:
        if urls:
            return {
                "website": url,
                "pages_found": len(urls),
                "urls": urls,
                "crawler": "simple-html",
                "fallback_reason": f"crawl4ai fallback also failed: {exc}",
            }
        raise HTTPException(
            status_code=502,
            detail=f"simple discovery failed: {simple_error}; crawl4ai failed: {exc}",
        )

    if len(crawl4ai_urls) <= len(urls):
        crawl4ai_urls = urls

    return {
        "website": url,
        "pages_found": len(crawl4ai_urls),
        "urls": crawl4ai_urls,
        "crawler": "crawl4ai",
        "fallback_reason": f"simple discovery insufficient: {simple_error}",
    }


async def crawl_with_crawl4ai(urls_to_crawl: list[str]) -> list:
    from crawl4ai import AsyncWebCrawler

    # A headless Chromium page can use 300-500MB alone, so this runs far more
    # serialized than the plain-HTTP path to avoid OOM-killing small instances.
    semaphore = asyncio.Semaphore(CRAWL4AI_CONCURRENCY)

    async def crawl_one(crawler, url: str):
        async with semaphore:
            try:
                return await asyncio.wait_for(
                    crawler.arun(url=url),
                    timeout=CRAWL_PAGE_TIMEOUT,
                )
            except TimeoutError:
                return {
                    "url": url,
                    "status": "failed",
                    "error": f"Timed out after {CRAWL_PAGE_TIMEOUT} seconds",
                }
            except Exception as exc:
                return {
                    "url": url,
                    "status": "failed",
                    "error": str(exc),
                }

    async with AsyncWebCrawler() as crawler:
        tasks = [crawl_one(crawler, url) for url in urls_to_crawl]
        return await asyncio.gather(*tasks)


async def crawl_with_simple_html(urls_to_crawl: list[str]) -> list[dict]:
    semaphore = asyncio.Semaphore(CRAWL_CONCURRENCY)

    async def crawl_one(url: str):
        async with semaphore:
            return await simple_crawl(url)

    tasks = [crawl_one(url) for url in urls_to_crawl]
    return await asyncio.gather(*tasks)


def format_crawl_result(url: str, page):
    if isinstance(page, dict) and page.get("status") == "failed":
        return page, False

    if isinstance(page, dict) and page.get("status") == "completed":
        return page, True

    if getattr(page, "markdown", None):
        status_code = getattr(page, "status_code", None)
        if status_code is not None and not (200 <= status_code < 300):
            return {
                "url": url,
                "status": "failed",
                "error": f"crawl4ai got HTTP {status_code}",
                "crawler": "crawl4ai",
            }, False
        return {
            "url": url,
            "status": "completed",
            "markdown": page.markdown,
            "crawler": "crawl4ai",
        }, True

    if isinstance(page, dict):
        return page, False

    return {
        "url": url,
        "status": "empty_content",
    }, False


@app.post("/crawl-pages")
async def crawl_pages(data: UrlList):
    urls = list(dict.fromkeys(normalize_url(url) for url in data.urls))
    max_pages = data.max_pages or MAX_CRAWL_PAGES
    urls_to_crawl = urls[:max_pages]
    skipped_urls = urls[max_pages:]

    pages = await crawl_with_simple_html(urls_to_crawl)
    fallback_reason = None

    weak_indexes = [i for i, page in enumerate(pages) if page_is_weak(page)]

    if USE_CRAWL4AI_FALLBACK and weak_indexes:
        weak_urls = [urls_to_crawl[i] for i in weak_indexes]
        try:
            retried = await asyncio.wait_for(
                crawl_with_crawl4ai(weak_urls),
                timeout=CRAWL_TOTAL_TIMEOUT,
            )
            for i, retried_page in zip(weak_indexes, retried):
                result, _ = format_crawl_result(urls_to_crawl[i], retried_page)
                if not page_is_weak(result):
                    pages[i] = retried_page
            fallback_reason = (
                f"{len(weak_urls)} page(s) had thin/failed simple-html content; retried with crawl4ai"
            )
        except Exception as exc:
            fallback_reason = f"crawl4ai fallback failed for {len(weak_urls)} page(s): {exc}"

    results = []
    success_count = 0

    for url, page in zip(urls_to_crawl, pages):
        result, succeeded = format_crawl_result(url, page)
        if fallback_reason and isinstance(result, dict):
            result["fallback_reason"] = fallback_reason
        results.append(result)
        if succeeded:
            success_count += 1

    for url in skipped_urls:
        results.append({
            "url": url,
            "status": "skipped",
            "error": f"Skipped because max_pages is {max_pages}",
        })

    failed_count = len(urls_to_crawl) - success_count

    return {
        "status": (
            "completed"
            if success_count == len(urls_to_crawl) and not skipped_urls
            else "completed_with_errors"
        ),
        "total_pages": len(urls),
        "crawled_pages": len(urls_to_crawl),
        "skipped_pages": len(skipped_urls),
        "successful_pages": success_count,
        "failed_pages": failed_count,
        "pages": results,
    }
