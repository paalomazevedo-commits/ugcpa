/* ============================================================
   COLOCA CLÉA STORE EM PRIMEIRO E A BYRI (OUTFIT DO DIA) EM
   SEGUNDO, NO NICHO "MODA"
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).
   ============================================================ */

-- 1) só pra conferir antes: deve trazer exatamente 2 linhas
select titulo, marca, nicho, ordem, criado_em
from public.videos
where lower(nicho) like 'moda%'
  and (
    lower(marca) like '%clea%' or lower(titulo) like '%clea%'
    or lower(marca) like '%byri%' or lower(titulo) like '%outfit do dia%'
  );

-- 2) aplica a nova ordem: Cléa Store primeiro, Byri (Outfit do Dia) logo depois
update public.videos
set ordem = (
  select coalesce(min(v2.ordem), 1) - 2
  from public.videos v2
  where lower(v2.nicho) like 'moda%'
    and not (
      lower(v2.marca) like '%clea%' or lower(v2.titulo) like '%clea%'
      or lower(v2.marca) like '%byri%' or lower(v2.titulo) like '%outfit do dia%'
    )
)
where lower(nicho) like 'moda%'
  and (lower(marca) like '%clea%' or lower(titulo) like '%clea%');

update public.videos
set ordem = (
  select coalesce(min(v2.ordem), 1) - 2
  from public.videos v2
  where lower(v2.nicho) like 'moda%'
    and not (
      lower(v2.marca) like '%clea%' or lower(v2.titulo) like '%clea%'
      or lower(v2.marca) like '%byri%' or lower(v2.titulo) like '%outfit do dia%'
    )
) + 1
where lower(nicho) like 'moda%'
  and (lower(marca) like '%byri%' or lower(titulo) like '%outfit do dia%');

-- 3) conferência final: Cléa Store deve vir primeiro, Byri (Outfit do Dia) em segundo
select titulo, marca, nicho, ordem
from public.videos
where lower(nicho) like 'moda%'
order by ordem;
