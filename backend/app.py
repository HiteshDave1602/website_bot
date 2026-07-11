import asyncio
import os
import re
import tempfile
from urllib.parse import urljoin, urlparse

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Keep Crawl4AI's database and browser-related working files in a writable
# location. This must be set before Crawl4AI is imported.
os.environ.setdefault("CRAWL4_AI_BASE_DIRECTORY", tempfile.gettempdir())

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig


app = FastAPI()

CRAWL_CONCURRENCY = max(1, int(os.getenv("CRAWL_CONCURRENCY", "1")))
MAX_CRAWL_PAGES = int(os.getenv("MAX_CRAWL_PAGES", "3"))
CRAWL_PAGE_TIMEOUT = int(os.getenv("CRAWL_PAGE_TIMEOUT", "45"))
CRAWL_TOTAL_TIMEOUT = int(os.getenv("CRAWL_TOTAL_TIMEOUT", "240"))


class CrawlRequest(BaseModel):
    url: str
    wait_for: str | None = None


class UrlList(BaseModel):
    urls: list[str]
    max_pages: int | None = None
    wait_for: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


def normalize_url(url: str) -> str:
    cleaned = (url or "").strip().strip("'\"")
    if not cleaned:
        raise HTTPException(status_code=400, detail="url must be a non-empty string")

    parsed = urlparse(
        cleaned if re.match(r"^https?://", cleaned, re.I) else f"https://{cleaned}"
    )
    hostname = parsed.hostname or ""
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or "." not in hostname:
        raise HTTPException(status_code=400, detail=f"invalid url: {url}")

    return parsed._replace(fragment="").geturl().rstrip("/")


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
        if (parsed.hostname or "").replace("www.", "", 1) != base_host.replace(
            "www.", "", 1
        ):
            continue
        clean_url = parsed._replace(query="", fragment="").geturl().rstrip("/")
        urls.append(clean_url)

    return list(dict.fromkeys(urls))


def browser_config() -> BrowserConfig:
    return BrowserConfig(
        browser_type="chromium",
        headless=True,
        java_script_enabled=True,
        verbose=False,
    )


def run_config(wait_for: str | None = None) -> CrawlerRunConfig:
    return CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_for=wait_for or None,
        page_timeout=CRAWL_PAGE_TIMEOUT * 1000,
        delay_before_return_html=2.0,
        scan_full_page=True,
        scroll_delay=0.5,
        remove_overlay_elements=True,
        remove_consent_popups=True,
        process_iframes=True,
        verbose=False,
    )


def crawl4ai_error(result) -> str:
    error = getattr(result, "error_message", None)
    if error:
        return str(error)
    status_code = getattr(result, "status_code", None)
    if status_code is not None:
        return f"crawl4ai got HTTP {status_code}"
    return "Crawl4AI failed to render the page"


def urls_from_crawl4ai_result(url: str, result) -> list[str]:
    raw_links: list[str] = []
    links = getattr(result, "links", None) or {}
    for link in links.get("internal", []):
        href = link.get("href") if isinstance(link, dict) else str(link)
        if href:
            raw_links.append(href)
    return normalize_internal_links(url, raw_links)


@app.post("/discover")
async def discover(data: CrawlRequest):
    url = normalize_url(data.url)

    try:
        async with AsyncWebCrawler(config=browser_config()) as crawler:
            result = await asyncio.wait_for(
                crawler.arun(url=url, config=run_config(data.wait_for)),
                timeout=CRAWL_PAGE_TIMEOUT + 5,
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"crawl4ai failed: {exc}") from exc

    if not getattr(result, "success", False):
        raise HTTPException(status_code=502, detail=crawl4ai_error(result))

    urls = urls_from_crawl4ai_result(url, result)
    return {
        "website": url,
        "pages_found": len(urls),
        "urls": urls,
        "crawler": "crawl4ai",
    }


async def crawl_with_crawl4ai(
    urls_to_crawl: list[str], wait_for: str | None = None
) -> list:
    semaphore = asyncio.Semaphore(CRAWL_CONCURRENCY)
    config = run_config(wait_for)

    async with AsyncWebCrawler(config=browser_config()) as crawler:
        async def crawl_one(url: str):
            async with semaphore:
                try:
                    return await asyncio.wait_for(
                        crawler.arun(url=url, config=config.clone()),
                        timeout=CRAWL_PAGE_TIMEOUT + 5,
                    )
                except asyncio.TimeoutError:
                    return {
                        "url": url,
                        "status": "failed",
                        "error": f"Timed out after {CRAWL_PAGE_TIMEOUT} seconds",
                        "crawler": "crawl4ai",
                    }
                except Exception as exc:
                    return {
                        "url": url,
                        "status": "failed",
                        "error": str(exc),
                        "crawler": "crawl4ai",
                    }

        return await asyncio.gather(*(crawl_one(url) for url in urls_to_crawl))


def format_crawl_result(url: str, page):
    if isinstance(page, dict):
        return page, page.get("status") == "completed"

    if not getattr(page, "success", False):
        return {
            "url": url,
            "status": "failed",
            "error": crawl4ai_error(page),
            "crawler": "crawl4ai",
        }, False

    status_code = getattr(page, "status_code", None)
    if status_code is not None and not (200 <= status_code < 300):
        return {
            "url": url,
            "status": "failed",
            "error": f"crawl4ai got HTTP {status_code}",
            "crawler": "crawl4ai",
        }, False

    markdown = getattr(page, "markdown", None)
    if markdown:
        return {
            "url": url,
            "status": "completed",
            "markdown": markdown,
            "crawler": "crawl4ai",
        }, True

    return {
        "url": url,
        "status": "empty_content",
        "crawler": "crawl4ai",
    }, False


@app.post("/crawl-pages")
async def crawl_pages(data: UrlList):
    urls = list(dict.fromkeys(normalize_url(url) for url in data.urls))
    max_pages = data.max_pages or MAX_CRAWL_PAGES
    urls_to_crawl = urls[:max_pages]
    skipped_urls = urls[max_pages:]

    try:
        pages = await asyncio.wait_for(
            crawl_with_crawl4ai(urls_to_crawl, data.wait_for),
            timeout=CRAWL_TOTAL_TIMEOUT,
        )
    except asyncio.TimeoutError:
        pages = [
            {
                "url": url,
                "status": "failed",
                "error": f"Crawl request timed out after {CRAWL_TOTAL_TIMEOUT} seconds",
                "crawler": "crawl4ai",
            }
            for url in urls_to_crawl
        ]
    except Exception as exc:
        pages = [
            {
                "url": url,
                "status": "failed",
                "error": str(exc),
                "crawler": "crawl4ai",
            }
            for url in urls_to_crawl
        ]

    results = []
    success_count = 0
    for url, page in zip(urls_to_crawl, pages):
        result, succeeded = format_crawl_result(url, page)
        results.append(result)
        if succeeded:
            success_count += 1

    for url in skipped_urls:
        results.append(
            {
                "url": url,
                "status": "skipped",
                "error": f"Skipped because max_pages is {max_pages}",
            }
        )

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
