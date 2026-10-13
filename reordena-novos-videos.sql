/* ============================================================
   COLOCA OS DOIS VÍDEOS NOVOS COMO PRIMEIRO DO NICHO DELES
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que isto faz:
   - "Toalha Descartável - Skincare" vira o primeiro vídeo do
     nicho dele (ex.: beleza).
   - "Experiência - Nutricionista" vira o primeiro vídeo do
     nicho dele (ex.: nutrição/saúde).

   Cada um recebe uma "ordem" menor que a do atual primeiro do
   nicho dele, então não precisa saber o número exato de ninguém:
   o comando calcula sozinho.
   ============================================================ */

-- 1) só pra conferir antes: deve trazer exatamente 2 linhas, uma
--    pra cada vídeo. Se vier 0, mais de 2, ou algum nicho vazio,
--    PARE e me manda o resultado antes de continuar.
select titulo, marca, nicho, ordem, criado_em
from public.videos
where (lower(titulo) like '%toalha%' and lower(titulo) like '%skincare%')
   or (lower(titulo) like '%experi%ncia%' and lower(titulo) like '%nutricionista%')
order by criado_em desc;

-- 2) aplica a nova ordem
update public.videos
set ordem = (
  select coalesce(min(v2.ordem), 1) - 1
  from public.videos v2
  where v2.nicho = videos.nicho and v2.id <> videos.id
)
where lower(titulo) like '%toalha%' and lower(titulo) like '%skincare%';

update public.videos
set ordem = (
  select coalesce(min(v2.ordem), 1) - 1
  from public.videos v2
  where v2.nicho = videos.nicho and v2.id <> videos.id
)
where lower(titulo) like '%experi%ncia%' and lower(titulo) like '%nutricionista%';

-- 3) conferência final: os dois devem aparecer com a menor "ordem"
--    do nicho deles (comparando com o resto da lista)
select titulo, marca, nicho, ordem
from public.videos
order by nicho, ordem;
