import json
import logging
import re
import threading
import time
import random
from urllib.parse import urlparse
import urllib.request
import urllib.error
from typing import Optional
from google import genai
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Thread-safe rate limit queue pacing variables
gemini_thread_lock = threading.Lock()
last_request_time = [0.0]
REQUEST_SPACING = 7.5  # Spacing in seconds (safely under 10 RPM limit)

def extract_name_from_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        path = parsed.path
        parts = [p for p in path.split('/') if p]
        for part in parts:
            if '-' in part or '_' in part:
                name = part.replace('-', ' ').replace('_', ' ')
                return name.strip().title()
        if parts:
            return parts[-1].replace('-', ' ').replace('_', ' ').strip().title()
    except Exception:
        pass
    return "this product"

def validate_price_entry(
    source: str, 
    url: str, 
    brand: Optional[str] = None, 
    item_name: Optional[str] = None,
    manual_link: Optional[str] = None
) -> tuple[bool, str, str]:
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
        
        # 0. If this is the user's manual link, automatically accept it (explicit trust bypass)
        if manual_link:
            try:
                manual_parsed = urlparse(manual_link)
                manual_hostname = (manual_parsed.hostname or "").lower()
                host_clean = hostname.replace("www.", "")
                m_host_clean = manual_hostname.replace("www.", "")
                if host_clean == m_host_clean and host_clean:
                    logger.info(f"Accepted price entry: {hostname} matches manual_link host {manual_hostname} (validation bypass)")
                    brand_lower = brand.lower().strip() if brand else ""
                    if brand_lower and (brand_lower in host_clean):
                        return True, "", "official"
                    return True, "", "other"
            except Exception as e:
                logger.warning(f"Error comparing price URL to manual_link: {e}")
                
        if scheme != "https":
            reason = f"Non-HTTPS scheme: {scheme}"
            logger.warning(f"Rejected price entry for host {hostname}: {reason}")
            return False, reason, source
            
        # Reject low-trust TLDs
        untrusted_tlds = [".xyz", ".top", ".club", ".shop", ".site", ".online"]
        for tld in untrusted_tlds:
            if hostname.endswith(tld):
                reason = f"Uses untrusted TLD: {tld}"
                logger.warning(f"Rejected price entry for host {hostname}: {reason}")
                return False, reason, source

        source_lower = source.lower()
        path = parsed.path
        
        # 1. Normalize based on hostname ending
        if hostname.endswith("amazon.in") or hostname.endswith("amazon.com") or hostname.endswith("media-amazon.com"):
            path_lower = path.lower()
            is_amazon_product = (
                "/dp/" in path_lower or 
                "/gp/product/" in path_lower or 
                "/gp/aw/d/" in path_lower
            )
            if not is_amazon_product:
                reason = f"Amazon URL does not contain product detail path (e.g. /dp/): {url}"
                logger.warning(f"Rejected price entry for host {hostname}: {reason}")
                return False, reason, "amazon"
                
            logger.info(f"Accepted price entry: {hostname} normalized to 'amazon'")
            return True, "", "amazon"
            
        if hostname.endswith("flipkart.com"):
            if "/p/" not in path.lower():
                reason = f"Flipkart URL does not contain product detail path /p/: {url}"
                logger.warning(f"Rejected price entry for host {hostname}: {reason}")
                return False, reason, "flipkart"
                
            logger.info(f"Accepted price entry: {hostname} normalized to 'flipkart'")
            return True, "", "flipkart"
            
        # 2. Check official brand match context
        domain_parts = hostname.split('.')
        brand_clean = re.sub(r'[^a-z0-9]', '', (brand or "").lower())
        if brand_clean:
            # Check if brand is exactly one of the domain parts or a substring of domain parts (if long enough)
            if brand_clean in domain_parts or any(brand_clean in part for part in domain_parts if len(brand_clean) >= 3):
                logger.info(f"Accepted price entry: {hostname} classified as 'official' matching brand '{brand}'")
                return True, "", "official"

        # 3. Check trusted platforms list
        trusted_platforms = {
            "myntra": ["myntra.com", "www.myntra.com"],
            "zepto": ["zeptonow.com", "www.zeptonow.com"],
            "meesho": ["meesho.com", "www.meesho.com"],
            "blinkit": ["blinkit.com", "www.blinkit.com"],
            "instamart": ["instamart.in", "www.instamart.in", "swiggy.com", "www.swiggy.com"],
            "instagram": ["instagram.com", "www.instagram.com"],
            "swiggy": ["swiggy.com", "www.swiggy.com"],
            "croma": ["croma.com", "www.croma.com"],
            "reliance": ["reliancedigital.in", "www.reliancedigital.in"],
            "vijay": ["vijaysales.com", "www.vijaysales.com"]
        }
        
        # Check if the hostname itself matches any domain in any trusted platform
        for platform, domains in trusted_platforms.items():
            if hostname in domains:
                logger.info(f"Accepted price entry: {hostname} classified as 'other' matching trusted platform '{platform}'")
                return True, "", "other"
                
        # 4. If Gemini explicitly tagged it as official (and it passed TLD check), trust it
        if source_lower == "official":
            logger.info(f"Accepted price entry: {hostname} classified as 'official' because input source label was 'official'")
            return True, "", "official"
            
        # 5. Otherwise, check if input source contains a trusted platform as substring
        for platform, domains in trusted_platforms.items():
            if platform in source_lower:
                if hostname in domains:
                    logger.info(f"Accepted price entry: {hostname} classified as 'other' matching platform label '{platform}'")
                    return True, "", "other"

        reason = f"Hostname '{hostname}' does not match brand '{brand or ''}' or any trusted domain list (input source: '{source}')"
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
    
    # Strip markdown block quotes if present
    if "```" in cleaned:
        # Match ```json ... ``` or ``` ... ```
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL)
        if match:
            return match.group(1).strip()
    
    # Fallback: Find the first '{' and last '}'
    first_brace = cleaned.find('{')
    last_brace = cleaned.rfind('}')
    if first_brace != -1 and last_brace != -1:
        return cleaned[first_brace:last_brace + 1].strip()
        
    return cleaned

