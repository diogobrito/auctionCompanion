alter table public.historical_sales
add column if not exists stock text;

create unique index if not exists historical_sales_stock_key
on public.historical_sales (stock);
