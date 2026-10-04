alter table public.shiftline_profiles add column department text not null default 'coordination'
  check (department in ('medicine','nursing','pharmacy','cardiology','coordination','assistant'));
update public.shiftline_profiles set department=case when kind='ai' then 'assistant' when specialty='Internal medicine' then 'medicine' when specialty='Cardiology' then 'cardiology' when specialty='Pharmacy' then 'pharmacy' when role ilike '%nurse%' then 'nursing' else 'coordination' end;
alter table public.shiftline_shifts add column department text
  check (department in ('medicine','nursing','pharmacy','cardiology','coordination'));
create index shiftline_department_coverage on public.shiftline_shifts(department,starts_at,ends_at);
create table public.shiftline_reachability (
 profile_id text primary key references public.shiftline_profiles(id) on delete cascade,
 availability text not null default 'available' check(availability in ('available','busy','offline')),
 alerts text not null default 'all' check(alerts in ('all','urgent','none')),
 quiet_start integer, quiet_end integer,
 backup_id text references public.shiftline_profiles(id) on delete set null,
 check((quiet_start is null and quiet_end is null) or (quiet_start is not null and quiet_end is not null and quiet_start between 0 and 1439 and quiet_end between 0 and 1439 and quiet_start<>quiet_end)),
 check(backup_id is distinct from profile_id)
);
create index shiftline_reachability_backup on public.shiftline_reachability(backup_id);
create table public.shiftline_handoffs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 recipient_id text not null references public.shiftline_profiles(id) on delete cascade,
 recipient_user_id uuid not null references auth.users(id) on delete cascade,
 department text not null check(department in ('medicine','nursing','pharmacy','cardiology','coordination')),
 request_id text not null check(length(request_id) between 1 and 200),
 note text not null check(length(trim(note)) between 1 and 4000),
 items jsonb not null default '[]' check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=20),
 status text not null default 'Pending' check(status in ('Pending','Accepted','Cancelled')),
 created_at timestamptz not null default now(),
 accepted_at timestamptz, accepted_by uuid references auth.users(id) on delete set null,
 unique(owner_id,request_id), check(owner_id<>recipient_user_id),
 check((status='Accepted')=(accepted_at is not null))
);
create index shiftline_handoffs_incoming on public.shiftline_handoffs(recipient_user_id,created_at desc);
create index shiftline_handoffs_recipient on public.shiftline_handoffs(recipient_id);
create index shiftline_handoffs_accepted_by on public.shiftline_handoffs(accepted_by);
alter table public.shiftline_reachability enable row level security;
alter table public.shiftline_handoffs enable row level security;
revoke all on public.shiftline_reachability,public.shiftline_handoffs from public,anon,authenticated;
grant select on public.shiftline_reachability,public.shiftline_handoffs to authenticated;
create policy reachability_roster on public.shiftline_reachability for select to authenticated using(true);
create policy handoffs_participants on public.shiftline_handoffs for select to authenticated
 using(owner_id=(select auth.uid()) or recipient_user_id=(select auth.uid()));

create function shiftline_private.in_quiet(start_min integer,end_min integer,at_time timestamptz) returns boolean
language sql immutable set search_path='' as $$
 select case when start_min is null or end_min is null then false
 when start_min<end_min then m>=start_min and m<end_min else m>=start_min or m<end_min end
 from (select (extract(hour from at_time at time zone 'UTC')*60+extract(minute from at_time at time zone 'UTC'))::int as m) t;
$$;
revoke all on function shiftline_private.in_quiet(integer,integer,timestamptz) from public,anon,authenticated;
create function shiftline_private.reachable(pid text,priority text,at_time timestamptz) returns boolean
language sql stable set search_path='' as $$
 select coalesce((select availability<>'offline' and (priority='Urgent' or (availability='available' and not shiftline_private.in_quiet(quiet_start,quiet_end,at_time))) from public.shiftline_reachability where profile_id=pid),true);
$$;
revoke all on function shiftline_private.reachable(text,text,timestamptz) from public,anon,authenticated;

create function shiftline_private.workflow(op text,value jsonb,request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); dept text:=value->>'department'; pid text; backup text; primary_id text; reason text;
 h public.shiftline_handoffs; p public.shiftline_profiles; c public.shiftline_conversations;
 target uuid; item_id text; items jsonb:='[]'; qs integer; qe integer;
