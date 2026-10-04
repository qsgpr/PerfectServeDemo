-- Run in a disposable database or transaction; all test records roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001','first@example.test','{"name":"First Teammate"}'),
('00000000-0000-4000-8000-000000000002','second@example.test','{"name":"Second Teammate"}'),
('00000000-0000-4000-8000-000000000003','third@example.test','{"name":"Third Teammate"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare c uuid; same uuid; begin
  c := public.shiftline_mutate('send',null,'{"recipientId":"00000000-0000-4000-8000-000000000002","subject":"Coverage","body":"Hello second teammate","priority":"Routine"}','send-one');
  same := public.shiftline_mutate('send',null,'{"recipientId":"00000000-0000-4000-8000-000000000002","subject":"Coverage","body":"Hello second teammate","priority":"Routine"}','send-one');
  if c<>same or (select count(*) from public.shiftline_conversations)<>1 then raise exception 'Duplicate conversation'; end if;
  perform set_config('shiftline.test.cid',c::text,true);
  begin
    perform public.shiftline_mutate('receive',c,'{"kind":"text","text":"Spoofed teammate reply","replyTo":"anything"}','bad');
    raise exception 'Spoof was allowed';
  exception when others then if SQLERRM<>'Only Nova replies use this action.' then raise; end if; end;
  begin
    update public.shiftline_conversations set payload='{}' where id=c;
    raise exception 'Direct overwrite was allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare c uuid:=current_setting('shiftline.test.cid')::uuid; v jsonb; begin
  if (select count(*) from public.shiftline_conversations)<>1 then raise exception 'Recipient cannot see thread'; end if;
  perform public.shiftline_mutate('read',c);
  select payload into v from public.shiftline_conversations where id=c;
  if v->'chat'->0->>'status'<>'Read' then raise exception 'Read receipt failed'; end if;
  perform public.shiftline_mutate('post',c,'{"kind":"text","text":"Hello first teammate"}','reply-one');
  perform public.shiftline_mutate('post',c,'{"kind":"text","text":"Hello first teammate"}','reply-one');
  select payload into v from public.shiftline_conversations where id=c;
  if jsonb_array_length(v->'chat')<>2 or v->'chat'->1->>'senderId'<>'00000000-0000-4000-8000-000000000002' then raise exception 'Reply identity or deduplication failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
  if exists(select 1 from public.shiftline_conversations) then raise exception 'Third user can read private thread'; end if;
  begin
    perform public.shiftline_mutate('post',current_setting('shiftline.test.cid')::uuid,'{"kind":"text","text":"Unauthorized"}','third');
    raise exception 'Unauthorized write allowed';
  exception when others then if SQLERRM<>'Conversation unavailable.' then raise; end if; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.shiftline_conversations;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.shiftline_mutate('read',current_setting('shiftline.test.cid')::uuid);
    raise exception 'Anonymous mutation allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