def fetch_url_content(url: str) -> str:
    """
    Fetches the HTML content of the URL and returns a simplified version of it (e.g. title and body text).
    """
    if not url:
        return ""
    try:
        logger.info(f"Fetching URL content for manual research: '{url}'")
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            # Extract basic title
            title = ""
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
            if title_match:
                title = title_match.group(1).strip()
            
            # Clean body text (strip script/style tags)
            body_text = re.sub(r'<(script|style).*?>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
            # Remove all HTML tags
            body_text = re.sub(r'<.*?>', ' ', body_text)
            # Normalize whitespace
            body_text = ' '.join(body_text.split())
            
            # Limit to first 4000 characters to keep tokens reasonable
            content_summary = f"Page Title: {title}\n\nPage Text Content:\n{body_text[:4000]}"
            return content_summary
    except Exception as e:
        logger.error(f"Error fetching URL content for '{url}': {str(e)}")
        return ""

def run_research(item_name: str, manual_link: Optional[str] = None) -> dict:
    """
    Runs research on an item using Gemini and Google Search grounding.
    Returns a validated dictionary of results.
    Paces requests using a thread lock to respect the RPM limit.
    """
    with gemini_thread_lock:
        try:
            now = time.time()
            elapsed = now - last_request_time[0]
            if elapsed < REQUEST_SPACING:
                sleep_time = REQUEST_SPACING - elapsed
                print(f"[{threading.current_thread().name}] Pacing Queue: sleeping {sleep_time:.2f}s (last request was {elapsed:.2f}s ago at {time.strftime('%H:%M:%S', time.localtime(last_request_time[0]))})", flush=True)
                time.sleep(sleep_time)
                
            print(f"[{threading.current_thread().name}] Initiating Gemini call for '{item_name}' at {time.strftime('%H:%M:%S', time.localtime())}...", flush=True)
            result = _run_research_internal_with_retry(item_name, manual_link)
            return result
        finally:
            last_request_time[0] = time.time()

def _run_research_internal_with_retry(item_name: str, manual_link: Optional[str] = None) -> dict:
    from google.genai import errors
    max_attempts = 4
    base_backoff = 2.0
    
    for attempt in range(1, max_attempts + 1):
        try:
            return _call_gemini_api(item_name, manual_link)
        except Exception as e:
            err_code = getattr(e, "code", None)
            err_msg = str(e).lower()
            details_str = str(getattr(e, "details", "")).lower()
            combined_err = f"{err_msg} {details_str}"
            
            # Check if this is a 429 rate limit
            is_429 = (err_code == 429) or ("429" in err_msg) or ("resource_exhausted" in err_msg) or ("too_many_requests" in err_msg)
            
            if is_429:
                # Differentiate RPD (Daily) from RPM/TPM (Minute)
                is_rpd = "per_day" in combined_err or "daily" in combined_err or "requests_per_day" in combined_err or "rpd" in combined_err
                
                if is_rpd:
                    logger.error(f"Daily request limit (RPD) reached. Failing fast: {str(e)} Details: {getattr(e, 'details', None)}")
                    raise ValueError("Daily research limit reached — try again after midnight Pacific time")
                    
                if attempt == max_attempts:
                    logger.error(f"Max research retry attempts ({max_attempts}) reached. Failing: {str(e)}")
                    raise e
                    
                sleep_duration = (base_backoff ** attempt) + random.uniform(0.5, 1.5)
                logger.warning(
                    f"Gemini API rate limited (Attempt {attempt}/{max_attempts}). "
                    f"Retrying in {sleep_duration:.2f} seconds... Error: {str(e)}"
                )
                time.sleep(sleep_duration)
            else:
                # Other non-rate-limit errors: fail immediately
                logger.error(f"Non-retryable error during Gemini call: {str(e)}")
                raise e

def _call_gemini_api(item_name: str, manual_link: Optional[str] = None) -> dict:
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in the backend environment.")

    # Initialize Gemini client
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Setup system prompt instructions (hardened query rules)
    system_prompt = (
        "You are an expert shopping and technical product research assistant.\n"
        "Your goal is to find details, specifications, and live prices in Indian Rupees (INR) for the requested item.\n\n"
        "GROUNDING SEARCH RULES:\n"
        "1. Strictly use query formats restricting search to trusted Indian domains, e.g. using 'site:amazon.in' or 'site:flipkart.com'. Do NOT return amazon.com or US links.\n"
        "2. All product prices must be in Indian Rupees (INR). If you only find USD/foreign currency prices, convert them to INR using a 1 USD = 83 INR conversion rate.\n"
        "3. Only include an 'official' source if you can locate the brand's actual domain (e.g. apple.com or logitech.com). Do NOT return reseller domains, marketplace profiles, or generic retail stores as 'official'.\n"
        "4. If a clean, trusted price match cannot be identified, OMIT that source entry entirely from your output. Do NOT substitute low-quality or untrusted domains.\n"
        "5. Force all Amazon links to point to amazon.in instead of amazon.com.\n"
        "6. Direct Product Pages Only: You MUST only return links that point directly to a product page. Do NOT return search result pages or category list pages under any circumstances. If you only find a search result page, OMIT that price entry. Amazon links must contain '/dp/' or '/gp/product/' followed by a 10-character ASIN (e.g., https://www.amazon.in/dp/B084Z6T721). Flipkart links must contain '/p/' followed by the product ID (e.g., https://www.flipkart.com/item/p/itm5a3b97b102808).\n\n"
        "For generic queries (e.g. 'OLED monitor' or 'gaming mouse'), select a specific, popular, highly-rated product recommendation (e.g. 'Logitech G502 X') and research that specific model. In your 'best_price.reasoning' field, note that you selected this specific model because the input name was generic.\n\n"
        "IMPORTANT: You must return a SINGLE, STRICT JSON object. Do not include any introductory or concluding text, explanations, or prose outside the JSON. The response must parse perfectly as JSON with this exact structure:\n"
        "{\n"
        "  \"brand\": \"Brand name (string)\",\n"
        "  \"model\": \"Model name/number (string)\",\n"
        "  \"summary\": \"A short 1-2 sentence summary of the item (string)\",\n"
        "  \"product_name\": \"Clean product title extracted from the link if a manual link was provided (string, optional)\",\n"
        "  \"specs\": { \"spec_name\": \"spec_value\", ... },\n"
        "  \"prices\": [\n"
        "    { \"source\": \"amazon\" | \"flipkart\" | \"official\" | \"other\", \"price\": number, \"currency\": \"INR\", \"url\": \"string (valid web link)\", \"in_stock\": boolean }\n"
        "  ],\n"
        "  \"best_price\": { \"source\": \"amazon\" | \"flipkart\" | \"official\" | \"other\", \"price\": number, \"reasoning\": \"string explaining why this is the best option\" },\n"
        "  \"confidence\": \"low\" | \"medium\" | \"high\"\n"
        "}"
    )

    is_placeholder_name = (item_name or "").lower().strip() in [
        "researching name...", "researching name", 
        "researching details...", "researching details",
        "pending"
    ]

    if manual_link:
        logger.info(f"Triggering Gemini research for manual link: '{manual_link}' (item: '{item_name}', placeholder: {is_placeholder_name})...")
        page_content = fetch_url_content(manual_link)
        
        if is_placeholder_name:
            extracted_name = extract_name_from_url(manual_link)
            fallback_query = f"'{extracted_name}'"
        else:
            fallback_query = f"'{item_name}'"
        
        if page_content:
            logger.info("Successfully fetched manual link content to feed to Gemini.")
            user_input = (
                f"Analyze the product details from the crawled page content of the user-provided link: '{manual_link}'.\n"
                f"Page Crawled Content:\n\"\"\"\n{page_content}\n\"\"\"\n\n"
                f"Instructions:\n"
                f"1. Extract the primary product title/name and return it in the 'product_name' field.\n"
                f"2. Extract the price, specifications, brand, model, and availability *specifically* from this page content.\n"
                f"3. In the 'prices' list, you MUST include a price entry for this source (the manual link '{manual_link}') as one of the entries, using the correct price found on the page.\n"
                f"4. If the page content does not contain enough specifications or details, use Google Search grounding as a fallback to search for specs and details of {fallback_query}."
            )
        else:
            logger.warning("Could not fetch page content directly. Falling back to search grounding with link query.")
            user_input = (
                f"Research details, specs, and live price offers (in INR) for the product at this link: '{manual_link}'.\n"
                f"Extract the product name/title from the page and return it in the 'product_name' field.\n"
                f"If the link is unreachable, fallback to searching for specs and details of {fallback_query} via Google Search grounding."
            )
    else:
        logger.info(f"Triggering Gemini research for item: '{item_name}' with Google Search grounding...")
        user_input = f"Research details, specs, and live price offers (in INR) for this item: '{item_name}'. Only include trusted domains."
    
    target_model = "gemini-3.1-flash-lite"
    try:
        print(f"[{threading.current_thread().name}] >>> OUTGOING API PAYLOAD MODEL: '{target_model}' at {time.strftime('%H:%M:%S', time.localtime())}.{int(time.time() * 1000) % 1000:03d}", flush=True)
        interaction = client.interactions.create(
            model=target_model,
            system_instruction=system_prompt,
            input=user_input,
            tools=[{"type": "google_search"}]
        )
        
        text = interaction.output_text
        logger.info("Gemini research completed. Parsing response...")
        
        try:
            cleaned_json = clean_json_response(text)
            result_data = json.loads(cleaned_json)
            return result_data
        except Exception as e:
            logger.error(f"Failed to parse Gemini output as JSON. Raw text:\n{text}")
            raise ValueError(f"Failed to parse research data: {str(e)}")
            
    except Exception as e:
        logger.error(f"Error calling Gemini API: {str(e)}")
        raise e
