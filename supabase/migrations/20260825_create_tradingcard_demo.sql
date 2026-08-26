create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Nuevo coleccionista',
  community text,
  province text,
  locality text,
  avatar_url text,
  completed_trades integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null,
  game text not null default 'magic' check (game in ('magic', 'pokemon', 'star_wars_unlimited', 'lorcana')),
  name text not null,
  set_name text,
  rarity text,
  image_url text,
  estimated_value numeric,
  available boolean not null default true,
  listed_for_trade boolean not null default false,
  card_status text not null default 'coleccion' check (card_status in ('en_mazo', 'trade', 'coleccion')),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game, card_id)
);

create table if not exists public.wanted_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null,
  name text not null,
  priority smallint not null default 2 check (priority between 1 and 3),
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  parent_offer_id uuid references public.trade_offers(id) on delete set null,
  sender_cards jsonb not null default '[]'::jsonb,
  recipient_cards jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'countered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create table if not exists public.trade_messages (
  id uuid primary key default gen_random_uuid(),
  trade_offer_id uuid not null references public.trade_offers(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.collection_cards enable row level security;
alter table public.wanted_cards enable row level security;
alter table public.trade_offers enable row level security;
alter table public.trade_messages enable row level security;

alter table public.collection_cards
  add column if not exists card_status text not null default 'coleccion'
  check (card_status in ('en_mazo', 'trade', 'coleccion'));

alter table public.collection_cards
  add column if not exists game text not null default 'magic'
  check (game in ('magic', 'pokemon', 'star_wars_unlimited', 'lorcana'));

alter table public.collection_cards
  drop constraint if exists collection_cards_game_check;

alter table public.collection_cards
  add constraint collection_cards_game_check
  check (game in ('magic', 'pokemon', 'star_wars_unlimited', 'lorcana'));

alter table public.collection_cards
  drop constraint if exists collection_cards_user_id_card_id_key;

alter table public.collection_cards
  add constraint collection_cards_user_id_game_card_id_key unique (user_id, game, card_id);

create policy "Profiles are visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users manage their profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Owners can read their collection" on public.collection_cards for select to authenticated using (auth.uid() = user_id or listed_for_trade);
create policy "Owners manage their collection" on public.collection_cards for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners manage their wanted cards" on public.wanted_cards for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Participants can read trade offers" on public.trade_offers for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Users send trade offers" on public.trade_offers for insert to authenticated with check (auth.uid() = sender_id);
create policy "Participants update trade offers" on public.trade_offers for update to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id) with check (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Trade participants read messages" on public.trade_messages for select to authenticated using (
  exists (
    select 1 from public.trade_offers
    where trade_offers.id = trade_messages.trade_offer_id
      and trade_offers.status = 'accepted'
      and (trade_offers.sender_id = auth.uid() or trade_offers.recipient_id = auth.uid())
  )
);

create policy "Trade participants send messages" on public.trade_messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.trade_offers
    where trade_offers.id = trade_messages.trade_offer_id
      and trade_offers.status = 'accepted'
      and (trade_offers.sender_id = auth.uid() or trade_offers.recipient_id = auth.uid())
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, community, province, locality)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'community',
    new.raw_user_meta_data ->> 'province',
    new.raw_user_meta_data ->> 'locality'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are public" on storage.objects;
drop policy if exists "Users upload their own avatar" on storage.objects;

create policy "Avatar images are public"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Users upload their own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);