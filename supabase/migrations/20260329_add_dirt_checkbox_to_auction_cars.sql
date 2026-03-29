alter table public.auction_cars
  add column if not exists dirt_checked boolean not null default false;
