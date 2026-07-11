import { supabase } from './supabase';
import type {
  WishlistItem,
  WishlistItemDetail,
  CreateItemPayload,
  UpdateItemPayload,
  Tier,
  Category,
  ItemPrice,
  ItemAttachment,
} from './types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    let detail = `Request failed (${response.status})`;
    try {
      const json = JSON.parse(body);
      detail = json.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  // 204 No Content
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function fetchItems(filters?: {
  tier?: Tier;
  category?: Category;
}): Promise<WishlistItem[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters?.tier) params.set('tier', filters.tier);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  const url = `${API_URL}/items/${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers });
  return handleResponse<WishlistItem[]>(res);
}

export async function fetchItem(id: string): Promise<WishlistItemDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${id}`, { headers });
  return handleResponse<WishlistItemDetail>(res);
}

export async function createItem(
  payload: CreateItemPayload
): Promise<WishlistItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return handleResponse<WishlistItem>(res);
}

export async function updateItem(
  id: string,
  payload: UpdateItemPayload
): Promise<WishlistItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });
  return handleResponse<WishlistItem>(res);
}

export async function deleteItem(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${id}`, {
    method: 'DELETE',
    headers,
  });
  return handleResponse<void>(res);
}

export async function triggerResearch(id: string): Promise<WishlistItem> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${id}/research`, {
    method: 'POST',
    headers,
  });
  return handleResponse<WishlistItem>(res);
}

export async function addManualPrice(
  itemId: string,
  price: number,
  url?: string
): Promise<ItemPrice> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${itemId}/prices`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ price, url, source: 'manual', in_stock: true }),
  });
  return handleResponse<ItemPrice>(res);
}

export async function addAttachmentRecord(
  itemId: string,
  storagePath: string
): Promise<ItemAttachment> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${itemId}/attachments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ storage_path: storagePath }),
  });
  return handleResponse<ItemAttachment>(res);
}

export async function deleteAttachmentRecord(
  itemId: string,
  attachmentId: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/items/${itemId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers,
  });
  return handleResponse<void>(res);
}

export async function uploadAttachment(
  itemId: string,
  localUri: string,
  fileName: string
): Promise<ItemAttachment> {
  // 1. Upload file binary directly to Supabase storage bucket
  const timestamp = Date.now();
  const cleanedName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
  const storagePath = `${itemId}/${timestamp}_${cleanedName}`;
  
  const response = await fetch(localUri);
  const blob = await response.blob();
  
  const { data, error } = await supabase.storage
    .from('item-attachments')
    .upload(storagePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true
    });
    
  if (error) {
    throw new Error(`Storage upload error: ${error.message}`);
  }
  
  // 2. Register attachment record in backend DB
  return addAttachmentRecord(itemId, data.path);
}
