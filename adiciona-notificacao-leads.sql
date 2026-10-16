/* ============================================================
   NOTIFICAÇÃO DE LEAD NOVO NO ADMIN
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que isso faz: adiciona uma coluna "visto" na tabela de marcas,
   pra o painel saber quais leads (mensagens do formulário do site)
   você ainda não viu. As marcas que você já tem ficam marcadas como
   "já vistas" automaticamente - só os leads novos, que chegarem
   depois de rodar esse SQL, é que começam como "não vistos" e
   acendem a notificação no menu do painel.
   ============================================================ */

alter table public.marcas add column if not exists visto boolean not null default true;
alter table public.marcas alter column visto set default false;
