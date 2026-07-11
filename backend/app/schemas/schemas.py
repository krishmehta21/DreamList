from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# Supported validation lists
VALID_CATEGORIES = ["Tech", "Home", "Apparel", "Books", "Fitness", "Other"]
VALID_TIERS = ["now", "soon", "dream"]

# User Schemas
class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    id: UUID

class UserResponse(UserBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# Wishlist Item Schemas
class WishlistItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Item name cannot be empty")
    category: str = Field(..., description="Category name (e.g. Tech, Home, or custom)")
    tier: str = Field(..., description="Must be one of: now, soon, dream")
    manual_notes: Optional[str] = None
    manual_link: Optional[str] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Category name cannot be empty")
        if len(cleaned) > 50:
            raise ValueError("Category name must be 50 characters or less")
        return cleaned

    @field_validator('tier')
    @classmethod
    def validate_tier(cls, value: str) -> str:
        if value not in VALID_TIERS:
            raise ValueError(f"Tier must be one of {VALID_TIERS}")
        return value

class WishlistItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str
    tier: str
    manual_notes: Optional[str] = None
    manual_link: Optional[str] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Category name cannot be empty")
        if len(cleaned) > 50:
            raise ValueError("Category name must be 50 characters or less")
        return cleaned

    @field_validator('tier')
    @classmethod
    def validate_tier(cls, value: str) -> str:
        if value not in VALID_TIERS:
            raise ValueError(f"Tier must be one of {VALID_TIERS}")
        return value

class WishlistItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    tier: Optional[str] = None
    status: Optional[str] = None
    done: Optional[bool] = None
    manual_notes: Optional[str] = None
    manual_link: Optional[str] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Category name cannot be empty")
        if len(cleaned) > 50:
            raise ValueError("Category name must be 50 characters or less")
        return cleaned

    @field_validator('tier')
    @classmethod
    def validate_tier(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_TIERS:
            raise ValueError(f"Tier must be one of {VALID_TIERS}")
        return value

    @field_validator('status')
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        valid_statuses = ["pending", "researching", "ready", "failed"]
        if value is not None and value not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return value

# Item Research Schemas
class ItemResearchResponse(BaseModel):
    id: UUID
    item_id: UUID
    brand: Optional[str] = None
    model: Optional[str] = None
    summary: Optional[str] = None
    specs: Dict[str, Any] = {}
    image_url: Optional[str] = None
    confidence: Optional[float] = None
    researched_at: datetime

    class Config:
        from_attributes = True

# Item Price Schemas
class ItemPriceResponse(BaseModel):
    id: UUID
    item_id: UUID
    source: str
    price: float
    currency: str
    url: Optional[str] = None
    in_stock: bool
    is_user_verified: bool = False
    captured_at: datetime

    class Config:
        from_attributes = True

class WishlistItemManualPriceCreate(BaseModel):
    price: float = Field(..., gt=0, description="Price must be greater than zero")
    url: Optional[str] = Field(None, description="Optional URL to retailer store")
    source: str = "manual"
    in_stock: bool = True

# Attachment Schemas
class ItemAttachmentResponse(BaseModel):
    id: UUID
    item_id: UUID
    storage_path: str
    created_at: datetime

    class Config:
        from_attributes = True

class ItemAttachmentCreate(BaseModel):
    storage_path: str

# Joined Response Schema
class WishlistItemResponse(WishlistItemBase):
    id: UUID
    user_id: UUID
    status: str
    done: bool
    created_at: datetime
    prices: Optional[List[ItemPriceResponse]] = None
    research: Optional[List[ItemResearchResponse]] = None

    class Config:
        from_attributes = True

# Wishlist Item with full details joined
class WishlistItemDetailResponse(WishlistItemResponse):
    research: Optional[List[ItemResearchResponse]] = None
    prices: Optional[List[ItemPriceResponse]] = None
    attachments: Optional[List[ItemAttachmentResponse]] = None

    class Config:
        from_attributes = True
