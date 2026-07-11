// TypeScript interfaces for DreamList data model

export type Tier = 'now' | 'soon' | 'dream';
export type ItemStatus = 'pending' | 'researching' | 'ready' | 'failed';
export type Category = string;

export const CATEGORIES: Category[] = ['Tech', 'Home', 'Apparel', 'Books', 'Fitness', 'Other'];
export const TIERS: Tier[] = ['now', 'soon', 'dream'];

export interface WishlistItem {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  tier: Tier;
  status: ItemStatus;
  done: boolean;
  manual_notes: string | null;
  manual_link: string | null;
  created_at: string;
  prices?: ItemPrice[] | null;
  research?: ItemResearch[] | null;
}

export interface ItemResearch {
  id: string;
  item_id: string;
  brand: string | null;
  model: string | null;
  summary: string | null;
  specs: Record<string, unknown>;
  image_url: string | null;
  confidence: number | null;
  researched_at: string;
}

export interface ItemPrice {
  id: string;
  item_id: string;
  source: 'amazon' | 'flipkart' | 'official' | 'other' | 'manual';
  price: number;
  currency: string;
  url: string | null;
  in_stock: boolean;
  is_user_verified?: boolean;
  captured_at: string;
}

export interface ItemAttachment {
  id: string;
  item_id: string;
  storage_path: string;
  created_at: string;
}

export interface WishlistItemDetail extends WishlistItem {
  research: ItemResearch[] | null;
  prices: ItemPrice[] | null;
  attachments: ItemAttachment[] | null;
}

export interface CreateItemPayload {
  name: string;
  category: Category;
  tier: Tier;
  manual_notes?: string;
  manual_link?: string;
}

export interface UpdateItemPayload {
  name?: string;
  category?: Category;
  tier?: Tier;
  done?: boolean;
  manual_notes?: string;
  manual_link?: string;
}
