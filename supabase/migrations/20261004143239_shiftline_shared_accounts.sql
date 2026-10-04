-- Additive app schema. Mutations are atomic, validated, and participant-authorized.
create schema if not exists shiftline_private;
revoke all on schema shiftline_private from public, anon;
grant usage on schema shiftline_private to authenticated;
create table public.shiftline_profiles (
  id text primary key,
  user_id uuid unique references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  role text not null default 'Team member',
  specialty text not null default 'Care coordination',
  initials text not null default 'TM',
  color text not null default '#DCEDE7',
  kind text not null default 'person' check (kind in ('person','ai')),
  presence text not null default 'available' check (presence in ('available','busy','in-call','offline'))
);
create table public.shiftline_shifts (
  id text primary key,
  member_id text not null references public.shiftline_profiles(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at)
);
create index shiftline_shifts_member on public.shiftline_shifts(member_id);
create table public.shiftline_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_id text not null references public.shiftline_profiles(id),
  request_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, request_id)
);
create index shiftline_conversations_recipient on public.shiftline_conversations(recipient_id, updated_at desc);
create index shiftline_conversations_owner on public.shiftline_conversations(owner_id, updated_at desc);
alter table public.shiftline_profiles enable row level security;
alter table public.shiftline_shifts enable row level security;
alter table public.shiftline_conversations enable row level security;
revoke all on public.shiftline_profiles, public.shiftline_shifts, public.shiftline_conversations from anon, authenticated;
grant select on public.shiftline_profiles, public.shiftline_shifts, public.shiftline_conversations to authenticated;
create policy roster_authenticated on public.shiftline_profiles for select to authenticated using (true);
create policy coverage_authenticated on public.shiftline_shifts for select to authenticated using (true);
create policy conversations_participants on public.shiftline_conversations for select to authenticated
using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid())::text);

