/* ============================================================
   COLOCA O VÍDEO DA CLEIA COMO PRIMEIRO DO NICHO "MODA"
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).
   ============================================================ */

-- 1) só pra conferir antes: deve trazer exatamente 1 linha
select titulo, marca, nicho, ordem, criado_em
from public.videos
where lower(nicho) like 'moda%'
  and lower(marca) like '%cleia%';

-- 2) aplica a nova ordem: menor que a do atual primeiro do nicho "moda"
update public.videos
set ordem = (
  select coalesce(min(v2.ordem), 1) - 1
  from public.videos v2
  where lower(v2.nicho) like 'moda%' and v2.id <> videos.id
)
where lower(nicho) like 'moda%'
  and lower(marca) like '%cleia%';

-- 3) conferência final: a Cleia deve aparecer com a menor "ordem" do nicho moda
select titulo, marca, nicho, ordem
from public.videos
where lower(nicho) like 'moda%'
order by ordem;
