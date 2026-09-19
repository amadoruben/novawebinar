create policy "org members read webinar videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'webinar-videos'
  and exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id::text = (storage.foldername(name))[1]
  )
);

create policy "org members upload webinar videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'webinar-videos'
  and exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id::text = (storage.foldername(name))[1]
  )
);

create policy "org members delete webinar videos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'webinar-videos'
  and exists (
    select 1 from public.organization_members m
    where m.user_id = auth.uid()
      and m.organization_id::text = (storage.foldername(name))[1]
  )
);
