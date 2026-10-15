/* ============================================================
   COLOCA O VÍDEO DA CLEIA COMO PRIMEIRO DO NICHO "MODA" (v2)
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   Por que a v1 pode não ter funcionado: ela só procurava "cleia"
   no campo "marca". Se "Cleia" estiver no "título" do vídeo em vez
   da marca, a v1 não achava nada pra mudar - e o vídeo continuava
   na posição antiga (a última). Esta versão procura nos dois
   campos.
   ============================================================ */

-- 1) só pra conferir antes: deve trazer exatamente 1 linha. CONFIRA
--    esse resultado antes de continuar - se vier 0 linhas ou mais de
--    1, PARE e me manda o que apareceu aqui.
select titulo, marca, nicho, ordem, criado_em
from public.videos
where lower(nicho) like 'moda%'
  and (lower(marca) like '%cleia%' or lower(titulo) like '%cleia%');

-- 2) aplica a nova ordem: menor que a do atual primeiro do nicho "moda"
update public.videos
set ordem = (
  select coalesce(min(v2.ordem), 1) - 1
  from public.videos v2
  where lower(v2.nicho) like 'moda%' and v2.id <> videos.id
)
where lower(nicho) like 'moda%'
  and (lower(marca) like '%cleia%' or lower(titulo) like '%cleia%');

-- 3) conferência final: a Cleia deve aparecer com a menor "ordem" do nicho moda
select titulo, marca, nicho, ordem
from public.videos
where lower(nicho) like 'moda%'
order by ordem;
