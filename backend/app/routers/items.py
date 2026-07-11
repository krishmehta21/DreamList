from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from typing import List, Optional
from uuid import UUID
from app.schemas.schemas import (
    WishlistItemResponse, 
    WishlistItemDetailResponse, 
    WishlistItemCreate, 
    WishlistItemUpdate,
    WishlistItemManualPriceCreate,
    ItemPriceResponse,
    ItemAttachmentCreate,
    ItemAttachmentResponse
)
from app.core.auth import get_current_user, get_user_db_client
from supabase import Client
from app.services.research_service import run_research
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Global in-memory dictionary to track when research was started for each item
# Format: {item_id_str: start_datetime}
research_start_times = {}

def check_and_clean_timeouts(client: Client, user_id: str):
    """
    Checks if any wishlist items currently in 'pending' or 'researching' state
    have exceeded the 2-minute timeout threshold, and marks them as 'failed'.
    """
    try:
        response = client.table("wishlist_items") \
            .select("id, status, created_at") \
            .in_("status", ["pending", "researching"]) \
            .eq("user_id", user_id) \
            .execute()
            
        if not response.data:
            return
            
        now = datetime.utcnow()
        timed_out_ids = []
        
        for item in response.data:
            item_id = item["id"]
            # Parse created_at. Supabase returns e.g. '2026-07-05T10:56:04.123456+00:00'
            created_at_str = item["created_at"].split('+')[0]
            if 'T' in created_at_str:
                try:
                    created_at = datetime.fromisoformat(created_at_str)
                except ValueError:
                    created_at = now
            else:
                created_at = now
                
            start_time = research_start_times.get(item_id)
            if start_time is None:
                # Fallback to created_at if not present in memory (e.g. server restart)
                time_diff = (now - created_at).total_seconds()
                if time_diff > 120:  # 2 minutes
                    timed_out_ids.append(item_id)
                else:
                    research_start_times[item_id] = created_at
            else:
                time_diff = (now - start_time).total_seconds()
                if time_diff > 120:
                    timed_out_ids.append(item_id)
                    
        if timed_out_ids:
            logger.info(f"Timing out stuck items: {timed_out_ids}")
            client.table("wishlist_items") \
                .update({"status": "failed"}) \
                .in_("id", timed_out_ids) \
                .execute()
                
            for tid in timed_out_ids:
                research_start_times.pop(tid, None)
                
    except Exception as e:
        logger.error(f"Error checking research timeouts: {str(e)}")

def run_background_research(item_id: str, item_name: str, user_id: str):
    """
    Background worker task to trigger research and save results in DB.
    Uses the service role key to bypass RLS and guarantee access.
    """
    from app.core.config import get_settings
    from supabase import create_client
    
    settings = get_settings()
    # Initialize service client to bypass RLS for write access
    service_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    
    # 1. Update status to researching
    service_client.table("wishlist_items") \
        .update({"status": "researching"}) \
        .eq("id", item_id) \
        .execute()
        
    try:
        # Get manual_link from DB
        item_res = service_client.table("wishlist_items") \
            .select("manual_link, name") \
            .eq("id", item_id) \
            .execute()
            
        manual_link = None
        if item_res.data:
            manual_link = item_res.data[0].get("manual_link")
            item_name = item_res.data[0].get("name") or item_name

        # 2. Run Gemini research
        research_data = run_research(item_name, manual_link=manual_link)
        
        # If user has a manual link or the name is a placeholder, and Gemini resolved a name, update it in DB
        extracted_name = research_data.get("product_name")
        if not extracted_name or not str(extracted_name).strip():
            brand_val = research_data.get("brand")
            model_val = research_data.get("model")
            if brand_val and model_val:
                extracted_name = f"{brand_val} {model_val}"
            elif model_val:
                extracted_name = model_val
            elif brand_val:
                extracted_name = brand_val
                
        is_placeholder_name = (item_name or "").lower().strip() in [
            "researching name...", "researching name", 
            "researching details...", "researching details",
            "pending"
        ]
        
        if extracted_name and str(extracted_name).strip() and (manual_link or is_placeholder_name):
            service_client.table("wishlist_items") \
                .update({"name": str(extracted_name).strip()}) \
                .eq("id", item_id) \
                .execute()
        
        # Convert confidence
        conf_map = {"low": 0.30, "medium": 0.70, "high": 1.00}
        conf_str = str(research_data.get("confidence", "medium")).lower()
        confidence_val = conf_map.get(conf_str, 0.70)
        
        # 3. Wipes old records to avoid duplicate key violations (idempotent run)
        service_client.table("item_research").delete().eq("item_id", item_id).execute()
        service_client.table("item_prices").delete().eq("item_id", item_id).neq("source", "manual").execute()
        
        # 4. Insert research specs
        specs_data = research_data.get("specs", {})
        if not isinstance(specs_data, dict):
            specs_data = {}
        best_price_obj = research_data.get("best_price") or {}
        reasoning = best_price_obj.get("reasoning") if isinstance(best_price_obj, dict) else None
        if reasoning:
            specs_data["_best_price_reasoning"] = str(reasoning)

        research_row = {
            "item_id": item_id,
            "brand": research_data.get("brand"),
            "model": research_data.get("model"),
            "summary": research_data.get("summary"),
            "specs": specs_data,
            "confidence": confidence_val
        }
        service_client.table("item_research").insert(research_row).execute()
        
        # 5. Insert live prices list
        from app.services.research_service import validate_price_entry
        prices_list = research_data.get("prices", [])
        brand = research_data.get("brand")
        inserted_prices_count = 0
        for p in prices_list:
            url = p.get("url", "")
            src = str(p.get("source", "other")).lower()
            
            # Apply server-side domain allowlist filter and classify by hostname context
            is_valid, reject_reason, normalized_source = validate_price_entry(
                src, url, brand=brand, item_name=item_name, manual_link=manual_link
            )
            if not is_valid:
                logger.warning(f"Price entry REJECTED for item {item_id} ({src} -> {url}): {reject_reason}")
                continue
                
            price_row = {
                "item_id": item_id,
                "source": normalized_source,
                "price": float(p.get("price", 0)),
                "currency": p.get("currency", "INR"),
                "url": url,
                "in_stock": bool(p.get("in_stock", True))
            }
            service_client.table("item_prices").insert(price_row).execute()
            inserted_prices_count += 1
            
        # If the user shared a direct link, but we failed to validate any price entries, fail the research run.
        if manual_link and inserted_prices_count == 0:
            raise ValueError(f"No valid price entries could be extracted/validated from the shared link: {manual_link}")
            
        # 6. Mark status as ready
        service_client.table("wishlist_items") \
            .update({"status": "ready"}) \
            .eq("id", item_id) \
            .execute()
            
    except Exception as e:
        logger.error(f"Background research execution failed for item {item_id}: {str(e)}")
        # Fallback status to failed
        service_client.table("wishlist_items") \
            .update({"status": "failed"}) \
            .eq("id", item_id) \
            .execute()

