-- Fictional October rotation for every human profile, including both test accounts.
-- Nova remains available as an AI teammate and is not assigned staff duty.
begin;
with roster as (
  select array_agg(id order by
    case id when 'ada' then 0 when 'mira' then 1 when 'ellis' then 2
      when 'noa' then 3 when 'theo' then 4 when 'remy' then 5 else 6 end,
    name, id) as ids
  from public.shiftline_profiles
  where kind = 'person'
)
insert into public.shiftline_shifts (id, member_id, starts_at, ends_at)
select
  'october-2026-' || i,
  ids[(i % cardinality(ids)) + 1],
  timestamptz '2026-10-01 07:00:00+00' + (i - 1) * interval '12 hours',
  timestamptz '2026-10-01 07:00:00+00' + i * interval '12 hours'
from generate_series(0, 62) as series(i)
cross join roster
where cardinality(ids) > 0
on conflict (id) do update set
  member_id = excluded.member_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at;

-- Only remove the original known fixture rows; preserve unrelated assignments.
delete from public.shiftline_shifts
where id in ('shift-0','shift-1','shift-2','shift-3','shift-4','shift-5','shift-6','shift-7','shift-8','shift-9','shift-10','shift-11','shift-12','shift-13')
  and member_id in ('mira', 'ada')
  and starts_at >= timestamptz '2026-09-28 07:00:00+00'
  and starts_at < timestamptz '2026-10-05 07:00:00+00';
commit;
