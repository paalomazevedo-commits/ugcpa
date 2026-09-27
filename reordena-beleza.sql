/* ============================================================
   REORDENA OS VÍDEOS DO NICHO "BELEZA"
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que este arquivo faz: coloca os vídeos do nicho "beleza" nesta
   ordem no carrossel do site:
     1) AprilSkin
     2) Celimax
     3) Review Eudora
     4) Storytelling Bioage
     5) Unboxing Eudora

   Como a Eudora aparece duas vezes (um vídeo de review, outro de
   unboxing), o comando usa também a coluna "formato" pra saber qual
   é qual, além da marca.

   Passo 1 é só uma consulta (não muda nada), pra você conferir se os
   5 vídeos foram encontrados antes de aplicar a nova ordem. Se algum
   vier com "titulo" vazio na lista, me avisa o texto exato da marca
   ou do formato desse vídeo que eu ajusto o comando. É seguro rodar
   este arquivo mais de uma vez.
   ============================================================ */

-- 1) só pra conferir antes: deve trazer exatamente 5 linhas, uma pra
--    cada vídeo, sem nenhuma vazia
select titulo, marca, formato, nicho, ordem
from public.videos
where lower(trim(nicho)) like 'beleza%'
  and (
    lower(marca) like '%aprilskin%' or lower(marca) like '%april skin%'
    or lower(marca) like '%celimax%'
    or lower(marca) like '%eudora%'
    or lower(marca) like '%bioage%'
  )
order by marca;

-- 2) aplica a nova ordem
update public.videos
set ordem = 1
where lower(trim(nicho)) like 'beleza%'
  and (lower(marca) like '%aprilskin%' or lower(marca) like '%april skin%');

update public.videos
set ordem = 2
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%celimax%';

update public.videos
set ordem = 3
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%eudora%'
  and lower(formato) like '%review%';

update public.videos
set ordem = 4
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%bioage%'
  and lower(formato) like '%storytelling%';

update public.videos
set ordem = 5
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%eudora%'
  and (lower(formato) like '%unbox%' or lower(formato) like '%unboxing%');

-- 3) confere o resultado: deve mostrar os 5 vídeos nesta ordem exata
--    (AprilSkin, Celimax, Review Eudora, Storytelling Bioage, Unboxing Eudora)
select titulo, marca, formato, ordem
from public.videos
where lower(trim(nicho)) like 'beleza%'
  and (
    lower(marca) like '%aprilskin%' or lower(marca) like '%april skin%'
    or lower(marca) like '%celimax%'
    or lower(marca) like '%eudora%'
    or lower(marca) like '%bioage%'
  )
order by ordem;
