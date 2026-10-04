-- Rebuild fictional October department coverage after adding staff profiles.
with rosters as (
 select department,array_agg(id order by id) ids from public.shiftline_profiles where kind='person' group by department
)
insert into public.shiftline_shifts(id,member_id,department,starts_at,ends_at)
select r.department||'-october-2026-'||i,ids[(i%cardinality(ids))+1],r.department,
 timestamptz '2026-10-01 07:00:00+00'+(i-1)*interval '12 hours',
 timestamptz '2026-10-01 07:00:00+00'+i*interval '12 hours'
from rosters r cross join generate_series(0,62) s(i)
on conflict(id) do update set member_id=excluded.member_id,department=excluded.department,starts_at=excluded.starts_at,ends_at=excluded.ends_at;