begin
 if uid is null then raise exception 'Sign in to continue.'; end if;
 if op='settings' then
   select * into p from public.shiftline_profiles where user_id=uid;
   if not found then raise exception 'Profile unavailable.'; end if;
   if coalesce(value->>'availability','') not in ('available','busy','offline') or coalesce(value->>'alerts','') not in ('all','urgent','none') then raise exception 'Choose valid reachability settings.'; end if;
   qs:=(value->>'quietStart')::integer; qe:=(value->>'quietEnd')::integer;
   if (qs is null)<>(qe is null) or qs not between 0 and 1439 or qe not between 0 and 1439 or qs=qe then raise exception 'Enter different quiet-hour start and end times.'; end if;
   backup:=nullif(value->>'backupId','');
   if backup is not null and not exists(select 1 from public.shiftline_profiles b where b.id=backup and b.kind='person' and b.id<>p.id and b.department=p.department) then raise exception 'Choose another teammate in your department as backup.'; end if;
   insert into public.shiftline_reachability(profile_id,availability,alerts,quiet_start,quiet_end,backup_id)
   values(p.id,value->>'availability',value->>'alerts',qs,qe,backup)
   on conflict(profile_id) do update set availability=excluded.availability,alerts=excluded.alerts,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,backup_id=excluded.backup_id;
   return uid;
 elsif op in ('route','share') then
   if coalesce(length(request_key),0) not between 1 and 200 then raise exception 'Invalid request key.'; end if;
   if coalesce(dept,'') not in ('medicine','nursing','pharmacy','cardiology','coordination') then raise exception 'Choose a department.'; end if;
   if op='route' then
     select id into target from public.shiftline_conversations where owner_id=uid and request_id=request_key;
     if found then return target; end if;
     if coalesce(value->>'priority','') not in ('Routine','Urgent') then raise exception 'Choose a priority.'; end if;
     select member_id into pid from public.shiftline_shifts where department=dept and starts_at<=now() and now()<ends_at order by starts_at,id limit 1;
     if pid is null then raise exception 'No on-call coverage for this department.'; end if;
     primary_id:=pid; reason:='On-call coverage';
     if pid=uid::text or not shiftline_private.reachable(pid,value->>'priority',now()) then
       select backup_id into backup from public.shiftline_reachability where profile_id=pid;
       if backup is null then select member_id into backup from public.shiftline_shifts where department=dept and starts_at>now() order by starts_at,id limit 1; end if;
       if backup is null or backup in (pid,uid::text) or not exists(select 1 from public.shiftline_profiles where id=backup and department=dept and kind='person') or not shiftline_private.reachable(backup,value->>'priority',now()) then raise exception 'The on-call teammate and backup are unavailable. Choose a person directly.'; end if;
       reason:=case when pid=uid::text then 'Backup coverage · you are on call' else 'Backup coverage · on-call teammate unavailable' end; pid:=backup;
     end if;
     target:=shiftline_private.mutate('send',null,value||jsonb_build_object('recipientId',pid),request_key);
     update public.shiftline_conversations set payload=payload||jsonb_build_object('routing',jsonb_build_object('department',dept,'reason',reason,'recipientId',pid,'at',now())) where id=target;
     return target;
   end if;
   select * into h from public.shiftline_handoffs where owner_id=uid and request_id=request_key;
   if found then return h.id; end if;
   select * into p from public.shiftline_profiles where id=value->>'recipientId' and kind='person' and department=dept;
   if not found or p.user_id is null or p.user_id=uid then raise exception 'Choose another registered teammate in this department.'; end if;
   if coalesce(length(trim(value->>'note')),0) not between 1 and 4000 then raise exception 'Write a handoff note of at most 4,000 characters.'; end if;
   if jsonb_typeof(value->'conversationIds') is distinct from 'array' or jsonb_array_length(value->'conversationIds')>20 then raise exception 'Select at most 20 conversations.'; end if;
   if (select count(*)<>count(distinct x) from jsonb_array_elements_text(value->'conversationIds') x) then raise exception 'Select different conversations.'; end if;
   for item_id in select jsonb_array_elements_text(value->'conversationIds') loop
     select * into c from public.shiftline_conversations where id=item_id::uuid and (owner_id=uid or recipient_id=uid::text);
     if not found then raise exception 'A selected conversation is unavailable.'; end if;
     items:=items||jsonb_build_array(jsonb_build_object('id',c.id,'subject',c.payload->>'subject','priority',c.payload->>'priority','status',c.payload->>'status','preview',left(coalesce(c.payload->'chat'->-1->>'text',c.payload->>'body',''),500)));
   end loop;
   insert into public.shiftline_handoffs(owner_id,recipient_id,recipient_user_id,department,request_id,note,items)
   values(uid,p.id,p.user_id,dept,request_key,trim(value->>'note'),items)
   on conflict(owner_id,request_id) do nothing returning id into target;
   if target is null then select id into target from public.shiftline_handoffs where owner_id=uid and request_id=request_key; end if;
   return target;
 elsif op in ('accept','cancel') then
   select * into h from public.shiftline_handoffs where id=(value->>'id')::uuid for update;
   if not found or not(uid in (h.owner_id,h.recipient_user_id)) then raise exception 'Handoff unavailable.'; end if;
   if op='accept' then
     if uid<>h.recipient_user_id then raise exception 'Only the incoming teammate can accept this handoff.'; end if;
     if h.status='Cancelled' then raise exception 'This handoff was cancelled.'; end if;
     if h.status='Pending' then update public.shiftline_handoffs set status='Accepted',accepted_at=clock_timestamp(),accepted_by=uid where id=h.id; end if;
   else
     if uid<>h.owner_id then raise exception 'Only the sender can cancel this handoff.'; end if;
     if h.status='Accepted' then raise exception 'An accepted handoff cannot be cancelled.'; end if;
     update public.shiftline_handoffs set status='Cancelled' where id=h.id;
   end if;
   return h.id;
 end if;
 raise exception 'Invalid workflow action.';