create function shiftline_private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.shiftline_profiles(id,user_id,name,initials)
  values(new.id::text,new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Teammate'),100),upper(left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'TM'),2)));
  return new;
end; $$;
revoke all on function shiftline_private.create_profile() from public, anon, authenticated;
create trigger shiftline_profile_on_signup after insert on auth.users for each row execute function shiftline_private.create_profile();

-- No client can overwrite a complete thread or impersonate another registered user.
create function shiftline_private.mutate(op text, cid uuid, value jsonb, request_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c public.shiftline_conversations;
  p public.shiftline_profiles;
  at text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  eid text := gen_random_uuid()::text;
  entry jsonb;
  entries jsonb;
  events jsonb;
  status text;
  actor text;
  last_out text;
begin
  if uid is null then raise exception 'Sign in to continue.'; end if;
  if op = 'send' then
    if coalesce(length(request_key),0) not between 1 and 200 then raise exception 'Invalid request key.'; end if;
    select * into p from public.shiftline_profiles where id = value->>'recipientId';
    if not found or p.id = uid::text then raise exception 'Choose another teammate.'; end if;
    if coalesce(length(trim(value->>'subject')),0) not between 1 and 100
      or coalesce(length(trim(value->>'body')),0) not between 1 and 2000
      or coalesce(value->>'priority','') not in ('Routine','Urgent') then raise exception 'Check the message fields.'; end if;
    entry := jsonb_build_object('id',eid,'kind','text','senderId',uid::text,'text',trim(value->>'body'),'at',at,'status','Sent');
    insert into public.shiftline_conversations(owner_id,recipient_id,request_id,payload)
    values(uid,p.id,request_key,jsonb_build_object('subject',trim(value->>'subject'),'body',trim(value->>'body'),'priority',value->>'priority','status','Sent','chat',jsonb_build_array(entry),'events',jsonb_build_array(jsonb_build_object('id',eid,'type','Sent','at',at,'text','Message sent.'))))
    on conflict(owner_id,request_id) do nothing returning * into c;
    if c.id is null then select * into c from public.shiftline_conversations where owner_id=uid and request_id=request_key; end if;
    return c.id;
  end if;
  select * into c from public.shiftline_conversations where id=cid for update;
  if not found or not (c.owner_id=uid or c.recipient_id=uid::text) then raise exception 'Conversation unavailable.'; end if;
  select * into p from public.shiftline_profiles where id=c.recipient_id;
  entries := c.payload->'chat'; events := c.payload->'events';
  if op in ('post','receive') then
    if coalesce(length(request_key),0) not between 1 and 200 then raise exception 'Invalid request key.'; end if;
    if exists(select 1 from jsonb_array_elements(entries) e where e->>'requestKey'=uid::text||':'||request_key) then return cid; end if;
    actor := uid::text;
    if op='receive' then
      if c.owner_id<>uid or p.user_id is not null or p.kind<>'ai' then raise exception 'Only Nova replies use this action.'; end if;
      select e->>'id' into last_out from jsonb_array_elements(entries) with ordinality a(e,n) where e->>'senderId'=uid::text and e->>'kind'<>'call' order by n desc limit 1;
      if last_out is distinct from value->>'replyTo' then raise exception 'A newer message is waiting for a reply.'; end if;
      actor := p.id;
    end if;
    if value->>'kind' in ('text','image') then
      if (value->>'kind'='text' and coalesce(length(trim(value->>'text')),0)=0)
        or coalesce(length(value->>'text'),0)>(case when op='receive' then 4000 else 2000 end)
        or (value->>'kind'='image' and coalesce(value->>'attachmentId','') not in ('handoff-board','team-map')) then raise exception 'Invalid message.'; end if;
      entry := jsonb_build_object('kind',value->>'kind','text',trim(coalesce(value->>'text','')));
      if value->>'kind'='image' then entry := entry||jsonb_build_object('attachmentId',value->>'attachmentId'); end if;
    elsif value->>'kind'='call' then
      if op='receive' or coalesce(value->>'mode','') not in ('voice','video') or coalesce(value->>'outcome','') not in ('completed','cancelled') or (value->>'duration')::numeric not between 0 and 86400 then raise exception 'Invalid call.'; end if;
      entry := jsonb_build_object('kind','call','mode',value->>'mode','outcome',value->>'outcome','duration',(value->>'duration')::numeric);
    else raise exception 'Invalid message kind.'; end if;
    status := case when actor=c.owner_id::text then 'Sent' else 'Replied' end;
    entry := entry||jsonb_build_object('id',eid,'senderId',actor,'at',at,'status','Sent','requestKey',uid::text||':'||request_key);
    if op='receive' then
      select coalesce(jsonb_agg(case when e->>'senderId'=uid::text then e||'{"status":"Read"}'::jsonb else e end order by n),'[]') into entries from jsonb_array_elements(entries) with ordinality a(e,n);
    end if;
    entries := entries||jsonb_build_array(entry);
    if entry->>'kind'<>'call' then events := events||jsonb_build_array(jsonb_build_object('id',eid,'type',status,'at',at,'text',case when status='Sent' then 'Message sent.' else entry->>'text' end)); end if;
  elsif op='read' then
    if not exists(select 1 from jsonb_array_elements(entries) e where e->>'senderId'<>uid::text and e->>'kind'<>'call' and e->>'status'='Sent') then return cid; end if;
    select jsonb_agg(case when e->>'senderId'<>uid::text and e->>'kind'<>'call' then e||'{"status":"Read"}'::jsonb else e end order by n) into entries from jsonb_array_elements(entries) with ordinality a(e,n);
    status := case when c.payload->>'status'='Sent' then 'Read' else c.payload->>'status' end;
    events := events||jsonb_build_array(jsonb_build_object('id',eid,'type','Read','at',at,'text','Message read.'));
  elsif op='reply' then
    if p.user_id is not null or p.kind='ai' or c.owner_id<>uid then raise exception 'This teammate replies from their own account.'; end if;
    if c.payload->>'status'='Replied' then return cid; end if;
    status := 'Replied';
    entry := jsonb_build_object('id',eid,'kind','text','senderId',p.id,'at',at,'text','Thanks for the update. I’ll take a look before our team huddle.');
    select jsonb_agg(case when e->>'senderId'=uid::text then e||'{"status":"Read"}'::jsonb else e end order by n) into entries from jsonb_array_elements(entries) with ordinality a(e,n);
    entries := entries||jsonb_build_array(entry);
    events := events||jsonb_build_array(jsonb_build_object('id',eid,'type','Replied','at',at,'text',entry->>'text'));
  elsif op='escalate' then
    if c.payload->>'priority'<>'Urgent' or c.payload->>'status' in ('Replied','Escalated') then return cid; end if;
    status := 'Escalated';
    events := events||jsonb_build_array(jsonb_build_object('id',eid,'type','Escalated','at',at,'text','Escalation recorded for the backup team.'));
  else raise exception 'Invalid operation.'; end if;
  update public.shiftline_conversations set payload=c.payload||jsonb_build_object('chat',entries,'events',events,'status',coalesce(status,c.payload->>'status')),updated_at=clock_timestamp() where id=cid;
  return cid;
end; $$;
revoke all on function shiftline_private.mutate(text,uuid,jsonb,text) from public,anon;
grant execute on function shiftline_private.mutate(text,uuid,jsonb,text) to authenticated;
create function public.shiftline_mutate(op text, cid uuid default null, value jsonb default '{}', request_key text default '') returns uuid
language sql security invoker set search_path = '' as $$ select shiftline_private.mutate(op,cid,value,request_key); $$;
revoke all on function public.shiftline_mutate(text,uuid,jsonb,text) from public,anon;
grant execute on function public.shiftline_mutate(text,uuid,jsonb,text) to authenticated;
alter publication supabase_realtime add table public.shiftline_conversations, public.shiftline_profiles;
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('nova','Nova','AI teammate','Team coordination','AI','#DCEDE7','ai','available');
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('mira','Mira Vale','On-call physician','Internal medicine','MV','#DCEDE7','person','in-call');
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('ellis','Ellis Rowan','Charge nurse','Care coordination','ER','#E8E1F0','person','available');
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('noa','Noa Linden','Consulting physician','Cardiology','NL','#F6E7CE','person','busy');
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('theo','Theo Wren','Clinical pharmacist','Pharmacy','TW','#DCE9F2','person','available');
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('ada','Ada Solis','On-call physician','Internal medicine','AS','#F0DEDB','person','offline');
insert into public.shiftline_profiles(id,name,role,specialty,initials,color,kind,presence) values('remy','Remy Fern','Nurse educator','Team education','RF','#E5EBCF','person','available');
insert into public.shiftline_shifts(id,member_id,starts_at,ends_at) select 'shift-'||i, case when i%2=1 then 'ada' else 'mira' end, '2026-09-28T07:00:00Z'::timestamptz+i*interval '12 hours', '2026-09-28T07:00:00Z'::timestamptz+(i+1)*interval '12 hours' from generate_series(0,13) i;
