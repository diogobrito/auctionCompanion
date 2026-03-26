alter table public.auction_cars
  add column if not exists inspection_checked boolean not null default false,
  add column if not exists engine_lights_checked boolean not null default false,
  add column if not exists notes_checked boolean not null default false;
