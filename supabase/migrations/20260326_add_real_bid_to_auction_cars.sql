alter table public.auction_cars
  add column if not exists real_bid numeric;
