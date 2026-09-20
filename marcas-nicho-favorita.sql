/* ============================================================
   NICHO E FAVORITA NA TABELA DE MARCAS
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que isto faz: adiciona duas colunas na sua tabela "marcas" que
   já existe, sem apagar nem mudar nenhuma marca que você já tem
   cadastrada:

   - nicho: texto livre pra você organizar as marcas por área
     (ex.: "beleza", "moda", "tech"). Nasce vazio em quem já
     está cadastrado; você preenche aos poucos pelo painel.
   - favorita: verdadeiro/falso, pra marcar com uma estrela as
     marcas que você quer destacar (por exemplo, pra mandar um
     e-mail só pra elas depois). Nasce como "false" em todo mundo.

   É seguro rodar mais de uma vez: se as colunas já existirem, o
   "if not exists" evita erro e não faz nada de novo.
   ============================================================ */

alter table public.marcas add column if not exists nicho text not null default '';
alter table public.marcas add column if not exists favorita boolean not null default false;
