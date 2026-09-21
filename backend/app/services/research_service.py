import json
import logging
import re
import threading
import time
import random
from urllib.parse import urlparse
import urllib.request
import urllib.error
from html.parser import HTMLParser
from typing import Optional, Dict, Any, List, Tuple
from google import genai
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Thread-safe rate limit queue pacing variables
gemini_thread_lock = threading.Lock()
last_request_time = [0.0]
REQUEST_SPACING = 7.5  # Spacing in seconds (safely under 10 RPM limit)

# Supported trusted platforms mapping
TRUSTED_PLATFORMS: Dict[str, List[str]] = {
    "amazon": ["amazon.in", "amazon.com", "amzn.in", "amzn.to", "media-amazon.com"],
    "flipkart": ["flipkart.com", "dl.flipkart.com"],
    "ikea": ["ikea.com", "ikea.in"],
    "meesho": ["meesho.com"],
    "myntra": ["myntra.com"],
    "ajio": ["ajio.com"],
    "tatacliq": ["tatacliq.com"],
    "nykaa": ["nykaa.com"],
    "croma": ["croma.com"],
    "reliance": ["reliancedigital.in"],
    "vijay": ["vijaysales.com"],
    "blinkit": ["blinkit.com"],
    "zepto": ["zeptonow.com"],
    "instamart": ["instamart.in", "swiggy.com"],
}

def detect_platform_from_url(url: str) -> str:
    """
    Identifies the retailer/platform name from a URL hostname.
    Returns normalized platform slug e.g. 'ikea', 'meesho', 'amazon', 'flipkart', or 'other'.
    """
    if not url:
        return "other"
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        if hostname.startswith("www."):
            hostname = hostname[4:]
        for platform, domains in TRUSTED_PLATFORMS.items():
            for d in domains:
                if hostname == d or hostname.endswith("." + d):
                    return platform
    except Exception:
        pass
    return "other"

def extract_name_from_url(url: str) -> str:
    """
    Extracts a human-readable product title candidate from URL path slugs.
    e.g. 'https://www.ikea.com/in/en/p/billy-bookcase-white-00263850/' -> 'Billy Bookcase White'
    """
    try:
        parsed = urlparse(url)
        path = parsed.path
        parts = [p for p in path.split('/') if p]
        
        # Look for hyphenated or underscored product slug
        for part in reversed(parts):
            # Ignore numeric IDs, language codes, or single letters like 'p' or 'dp'
            if len(part) <= 2 or part.isdigit() or part in ("item", "product", "goods"):
                continue
            if '-' in part or '_' in part:
                # Strip trailing SKU / random hash numbers if separated by hyphen
                cleaned = re.sub(r'[-_][0-9a-f]{8,}$', '', part, flags=re.IGNORECASE)
                cleaned = cleaned.replace('-', ' ').replace('_', ' ')
                words = [w for w in cleaned.split() if not w.isdigit() and len(w) > 1]
                if words:
                    return " ".join(words).title()
        if parts:
            last = parts[-1].replace('-', ' ').replace('_', ' ').strip().title()
            if len(last) > 2 and not last.isdigit():
                return last
    except Exception:
        pass
    return "this product"

