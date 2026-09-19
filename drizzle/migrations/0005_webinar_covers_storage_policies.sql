CREATE POLICY "webinar_covers_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'webinar-covers');
CREATE POLICY "webinar_covers_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'webinar-covers');
CREATE POLICY "webinar_covers_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'webinar-covers') WITH CHECK (bucket_id = 'webinar-covers');
CREATE POLICY "webinar_covers_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'webinar-covers');