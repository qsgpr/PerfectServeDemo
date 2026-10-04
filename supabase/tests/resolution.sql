-- Rollback-only archive authorization and immutable-history regression.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001','first@example.test','{"name":"First Teammate"}'),
('00000000-0000-4000-8000-000000000002','second@example.test','{"name":"Second Teammate"}'),
('00000000-0000-4000-8000-000000000003','third@example.test','{"name":"Third Teammate"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare c uuid; begin
 c:=public.shiftline_mutate('send',null,'{"recipientId":"00000000-0000-4000-8000-000000000002","subject":"Archive test","body":"Fictional message","priority":"Routine"}','resolve-test');
 perform set_config('shiftline.test.cid',c::text,true);
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin
  perform public.shiftline_mutate('resolve',current_setting('shiftline.test.cid')::uuid);
  raise exception 'Unauthorized resolution allowed';
 exception when others then if SQLERRM<>'Conversation unavailable.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare c uuid:=current_setting('shiftline.test.cid')::uuid; saved jsonb; begin
 perform public.shiftline_mutate('resolve',c);
 select payload into saved from public.shiftline_conversations where id=c;
 if saved->>'resolvedAt' is null or saved->>'resolvedBy'<>'00000000-0000-4000-8000-000000000002' then raise exception 'Recipient resolve failed'; end if;
 perform public.shiftline_mutate('resolve',c);
 perform public.shiftline_mutate('read',c);
 if saved is distinct from (select payload from public.shiftline_conversations where id=c) then raise exception 'Repeated resolution changed history'; end if;
 begin
  perform public.shiftline_mutate('post',c,'{"kind":"text","text":"Late write"}','late');
  raise exception 'Late write allowed';
 exception when others then if SQLERRM<>'This conversation is resolved. Start a new conversation.' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ declare c uuid:=current_setting('shiftline.test.cid')::uuid; begin
 if not exists(select 1 from public.shiftline_conversations where id=c and payload->>'resolvedAt' is not null) then raise exception 'Sender cannot read archive'; end if;
 begin
  perform public.shiftline_mutate('post',c,'{"kind":"text","text":"Late sender write"}','late-sender');
  raise exception 'Sender write allowed';
 exception when others then if SQLERRM<>'This conversation is resolved. Start a new conversation.' then raise; end if; end;
end $$;
reset role;
rollback;
