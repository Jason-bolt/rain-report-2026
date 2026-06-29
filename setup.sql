create table reports (
  id uuid primary key default gen_random_uuid(),
  description text,
  media_url text,
  media_type text,
  lat float,
  lng float,
  location_name text,
  severity text default 'unspecified',
  status text default 'new',
  created_at timestamp with time zone default now()
);

alter table reports enable row level security;

create policy "Anyone can read reports"
on reports for select using (true);

create policy "Anyone can insert reports"
on reports for insert with check (true);

-- Storage bucket for media (run this part in SQL editor too)
insert into storage.buckets (id, name, public) values ('report-media', 'report-media', true);

create policy "Public can upload media"
on storage.objects for insert
with check (bucket_id = 'report-media');

create policy "Public can view media"
on storage.objects for select
using (bucket_id = 'report-media');