router = APIRouter(prefix="/items", tags=["items"])

@router.post("/", response_model=WishlistItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    item: WishlistItemCreate, 
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Creates a new wishlist item and registers background AI research.
    """
    data = item.model_dump()
    data["user_id"] = str(user.id)
    data["status"] = "pending"
    data["done"] = False
    
    try:
        response = client.table("wishlist_items").insert(data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create wishlist item"
            )
            
        new_item = response.data[0]
        
        # Register background AI research pipeline task
        research_start_times[str(new_item["id"])] = datetime.utcnow()
        background_tasks.add_task(
            run_background_research,
            item_id=new_item["id"],
            item_name=new_item["name"],
            user_id=str(user.id)
        )
        
        return new_item
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.get("/", response_model=List[WishlistItemResponse])
def get_items(
    tier: Optional[str] = None,
    category: Optional[str] = None,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Lists wishlist items for the authenticated user, with optional filters.
    """
    # Clean up any timed out stuck research tasks first
    check_and_clean_timeouts(client, str(user.id))
    
    query = client.table("wishlist_items").select("*, prices:item_prices(*), research:item_research(*)").eq("user_id", str(user.id))
    
    if tier:
        query = query.eq("tier", tier)
    if category:
        query = query.eq("category", category)
        
    try:
        response = query.execute()
        return response.data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.get("/{item_id}", response_model=WishlistItemDetailResponse)
def get_item(
    item_id: UUID,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Fetches details of a single wishlist item, including joined research and prices.
    """
    # Clean up any timed out stuck research tasks first
    check_and_clean_timeouts(client, str(user.id))
    
    try:
        # Join wishlist_items with item_research, item_prices, and item_attachments
        response = client.table("wishlist_items") \
            .select("*, research:item_research(*), prices:item_prices(*), attachments:item_attachments(*)") \
            .eq("id", str(item_id)) \
            .eq("user_id", str(user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wishlist item not found"
            )
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.patch("/{item_id}", response_model=WishlistItemResponse)
def update_item(
    item_id: UUID,
    item_update: WishlistItemUpdate,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Updates specific fields of a wishlist item.
    """
    update_data = {k: v for k, v in item_update.model_dump().items() if v is not None}
    
    # If the user is updating manual_link, we reset status to pending to trigger new AI research
    trigger_research = False
    if "manual_link" in update_data:
        update_data["status"] = "pending"
        trigger_research = True

    # If no fields are provided to update, fetch and return current state
    if not update_data:
        try:
            response = client.table("wishlist_items") \
                .select("*") \
                .eq("id", str(item_id)) \
                .eq("user_id", str(user.id)) \
                .execute()
            if not response.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Wishlist item not found"
                )
            return response.data[0]
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database error: {str(e)}"
            )

    try:
        response = client.table("wishlist_items") \
            .update(update_data) \
            .eq("id", str(item_id)) \
            .eq("user_id", str(user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wishlist item not found or unauthorized to edit"
            )
            
        updated_item = response.data[0]
        
        # If manual_link changed, trigger research in the background
        if trigger_research:
            research_start_times[str(item_id)] = datetime.utcnow()
            background_tasks.add_task(
                run_background_research,
                item_id=str(item_id),
                item_name=updated_item["name"],
                user_id=str(user.id)
            )
            
        return updated_item
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: UUID,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Deletes a wishlist item.
    """
    try:
        response = client.table("wishlist_items") \
            .delete() \
            .eq("id", str(item_id)) \
            .eq("user_id", str(user.id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Wishlist item not found or unauthorized to delete"
            )
        return
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.post("/{item_id}/research", response_model=WishlistItemResponse)
def research_item(
    item_id: UUID,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Triggers background AI research for an item, returning immediately.
    """
    # 1. Fetch the wishlist item to verify ownership
    item_response = client.table("wishlist_items") \
        .select("*") \
        .eq("id", str(item_id)) \
        .eq("user_id", str(user.id)) \
        .execute()
        
    if not item_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist item not found"
        )
    
    item = item_response.data[0]
    
    # 2. Reset status to pending
    final_resp = client.table("wishlist_items") \
        .update({"status": "pending"}) \
        .eq("id", str(item_id)) \
        .eq("user_id", str(user.id)) \
        .execute()
        
    # 3. Register background research task
    research_start_times[str(item_id)] = datetime.utcnow()
    background_tasks.add_task(
        run_background_research,
        item_id=str(item_id),
        item_name=item["name"],
        user_id=str(user.id)
    )
    
    return final_resp.data[0]