def validate_price_entry(
    source: str, 
    url: str, 
    brand: Optional[str] = None, 
    item_name: Optional[str] = None,
    manual_link: Optional[str] = None
) -> Tuple[bool, str, str]:
    """
    Validates price URL hostnames against domain rules to prevent low-trust sites in DB.
    Also normalizes the source string based on URL hostname classification.
    Returns (is_valid, reason_if_invalid, normalized_source).
    """
    if not url:
        logger.warning("Rejected price entry: empty URL")
        return False, "Empty URL", source
        
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        scheme = (parsed.scheme or "").lower()
        
        # 0. User's manual link is ALWAYS accepted (guaranteed trust pass-through)
        if manual_link:
            try:
                manual_parsed = urlparse(manual_link)
                manual_hostname = (manual_parsed.hostname or "").lower()
                host_clean = hostname.replace("www.", "")
                m_host_clean = manual_hostname.replace("www.", "")
                if host_clean == m_host_clean and host_clean:
                    detected = detect_platform_from_url(url)
                    if detected != "other":
                        return True, "", detected
                    brand_lower = brand.lower().strip() if brand else ""
                    if brand_lower and (brand_lower in host_clean):
                        return True, "", "official"
                    return True, "", "other"
            except Exception as e:
                logger.warning(f"Error comparing price URL to manual_link: {e}")
                
        if scheme not in ("http", "https"):
            reason = f"Unsupported scheme: {scheme}"
            logger.warning(f"Rejected price entry for host {hostname}: {reason}")
            return False, reason, source
            
        # Reject low-trust spam TLDs
        untrusted_tlds = [".xyz", ".top", ".club", ".shop", ".site", ".online"]
        for tld in untrusted_tlds:
            if hostname.endswith(tld):
                reason = f"Uses untrusted TLD: {tld}"
                logger.warning(f"Rejected price entry for host {hostname}: {reason}")
                return False, reason, source

        source_lower = source.lower()
        host_clean = hostname[4:] if hostname.startswith("www.") else hostname
        
        # 1. Match against recognized trusted platforms
        for platform_key, domain_list in TRUSTED_PLATFORMS.items():
            for d in domain_list:
                if host_clean == d or host_clean.endswith("." + d):
                    logger.info(f"Accepted price entry: {hostname} recognized as '{platform_key}'")
                    return True, "", platform_key
            
        # 2. Check official brand match context
        domain_parts = host_clean.split('.')
        brand_clean = re.sub(r'[^a-z0-9]', '', (brand or "").lower())
        if brand_clean:
            if brand_clean in domain_parts or any(brand_clean in part for part in domain_parts if len(brand_clean) >= 3):
                logger.info(f"Accepted price entry: {hostname} classified as 'official' matching brand '{brand}'")
                return True, "", "official"

        # 3. If Gemini explicitly tagged it as official (and passed TLD check), trust it
        if source_lower == "official":
            logger.info(f"Accepted price entry: {hostname} classified as 'official' by model tag")
            return True, "", "official"

        reason = f"Hostname '{hostname}' does not match brand '{brand or ''}' or any trusted domain list"
        logger.warning(f"Rejected price entry: {reason}")
        return False, reason, "other"
            
    except Exception as e:
        reason = f"URL parse exception: {str(e)}"
        logger.error(f"Rejected price entry: {reason}")
        return False, reason, source

def clean_json_response(raw_text: str) -> str:
    """
    Cleans raw Gemini text output to extract a valid JSON string.
    Strips markdown code blocks and pre/post narrative text.
    """
    cleaned = raw_text.strip()
    if "```" in cleaned:
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
        if match:
            return match.group(1).strip()
    
    first_brace = cleaned.find('{')
    last_brace = cleaned.rfind('}')
    if first_brace != -1 and last_brace != -1:
        return cleaned[first_brace:last_brace + 1].strip()
        
    return cleaned

