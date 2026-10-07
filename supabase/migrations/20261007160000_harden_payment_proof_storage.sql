-- Harden payment proof storage.
-- Keep receipts private, limit uploads to supported formats/size,
-- and allow users to clean up their own failed uploads.

update storage.buckets
set file_size_limit = 6291456,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ]::text[]
where id = 'payment-proofs';

drop policy if exists payment_proofs_delete_own on storage.objects;

create policy payment_proofs_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
