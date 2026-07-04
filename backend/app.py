import asyncio
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from crawl4ai import AsyncWebCrawler

app = FastAPI()

CRAWL_CONCURRENCY = int(os.getenv("CRAWL_CONCURRENCY", "3"))
MAX_CRAWL_PAGES = int(os.getenv("MAX_CRAWL_PAGES", "20"))


class CrawlRequest(BaseModel):
    url: str
    

class UrlList(BaseModel):
    urls: list[str]
    max_pages: int | None = None


def normalize_url(url: str) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="url must be a non-empty string")
    return cleaned


@app.post("/discover")
async def discover(data: CrawlRequest):
    url = normalize_url(data.url)

    async with AsyncWebCrawler() as crawler:

        result = await crawler.arun(url=url)

        urls = [url]

        for link in result.links.get("internal", []):

            if isinstance(link, dict):

                href = link.get("href")

                if href:
                    urls.append(href)

        urls = list(dict.fromkeys(urls))

        return {
            "website": url,
            "pages_found": len(urls),
            "urls": urls
        }


@app.post("/crawl-pages")
async def crawl_pages(data: UrlList):
    urls = list(dict.fromkeys(normalize_url(url) for url in data.urls))
    max_pages = data.max_pages or MAX_CRAWL_PAGES
    urls_to_crawl = urls[:max_pages]
    skipped_urls = urls[max_pages:]
    semaphore = asyncio.Semaphore(CRAWL_CONCURRENCY)

    async def crawl_one(crawler: AsyncWebCrawler, url: str):
        async with semaphore:
            try:
                return await crawler.arun(url=url)
            except Exception as exc:
                return {
                    "url": url,
                    "status": "failed",
                    "error": str(exc),
                }

    async with AsyncWebCrawler() as crawler:

        tasks = [
            crawl_one(crawler, url)
            for url in urls_to_crawl
        ]

        pages = await asyncio.gather(*tasks)

        results = []
        success_count = 0

    for url, page in zip(urls_to_crawl, pages):
    
        if isinstance(page, dict) and page.get("status") == "failed":

            results.append(page)

        elif getattr(page, "markdown", None):

            success_count += 1

            results.append({
                "url": url,
                "status": "completed",
                "markdown": page.markdown
            })

        else:

            results.append({
                "url": url,
                "status": "empty_content"
            })

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
        "pages": results
    }
