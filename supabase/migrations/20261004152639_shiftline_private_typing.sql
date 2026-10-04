-- Typing broadcasts are ephemeral and restricted to conversation participants.
create policy shiftline_typing_receive on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and (select realtime.topic()) like 'shiftline:conversation:%'
  and exists (
    select 1 from public.shiftline_conversations c
    where c.id::text = split_part((select realtime.topic()), ':', 3)
      and (c.owner_id = (select auth.uid()) or c.recipient_id = (select auth.uid())::text)
  )
);
create policy shiftline_typing_send on realtime.messages
for insert to authenticated
with check (
  extension = 'broadcast'
  and (select realtime.topic()) like 'shiftline:conversation:%'
  and exists (
    select 1 from public.shiftline_conversations c
    where c.id::text = split_part((select realtime.topic()), ':', 3)
      and (c.owner_id = (select auth.uid()) or c.recipient_id = (select auth.uid())::text)
  )
);
