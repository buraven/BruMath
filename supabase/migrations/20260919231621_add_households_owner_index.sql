-- Advisor recommendation. Existing indexes remain intact while the database is new.
create index if not exists households_owner_id_idx on public.households(owner_id);
