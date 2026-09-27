/* ============================================================
   MANDA O VÍDEO DA GARNIER PRO FINAL DO NICHO "BELEZA"
   ============================================================
   ONDE COLAR: SQL Editor do Supabase, cole tudo e clique em Run.

   Continua a ordem: AprilSkin (1), Celimax (2), Review Eudora (3),
   Storytelling Bioage (4), Unboxing Eudora (5), Garnier (6).
   ============================================================ */

-- 1) só pra conferir: deve trazer 1 linha (o vídeo da Garnier)
select titulo, marca, formato, nicho, ordem
from public.videos
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%garnier%';

-- 2) manda pro final
update public.videos
set ordem = 6
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%garnier%';

-- 3) confere a ordem final de todo o nicho beleza
select titulo, marca, formato, ordem
from public.videos
where lower(trim(nicho)) like 'beleza%'
order by ordem;