class HTMLMetadataParser(HTMLParser):
    """
    Zero-dependency HTML Parser to extract OpenGraph, Twitter tags, and JSON-LD structured product schema.
    """
    def __init__(self):
        super().__init__()
        self.title: str = ""
        self.meta: Dict[str, str] = {}
        self.json_ld: List[Any] = []
        self._in_title = False
        self._title_buf: List[str] = []
        self._in_json_ld = False
        self._json_ld_buf: List[str] = []

    def handle_starttag(self, tag: str, attrs: list):
        tag_lower = tag.lower()
        attrs_dict = {k.lower(): v for k, v in attrs if v is not None}
        if tag_lower == 'title':
            self._in_title = True
            self._title_buf = []
        elif tag_lower == 'meta':
            key = attrs_dict.get('property') or attrs_dict.get('name')
            content = attrs_dict.get('content')
            if key and content:
                self.meta[key.lower()] = content
        elif tag_lower == 'script' and attrs_dict.get('type') == 'application/ld+json':
            self._in_json_ld = True
            self._json_ld_buf = []

    def handle_data(self, data: str):
        if self._in_title:
            self._title_buf.append(data)
        elif self._in_json_ld:
            self._json_ld_buf.append(data)

    def handle_endtag(self, tag: str):
        tag_lower = tag.lower()
        if tag_lower == 'title' and self._in_title:
            self._in_title = False
            self.title = "".join(self._title_buf).strip()
        elif tag_lower == 'script' and self._in_json_ld:
            self._in_json_ld = False
            raw = "".join(self._json_ld_buf).strip()
            if raw:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        self.json_ld.extend(parsed)
                    else:
                        self.json_ld.append(parsed)
                except Exception:
                    pass

def extract_structured_metadata(html: str, url: str = "") -> Dict[str, Any]:
    """
    Extracts structured product information (title, price, image, brand, availability)
    from HTML using JSON-LD, OpenGraph tags, and retailer regex fallbacks.
    """
    parser = HTMLMetadataParser()
    try:
        parser.feed(html)
    except Exception:
        pass

    extracted: Dict[str, Any] = {
        "title": None,
        "price": None,
        "currency": "INR",
        "image_url": None,
        "brand": None,
        "description": None,
        "in_stock": True,
    }

    def search_json_ld_item(obj: Any):
        if not isinstance(obj, dict):
            return
        
        # Handle @graph containers
        if "@graph" in obj and isinstance(obj["@graph"], list):
            for child in obj["@graph"]:
                search_json_ld_item(child)
            return

        type_val = obj.get("@type")
        is_product = False
        if isinstance(type_val, str) and type_val.lower() in ("product", "individualproduct"):
            is_product = True
        elif isinstance(type_val, list) and any(str(t).lower() == "product" for t in type_val):
            is_product = True

        if is_product:
            if not extracted["title"] and obj.get("name"):
                extracted["title"] = str(obj["name"]).strip()
            
            if not extracted["brand"]:
                brand_val = obj.get("brand")
                if isinstance(brand_val, dict):
                    extracted["brand"] = brand_val.get("name")
                elif isinstance(brand_val, str):
                    extracted["brand"] = brand_val.strip()

            if not extracted["image_url"]:
                img_val = obj.get("image")
                if isinstance(img_val, str):
                    extracted["image_url"] = img_val
                elif isinstance(img_val, list) and img_val:
                    first = img_val[0]
                    extracted["image_url"] = first if isinstance(first, str) else first.get("url")
                elif isinstance(img_val, dict):
                    extracted["image_url"] = img_val.get("url")

            if not extracted["description"] and obj.get("description"):
                extracted["description"] = str(obj["description"]).strip()

            # Process offers
            offers = obj.get("offers")
            if isinstance(offers, list) and offers:
                offers = offers[0]
            if isinstance(offers, dict):
                p_val = offers.get("price") or offers.get("lowPrice")
                if p_val is not None and extracted["price"] is None:
                    try:
                        clean_p = re.sub(r"[^\d.]", "", str(p_val))
                        if clean_p:
                            extracted["price"] = float(clean_p)
                    except ValueError:
                        pass
                curr_val = offers.get("priceCurrency")
                if curr_val and isinstance(curr_val, str):
                    extracted["currency"] = curr_val.upper()
                avail = str(offers.get("availability", "")).lower()
                if "outofstock" in avail or "discontinued" in avail:
                    extracted["in_stock"] = False

    for item in parser.json_ld:
        search_json_ld_item(item)

    # OpenGraph & Meta fallbacks
    if not extracted["title"]:
        extracted["title"] = parser.meta.get("og:title") or parser.meta.get("twitter:title") or parser.title

    if not extracted["image_url"]:
        extracted["image_url"] = (
            parser.meta.get("og:image") or 
            parser.meta.get("og:image:secure_url") or 
            parser.meta.get("twitter:image")
        )

    if extracted["price"] is None:
        p_str = (
            parser.meta.get("og:price:amount") or 
            parser.meta.get("product:price:amount") or
            parser.meta.get("twitter:data1")
        )
        if p_str:
            try:
                clean_p = re.sub(r"[^\d.]", "", str(p_str))
                if clean_p:
                    extracted["price"] = float(clean_p)
            except ValueError:
                pass

    if parser.meta.get("og:price:currency") or parser.meta.get("product:price:currency"):
        extracted["currency"] = (
            parser.meta.get("og:price:currency") or 
            parser.meta.get("product:price:currency") or 
            "INR"
        ).upper()

    if not extracted["description"]:
        extracted["description"] = parser.meta.get("og:description") or parser.meta.get("description")

    # Store-specific & Regex price fallbacks if price is still missing
    if extracted["price"] is None:
        # Pattern 1: ₹ 4,990 or INR 4990 or Rs. 4,990
        inr_match = re.search(r'(?:₹|INR|Rs\.?)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)', html)
        if inr_match:
            try:
                num = inr_match.group(1).replace(",", "")
                extracted["price"] = float(num)
            except ValueError:
                pass

    # Clean product title of retailer suffixes
    if extracted["title"]:
        cleaned_title = re.sub(
            r'\s*(\||-|–|—|:)\s*(IKEA|Amazon|Flipkart|Meesho|Myntra|Nykaa|Tata Cliq|Ajio|Croma|Reliance Digital).*$', 
            '', 
            extracted["title"], 
            flags=re.IGNORECASE
        )
        extracted["title"] = cleaned_title.strip()

    # Convert non-INR currencies to INR at standard conversion rates if applicable
    if extracted["price"] is not None and extracted["currency"] == "USD":
        extracted["price"] = round(extracted["price"] * 83.0, 2)
        extracted["currency"] = "INR"

    return extracted

