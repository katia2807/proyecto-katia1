-- Logo de empresa en PDFs: URL pública apuntando a Storage.
alter table public.configuracion_empresa
  add column if not exists logo_url text;

-- Bucket público para que los PDFs del navegador carguen la imagen sin firmar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'empresa-logos',
  'empresa-logos',
  true,
  2097152,
  array['image/png']::text[]
)
on conflict (id) do nothing;

drop policy if exists "Public read empresa logos" on storage.objects;
create policy "Public read empresa logos"
  on storage.objects for select
  to public
  using (bucket_id = 'empresa-logos');
