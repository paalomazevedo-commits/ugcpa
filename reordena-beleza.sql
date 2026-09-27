/* ============================================================
   REORDENA OS VÍDEOS DO NICHO "BELEZA" (v2, mais abrangente)
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   Ordem desejada no carrossel:
     1) AprilSkin
     2) Celimax
     3) Review Eudora
     4) Storytelling Bioage
     5) Unboxing Eudora

   Por que a v1 pode não ter funcionado: os campos "formato" e
   "nicho" no seu painel são texto livre (você digita o que quiser),
   então eu não tenho como saber com certeza a grafia exata sem
   acesso ao banco. Esta versão procura por mais palavras (em
   português e inglês) tanto no "formato" quanto no "título", e
   ainda tem um passo de segurança pros dois vídeos da Eudora: se
   nenhuma palavra for encontrada em nenhum dos dois, o mais antigo
   cadastrado vira "review" (posição 3) e o mais novo vira
   "unboxing" (posição 5). Se sair trocado, me avisa que eu invirto.

   Passo 1 é só uma consulta (não muda nada). Se ela não trouxer
   exatamente 5 linhas, ou vier alguma com "titulo" vazio, PARE e me
   mande o resultado dela antes de continuar, sem isso não dá pra
   saber se o comando vai acertar.
   ============================================================ */

-- 1) só pra conferir antes: deve trazer exatamente 5 linhas, uma pra
--    cada vídeo (AprilSkin, Celimax, Eudora x2, Bioage), sem vazias
select titulo, marca, formato, nicho, ordem, criado_em
from public.videos
where lower(trim(nicho)) like 'beleza%'
  and (
    lower(marca) like '%aprilskin%' or lower(marca) like '%april skin%'
    or lower(marca) like '%celimax%'
    or lower(marca) like '%eudora%'
    or lower(marca) like '%bioage%'
  )
order by marca;

-- 2) aplica a nova ordem (marca sozinha basta pra estas três)
update public.videos
set ordem = 1
where lower(trim(nicho)) like 'beleza%'
  and (lower(marca) like '%aprilskin%' or lower(marca) like '%april skin%');

update public.videos
set ordem = 2
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%celimax%';

update public.videos
set ordem = 4
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%bioage%';

-- 3) os dois da Eudora: tenta achar a palavra certa no formato OU no
--    título, em português ou inglês
update public.videos
set ordem = 3
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%eudora%'
  and (
    lower(formato) like '%review%' or lower(titulo) like '%review%'
    or lower(formato) like '%resenha%' or lower(titulo) like '%resenha%'
    or lower(formato) like '%avalia%' or lower(titulo) like '%avalia%'
    or lower(formato) like '%opini%' or lower(titulo) like '%opini%'
  );

update public.videos
set ordem = 5
where lower(trim(nicho)) like 'beleza%'
  and lower(marca) like '%eudora%'
  and (
    lower(formato) like '%unbox%' or lower(titulo) like '%unbox%'
    or lower(formato) like '%abrindo%' or lower(titulo) like '%abrindo%'
    or lower(formato) like '%caixa%' or lower(titulo) like '%caixa%'
  );

-- 4) segurança: se sobrou algum vídeo da Eudora em beleza sem cair
--    nem em 3 nem em 5 no passo 3 (nenhuma palavra bateu), decide
--    pela data de criação: o mais antigo fica em 3, o mais novo em 5
with eudora_restantes as (
  select id, row_number() over (order by criado_em asc) as posicao
  from public.videos
  where lower(trim(nicho)) like 'beleza%'
    and lower(marca) like '%eudora%'
    and ordem not in (3, 5)
)
update public.videos as v
set ordem = case when er.posicao = 1 then 3 else 5 end
from eudora_restantes er
where v.id = er.id;

-- 5) confere o resultado: deve mostrar os 5 vídeos nesta ordem exata
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
