-- 1. Create public.users profile table linked to Supabase auth.users
create table public.users (
    id uuid references auth.users on delete cascade primary key,
    email text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to automatically insert a user profile when a new user signs up via auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.users (id, email)
    values (new.id, new.email);
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- 2. Create wishlist_items table
create table public.wishlist_items (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    name text not null,
    category text not null,
    tier text not null check (tier in ('now', 'soon', 'dream')),
    status text not null check (status in ('pending', 'researching', 'ready', 'failed')) default 'pending',
    done boolean default false not null,
    manual_notes text,
    manual_link text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create item_research table
create table public.item_research (
    id uuid default gen_random_uuid() primary key,
    item_id uuid references public.wishlist_items(id) on delete cascade not null,
    brand text,
    model text,
    summary text,
    specs jsonb default '{}'::jsonb not null,
    image_url text,
    confidence numeric(3, 2) check (confidence >= 0.00 and confidence <= 1.00),
    researched_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Create item_prices table
create table public.item_prices (
    id uuid default gen_random_uuid() primary key,
    item_id uuid references public.wishlist_items(id) on delete cascade not null,
    source text not null check (source in ('amazon', 'flipkart', 'official', 'other')),
    price numeric not null,
    currency text default 'INR' not null,
    url text,
    in_stock boolean default true not null,
    captured_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Enable Row Level Security (RLS) on all tables
alter table public.users enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.item_research enable row level security;
alter table public.item_prices enable row level security;

-- 6. Setup RLS Policies

-- Profile policies
create policy "Allow users to read their own profile" on public.users
    for select using (auth.uid() = id);

create policy "Allow users to update their own profile" on public.users
    for update using (auth.uid() = id);

-- Wishlist items policies
create policy "Allow users to manage their own wishlist items" on public.wishlist_items
    for all using (auth.uid() = user_id);

-- Item research policies (depends on item owner)
create policy "Allow users to manage research of their own items" on public.item_research
    for all using (
        exists (
            select 1 from public.wishlist_items
            where wishlist_items.id = item_research.item_id
            and wishlist_items.user_id = auth.uid()
        )
    );

-- Item prices policies (depends on item owner)
create policy "Allow users to manage prices of their own items" on public.item_prices
    for all using (
        exists (
            select 1 from public.wishlist_items
            where wishlist_items.id = item_prices.item_id
            and wishlist_items.user_id = auth.uid()
        )
    );