def fetch_url_data(url: str) -> Tuple[str, Dict[str, Any]]:
    """
    Fetches the HTML of the URL with realistic browser headers to prevent bot-blocks,
    extracts structured product metadata, and returns (clean_text_summary, structured_data).
    """
    empty_res = ("", {
        "title": None,
        "price": None,
        "currency": "INR",
        "image_url": None,
        "brand": None,
        "description": None,
        "in_stock": True
    })
    if not url:
        return empty_res

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
    }

    try:
        logger.info(f"Fetching URL content with browser headers: '{url}'")
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as response:
            html = response.read().decode('utf-8', errors='ignore')
            
            # Extract structured product metadata
            structured = extract_structured_metadata(html, url=url)
            
            # Extract body text for Gemini grounding
            body_text = re.sub(r'<(script|style|svg|noscript).*?>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
            body_text = re.sub(r'<.*?>', ' ', body_text)
            body_text = ' '.join(body_text.split())
            
            title = structured.get("title") or ""
            content_summary = f"Page Title: {title}\n\nPage Text Content:\n{body_text[:4000]}"
            return content_summary, structured
            
    except Exception as e:
        logger.error(f"Error fetching URL content for '{url}': {str(e)}")
        return empty_res

def fetch_url_content(url: str) -> str:
    """Backward compatibility wrapper returning text summary."""
    summary, _ = fetch_url_data(url)
    return summary

def run_research(item_name: str, manual_link: Optional[str] = None) -> dict:
    """
    Runs research on an item using Gemini, direct page scraping, and Google Search grounding.
    Returns a validated dictionary of results. Paces requests to respect API rate limits.
    """
    with gemini_thread_lock:
        try:
            # 1. Scrape manual link directly if provided
            scraped_content = ""
            scraped_meta: Dict[str, Any] = {}
            detected_source = "other"
            
            if manual_link:
                detected_source = detect_platform_from_url(manual_link)
                scraped_content, scraped_meta = fetch_url_data(manual_link)
                logger.info(f"Scraped metadata for '{manual_link}': {scraped_meta}")

            now = time.time()
            elapsed = now - last_request_time[0]
            if elapsed < REQUEST_SPACING:
                sleep_time = REQUEST_SPACING - elapsed
                print(f"[{threading.current_thread().name}] Pacing Queue: sleeping {sleep_time:.2f}s", flush=True)
                time.sleep(sleep_time)

            print(f"[{threading.current_thread().name}] Initiating Gemini call for '{item_name}'...", flush=True)
            
            result = None
            try:
                result = _run_research_internal_with_retry(
                    item_name=item_name, 
                    manual_link=manual_link,
                    scraped_content=scraped_content,
                    scraped_meta=scraped_meta
                )
            except Exception as gemini_err:
                logger.error(f"Gemini API execution failed: {gemini_err}")
                # Resilient Fallback: If Gemini fails, but direct scraping extracted product info from manual link, construct response!
                if manual_link and (scraped_meta.get("price") is not None or scraped_meta.get("title")):
                    logger.info("Using directly scraped product metadata as fallback response.")
                    final_title = scraped_meta.get("title") or extract_name_from_url(manual_link)
                    price_val = float(scraped_meta.get("price") or 0)
                    result = {
                        "brand": scraped_meta.get("brand") or "",
                        "model": final_title,
                        "summary": scraped_meta.get("description") or f"Product researched from {urlparse(manual_link).netloc}.",
                        "product_name": final_title,
                        "specs": {},
                        "prices": [{
                            "source": detected_source,
                            "price": price_val,
                            "currency": scraped_meta.get("currency", "INR"),
                            "url": manual_link,
                            "in_stock": scraped_meta.get("in_stock", True)
                        }],
                        "best_price": {
                            "source": detected_source,
                            "price": price_val,
                            "url": manual_link,
                            "reasoning": f"Verified live offer from retailer ({detected_source.upper()})."
                        },
                        "image_url": scraped_meta.get("image_url"),
                        "confidence": "high"
                    }
                else:
                    raise gemini_err

            # Ensure product image from scraped metadata is attached if missing
            if scraped_meta.get("image_url") and not result.get("image_url"):
                result["image_url"] = scraped_meta["image_url"]

            # If manual link provided a verified price, guarantee it is included in result["prices"]
            if manual_link and scraped_meta.get("price") is not None:
                scraped_price = float(scraped_meta["price"])
                existing_match = False
                if "prices" in result and isinstance(result["prices"], list):
                    for p in result["prices"]:
                        if p.get("url") == manual_link:
                            existing_match = True
                            p["price"] = scraped_price
                            p["source"] = detected_source
                            break
                if not existing_match:
                    if "prices" not in result or not isinstance(result["prices"], list):
                        result["prices"] = []
                    result["prices"].insert(0, {
                        "source": detected_source,
                        "price": scraped_price,
                        "currency": scraped_meta.get("currency", "INR"),
                        "url": manual_link,
                        "in_stock": scraped_meta.get("in_stock", True)
                    })

            # Apply server-side validate_price_entry domain filter
            if "prices" in result and isinstance(result["prices"], list):
                valid_prices = []
                brand = result.get("brand")
                for p in result["prices"]:
                    url = p.get("url", "")
                    src = str(p.get("source", "other")).lower()
                    is_valid, reject_reason, normalized_source = validate_price_entry(
                        src, url, brand=brand, item_name=item_name, manual_link=manual_link
                    )
                    if is_valid:
                        p["source"] = normalized_source
                        valid_prices.append(p)
                    else:
                        logger.warning(f"run_research: Price entry REJECTED ({src} -> {url}): {reject_reason}")
                result["prices"] = valid_prices
                
                # Re-derive best_price based on the validated prices array
                best_price_obj = result.get("best_price")
                if not valid_prices:
                    result["best_price"] = None
                elif isinstance(best_price_obj, dict):
                    best_url = best_price_obj.get("url")
                    best_source = best_price_obj.get("source")
                    
                    matching_entry = None
                    if best_url:
                        matching_entry = next((vp for vp in valid_prices if vp.get("url") == best_url), None)
                    if not matching_entry and best_source:
                        matching_entry = next((vp for vp in valid_prices if vp.get("source") == best_source), None)
                        
                    if matching_entry:
                        best_price_obj["source"] = matching_entry["source"]
                        best_price_obj["price"] = matching_entry["price"]
                        if "url" in matching_entry:
                            best_price_obj["url"] = matching_entry["url"]
                    else:
                        cheapest = min(valid_prices, key=lambda x: x.get("price", float('inf')))
                        result["best_price"] = {
                            "source": cheapest["source"],
                            "price": cheapest["price"],
                            "url": cheapest.get("url"),
                            "reasoning": f"Lowest price found among validated sources ({cheapest['source']})."
                        }
                else:
                    cheapest = min(valid_prices, key=lambda x: x.get("price", float('inf')))
                    result["best_price"] = {
                        "source": cheapest["source"],
                        "price": cheapest["price"],
                        "url": cheapest.get("url"),
                        "reasoning": f"Lowest price found among validated sources ({cheapest['source']})."
                    }
                
            return result
        finally:
            last_request_time[0] = time.time()

def _run_research_internal_with_retry(
    item_name: str, 
    manual_link: Optional[str] = None,
    scraped_content: str = "",
    scraped_meta: Optional[Dict[str, Any]] = None
) -> dict:
    max_attempts = 3
    base_backoff = 2.0
    
    for attempt in range(1, max_attempts + 1):
        try:
            return _call_gemini_api(item_name, manual_link, scraped_content, scraped_meta)
        except Exception as e:
            err_code = getattr(e, "code", None)
            err_msg = str(e).lower()
            details_str = str(getattr(e, "details", "")).lower()
            combined_err = f"{err_msg} {details_str}"
            
            is_429 = (err_code == 429) or ("429" in err_msg) or ("resource_exhausted" in err_msg) or ("too_many_requests" in err_msg)
            
            if is_429:
                is_rpd = "per_day" in combined_err or "daily" in combined_err or "requests_per_day" in combined_err or "rpd" in combined_err
                if is_rpd:
                    logger.error(f"Daily request limit reached. Failing fast: {str(e)}")
                    raise ValueError("Daily research limit reached — try again after midnight Pacific time")
                    
                if attempt == max_attempts:
                    logger.error(f"Max research retry attempts reached. Failing: {str(e)}")
                    raise e
                    
                sleep_duration = (base_backoff ** attempt) + random.uniform(0.5, 1.5)
                logger.warning(f"Gemini API rate limited (Attempt {attempt}/{max_attempts}). Retrying in {sleep_duration:.2f}s...")
                time.sleep(sleep_duration)
            else:
                logger.error(f"Non-retryable error during Gemini call: {str(e)}")
                raise e

def _call_gemini_api(
    item_name: str, 
    manual_link: Optional[str] = None,
    scraped_content: str = "",
    scraped_meta: Optional[Dict[str, Any]] = None
) -> dict:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in the backend environment.")

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    system_prompt = (
        "You are an expert shopping and technical product research assistant.\n"
        "Your goal is to find details, specifications, product images, and live prices in Indian Rupees (INR) for the requested item.\n\n"
        "GROUNDING SEARCH RULES:\n"
        "1. Strictly prioritize trusted Indian retail domains: Amazon India (amazon.in), Flipkart (flipkart.com), IKEA India (ikea.com/in/en), Meesho (meesho.com), Myntra (myntra.com), Croma (croma.com), Reliance Digital (reliancedigital.in), and official brand stores. Do NOT return amazon.com or US links.\n"
        "2. All product prices must be in Indian Rupees (INR). If you only find USD/foreign currency prices, convert them to INR (1 USD = 83 INR).\n"
        "3. Only include an 'official' source if you can locate the brand's actual domain (e.g. apple.com, sony.co.in, ikea.com). Do NOT return reseller domains as 'official'.\n"
        "4. Direct Product Pages Only: Links must point directly to a product page. Do NOT return search result pages.\n"
        "5. If a direct link was provided, prioritize the scraped details from that link.\n\n"
        "IMPORTANT: Return a SINGLE, STRICT JSON object with this exact structure:\n"
        "{\n"
        "  \"brand\": \"Brand name (string)\",\n"
        "  \"model\": \"Model name/number (string)\",\n"
        "  \"summary\": \"A short 1-2 sentence summary of the item (string)\",\n"
        "  \"product_name\": \"Clean product title extracted from the link (string, optional)\",\n"
        "  \"image_url\": \"Direct public image URL of the product (string, optional)\",\n"
        "  \"specs\": { \"spec_name\": \"spec_value\", ... },\n"
        "  \"prices\": [\n"
        "    { \"source\": \"amazon\" | \"flipkart\" | \"ikea\" | \"meesho\" | \"myntra\" | \"croma\" | \"official\" | \"other\", \"price\": number, \"currency\": \"INR\", \"url\": \"string (valid web link)\", \"in_stock\": boolean }\n"
        "  ],\n"
        "  \"best_price\": { \"source\": \"amazon\" | \"flipkart\" | \"ikea\" | \"meesho\" | \"official\" | \"other\", \"price\": number, \"reasoning\": \"string explaining why this is the best option\" },\n"
        "  \"confidence\": \"low\" | \"medium\" | \"high\"\n"
        "}"
    )

    is_placeholder_name = (item_name or "").lower().strip() in [
        "researching name...", "researching name", 
        "researching details...", "researching details",
        "pending"
    ]

    if manual_link:
        detected_store = detect_platform_from_url(manual_link)
        known_title = (scraped_meta or {}).get("title") or (extract_name_from_url(manual_link) if is_placeholder_name else item_name)
        known_price = (scraped_meta or {}).get("price")
        known_image = (scraped_meta or {}).get("image_url")
        
        user_input = (
            f"Analyze the product at user link: '{manual_link}' (Detected store: {detected_store.upper()}).\n"
        )
        if known_title:
            user_input += f"Verified Product Title: {known_title}\n"
        if known_price:
            user_input += f"Verified Live Price: ₹{known_price}\n"
        if known_image:
            user_input += f"Verified Image URL: {known_image}\n"
            
        if scraped_content:
            user_input += f"\nPage Scraped Content:\n\"\"\"\n{scraped_content}\n\"\"\"\n\n"
            
        user_input += (
            "Instructions:\n"
            f"1. You MUST include a price entry for this link '{manual_link}' in the 'prices' list with source '{detected_store}'.\n"
            "2. Extract technical specifications, dimensions, brand, and key features.\n"
            "3. If other trusted Indian stores (Amazon India, Flipkart, etc.) sell this item, add their comparative prices.\n"
            "4. Return the exact product image URL in the 'image_url' field."
        )
    else:
        user_input = f"Research details, specs, high-res image, and live prices in INR for: '{item_name}'. Check Amazon India, Flipkart, and official brand portals."
    
    target_model = settings.GEMINI_MODEL
    try:
        interaction = client.interactions.create(
            model=target_model,
            system_instruction=system_prompt,
            input=user_input,
            tools=[{"type": "google_search"}]
        )
        
        text = interaction.output_text
        cleaned_json = clean_json_response(text)
        return json.loads(cleaned_json)
    except Exception as e:
        logger.error(f"Error in Gemini call: {str(e)}")
        raise e