@router.post("/{item_id}/prices", response_model=ItemPriceResponse, status_code=status.HTTP_201_CREATED)
def create_manual_price(
    item_id: UUID,
    payload: WishlistItemManualPriceCreate,
    background_tasks: BackgroundTasks,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Allows the user to manually add a link/price for their wishlist item.
    Bypasses domain validation filtering as this is explicitly trusted user input.
    """
    # 1. Verify item ownership
    item_response = client.table("wishlist_items") \
        .select("id, name, manual_link") \
        .eq("id", str(item_id)) \
        .eq("user_id", str(user.id)) \
        .execute()
        
    if not item_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist item not found"
        )
    
    item = item_response.data[0]
    
    price_data = payload.model_dump()
    price_data["item_id"] = str(item_id)
    price_data["is_user_verified"] = True
    
    try:
        response = client.table("item_prices").insert(price_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record manual price entry"
            )
            
        # If the manual price includes a URL and it is different from the item's current manual_link:
        url = payload.url
        if url and str(url).strip() and item.get("manual_link") != str(url).strip():
            client.table("wishlist_items") \
                .update({"manual_link": str(url).strip(), "status": "pending"}) \
                .eq("id", str(item_id)) \
                .eq("user_id", str(user.id)) \
                .execute()
                
            research_start_times[str(item_id)] = datetime.utcnow()
            background_tasks.add_task(
                run_background_research,
                item_id=str(item_id),
                item_name=item["name"],
                user_id=str(user.id)
            )
            
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.post("/{item_id}/attachments", response_model=ItemAttachmentResponse, status_code=status.HTTP_201_CREATED)
def create_attachment(
    item_id: UUID,
    payload: ItemAttachmentCreate,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Registers a screenshot attachment path in item_attachments table for a owned wishlist item.
    """
    # Verify item ownership
    item_response = client.table("wishlist_items") \
        .select("id") \
        .eq("id", str(item_id)) \
        .eq("user_id", str(user.id)) \
        .execute()
        
    if not item_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist item not found"
        )
        
    attachment_data = {
        "item_id": str(item_id),
        "storage_path": payload.storage_path
    }
    
    try:
        response = client.table("item_attachments").insert(attachment_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to record attachment record"
            )
        return response.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

@router.delete("/{item_id}/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    item_id: UUID,
    attachment_id: UUID,
    user = Depends(get_current_user),
    client: Client = Depends(get_user_db_client)
):
    """
    Deletes a screenshot attachment record.
    """
    # Verify item ownership
    item_response = client.table("wishlist_items") \
        .select("id") \
        .eq("id", str(item_id)) \
        .eq("user_id", str(user.id)) \
        .execute()
        
    if not item_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist item not found"
        )
        
    try:
        response = client.table("item_attachments") \
            .delete() \
            .eq("id", str(attachment_id)) \
            .eq("item_id", str(item_id)) \
            .execute()
            
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment record not found"
            )
        return
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database error: {str(e)}"
        )

