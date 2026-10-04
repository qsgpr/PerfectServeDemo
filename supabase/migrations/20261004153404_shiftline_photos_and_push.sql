insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('shiftline-photos','shiftline-photos',false,8388608,array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif']);
create policy shiftline_photo_read on storage.objects for select to authenticated using (
 bucket_id='shiftline-photos' and exists(select 1 from public.shiftline_conversations c
 where c.id::text=split_part(name,'/',1) and (c.owner_id=(select auth.uid()) or c.recipient_id=(select auth.uid())::text))
);
create policy shiftline_photo_upload on storage.objects for insert to authenticated with check (
 bucket_id='shiftline-photos' and split_part(name,'/',2)=(select auth.uid())::text
 and exists(select 1 from public.shiftline_conversations c where c.id::text=split_part(name,'/',1)
 and (c.owner_id=(select auth.uid()) or c.recipient_id=(select auth.uid())::text))
);
create policy shiftline_photo_remove on storage.objects for delete to authenticated using (
 bucket_id='shiftline-photos' and split_part(name,'/',2)=(select auth.uid())::text
);
create table public.shiftline_push_devices (
 token text primary key check (token ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$' and length(token)<256),
 user_id uuid not null references auth.users(id) on delete cascade,
 updated_at timestamptz not null default now()
);
create index shiftline_push_devices_user on public.shiftline_push_devices(user_id);
alter table public.shiftline_push_devices enable row level security;
revoke all on public.shiftline_push_devices from anon,authenticated;
grant select,insert,update,delete on public.shiftline_push_devices to authenticated;
create policy push_device_select on public.shiftline_push_devices for select to authenticated using(user_id=(select auth.uid()));
create policy push_device_insert on public.shiftline_push_devices for insert to authenticated with check(user_id=(select auth.uid()));
create policy push_device_update on public.shiftline_push_devices for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy push_device_delete on public.shiftline_push_devices for delete to authenticated using(user_id=(select auth.uid()));
create table shiftline_private.push_dispatches (
 conversation_id uuid not null references public.shiftline_conversations(id) on delete cascade,
 entry_id text not null,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 request_id bigint,
 queued_at timestamptz not null default now(),
 primary key(conversation_id,entry_id,recipient_id)
);
revoke all on shiftline_private.push_dispatches from public,anon,authenticated;
create extension if not exists pg_net with schema extensions;
create function shiftline_private.queue_message_push() returns trigger language plpgsql security definer set search_path='' as $$
declare e jsonb; receiver uuid; requests jsonb; dispatch_id bigint;
begin
 e:=new.payload->'chat'->-1;
 if e is null or e->>'kind'='call' then return new; end if;
 if TG_OP='UPDATE' and e->>'id'=old.payload->'chat'->-1->>'id' then return new; end if;
 if e->>'senderId'=new.owner_id::text then
   select p.user_id into receiver from public.shiftline_profiles p where p.id=new.recipient_id;
 else receiver:=new.owner_id;
 end if;
 if receiver is null then return new; end if;
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
create trigger shiftline_push_new_entry after insert or update on public.shiftline_conversations for each row execute function shiftline_private.queue_message_push();

create or replace function shiftline_private.mutate(op text, cid uuid, value jsonb, request_key text) returns uuid
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
        or (value->>'kind'='image' and coalesce(value->>'attachmentId','') not in ('handoff-board','team-map','device-photo')) then raise exception 'Invalid message.'; end if;
      entry := jsonb_build_object('kind',value->>'kind','text',trim(coalesce(value->>'text','')));
      if value->>'kind'='image' then
        entry := entry||jsonb_build_object('attachmentId',value->>'attachmentId');
        if value->>'attachmentId'='device-photo' then
          if op='receive' or split_part(coalesce(value->>'imagePath',''), '/', 1)<>cid::text or split_part(coalesce(value->>'imagePath',''), '/', 2)<>uid::text
          or not exists(select 1 from storage.objects where bucket_id='shiftline-photos' and name=value->>'imagePath') then raise exception 'Upload a photo for this conversation first.'; end if;
          entry:=entry||jsonb_build_object('imagePath',value->>'imagePath');
        end if;
      end if;
    elsif value->>'kind'='call' then
      if op='receive' or coalesce(value->>'mode','') not in ('voice','video') or coalesce(value->>'outcome','') not in ('completed','cancelled') or coalesce((value->>'duration')::numeric,-1) not between 0 and 86400 then raise exception 'Invalid call.'; end if;
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
    if not exists(select 1 from jsonb_array_elements(entries) e where (e->>'senderId'<>uid::text or p.user_id is null) and e->>'kind'<>'call' and e->>'status'='Sent') then return cid; end if;
    select jsonb_agg(case when (e->>'senderId'<>uid::text or p.user_id is null) and e->>'kind'<>'call' then e||'{"status":"Read"}'::jsonb else e end order by n) into entries from jsonb_array_elements(entries) with ordinality a(e,n);
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
