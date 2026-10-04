-- Explicitly reset table privileges. These V4 extensions must not inherit
-- broader authenticated grants from an existing/default privilege policy.

revoke all privileges on table public.installment_schedule_items from public;
revoke all privileges on table public.installment_schedule_items from anon;
revoke all privileges on table public.installment_schedule_items from authenticated;
grant select, insert, update, delete on table public.installment_schedule_items to authenticated;

revoke all privileges on table public.installment_settlement_events from public;
revoke all privileges on table public.installment_settlement_events from anon;
revoke all privileges on table public.installment_settlement_events from authenticated;
grant select, insert on table public.installment_settlement_events to authenticated;
