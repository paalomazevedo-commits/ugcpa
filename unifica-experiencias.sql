/* ============================================================
   UNIFICA O NICHO "EXPERIÊNCIAS" EM UM SÓ
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que aconteceu: o site agrupa os vídeos pelo texto exato que está
   escrito no campo "nicho" de cada vídeo (só ignora maiúscula/minúscula
   e espaço nas pontas). Se um vídeo foi salvo como "Experiência" e
   outro como "Experiências", pro site isso são dois nichos diferentes,
   cada um com seu próprio botão de filtro e seu próprio carrossel,
   mesmo que pra você seja tudo a mesma coisa.

   O que este arquivo faz: primeiro mostra quais vídeos estão com esse
   nicho hoje (pra você confirmar antes de mudar nada), depois junta
   todas as variantes (com ou sem "s" no final, com ou sem acento) num
   texto só: "experiências". É seguro rodar mais de uma vez.
   ============================================================ */

-- 1) só pra você ver o que existe hoje antes de mudar (não altera nada)
select titulo, marca, nicho
from public.videos
where lower(trim(nicho)) in ('experiencia', 'experiência', 'experiencias', 'experiências')
order by nicho, ordem;

-- 2) unifica tudo num texto só
update public.videos
set nicho = 'experiências'
where lower(trim(nicho)) in ('experiencia', 'experiência', 'experiencias', 'experiências')
  and nicho <> 'experiências';

-- 3) confere que ficou só um nicho agora (essa consulta deve trazer
--    tudo com o mesmo texto na coluna "nicho")
select titulo, marca, nicho
from public.videos
where lower(trim(nicho)) in ('experiencia', 'experiência', 'experiencias', 'experiências')
order by ordem;