end; $$;
revoke all on function shiftline_private.workflow(text,jsonb,text) from public,anon;
grant execute on function shiftline_private.workflow(text,jsonb,text) to authenticated;
create function public.shiftline_workflow(op text,value jsonb default '{}',request_key text default '') returns uuid
language sql security invoker set search_path='' as $$ select shiftline_private.workflow(op,value,request_key); $$;
revoke all on function public.shiftline_workflow(text,jsonb,text) from public,anon;
grant execute on function public.shiftline_workflow(text,jsonb,text) to authenticated;
alter publication supabase_realtime add table public.shiftline_reachability,public.shiftline_handoffs;

-- One fictional rotating on-call assignment per department for the October presentation.
with rosters as (
 select department,array_agg(id order by id) ids from public.shiftline_profiles where kind='person' group by department
)
insert into public.shiftline_shifts(id,member_id,department,starts_at,ends_at)
select r.department||'-october-2026-'||i,ids[(i%cardinality(ids))+1],r.department,
 timestamptz '2026-10-01 07:00:00+00'+(i-1)*interval '12 hours',
 timestamptz '2026-10-01 07:00:00+00'+i*interval '12 hours'
from rosters r cross join generate_series(0,62) s(i);

-- Foreground and background alerts follow the same saved preference.
create or replace function shiftline_private.queue_message_push() returns trigger language plpgsql security definer set search_path='' as $$
declare e jsonb; receiver uuid; requests jsonb; dispatch_id bigint; prefs public.shiftline_reachability;
begin
 e:=new.payload->'chat'->-1;
 if e is null or e->>'kind'='call' then return new; end if;
 if TG_OP='UPDATE' and e->>'id'=old.payload->'chat'->-1->>'id' then return new; end if;
 if e->>'senderId'=new.owner_id::text then
   select p.user_id into receiver from public.shiftline_profiles p where p.id=new.recipient_id;
 else receiver:=new.owner_id;
 end if;
 if receiver is null then return new; end if;
 select * into prefs from public.shiftline_reachability where profile_id=receiver::text;
 if found and (prefs.alerts='none' or (new.payload->>'priority'<>'Urgent' and (prefs.alerts='urgent' or shiftline_private.in_quiet(prefs.quiet_start,prefs.quiet_end,now())))) then return new; end if;
 select jsonb_agg(jsonb_build_object('to',token,'title','Shiftline','body','You have a new message.','sound','default','channelId','messages','data',jsonb_build_object('messageId',new.id))) into requests
 from (select token from public.shiftline_push_devices where user_id=receiver order by updated_at desc limit 100) t;
 if requests is null then return new; end if;
 insert into shiftline_private.push_dispatches(conversation_id,entry_id,recipient_id) values(new.id,e->>'id',receiver) on conflict do nothing;
 if not found then return new; end if;
 dispatch_id:=net.http_post(url:='https://exp.host/--/api/v2/push/send',headers:='{"Content-Type":"application/json"}'::jsonb,body:=requests);
 update shiftline_private.push_dispatches set request_id=dispatch_id where conversation_id=new.id and entry_id=e->>'id' and recipient_id=receiver;
 return new;
exception when others then
 raise warning 'Notification dispatch failed for conversation %',new.id;
 return new;
end; $$;
revoke all on function shiftline_private.queue_message_push() from public,anon,authenticated;
