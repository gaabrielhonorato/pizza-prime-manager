create unique index if not exists pizzarias_google_place_id_unique
  on public.pizzarias (google_place_id)
  where google_place_id is not null;
