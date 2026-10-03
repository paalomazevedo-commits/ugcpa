/* ============================================================
   PROSPECÇÃO - colunas novas e tabelas novas
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).
   Pode rodar de uma vez só, de cima a baixo, é seguro repetir.

   O que isto faz, sem apagar nem mudar nenhuma marca que você já
   tem cadastrada:

   1) Acrescenta duas colunas na sua tabela "marcas" que já existe:
      - selecionada: a caixinha de seleção da aba Marcas. Nasce
        desmarcada (false) em todo mundo.
      - ultimo_email_em: quando a aba Prospecção manda um e-mail
        pra essa marca, a data e hora ficam guardadas aqui. Nasce
        vazia (nunca mandou).

   2) Cria duas tabelas novas:
      - email_envios: uma linha PRA CADA e-mail que sai, com o
        resultado. É o que permite saber, se um disparo parar no
        meio, exatamente quem recebeu e quem não recebeu.
      - email_optout: a lista de quem pediu pra não receber mais
        (respondeu "SAIR"). Quem está aqui nunca mais recebe
        e-mail de prospecção, em disparo nenhum.

   3) Liga o RLS (a tranca de segurança) nas duas tabelas novas,
      do mesmo jeito que já está em "marcas": só você, logada, lê
      e escreve. A função "enviar-emails" (a que manda de verdade)
      usa a chave de serviço do Supabase, que já passa direto por
      essa tranca - por isso ela não precisa de uma regra própria
      aqui, só o seu painel precisa.
   ============================================================ */


-- ---------- 1) COLUNAS NOVAS EM "marcas" ----------
alter table public.marcas add column if not exists selecionada boolean not null default false;
alter table public.marcas add column if not exists ultimo_email_em timestamptz;


-- ---------- 2) TABELAS NOVAS ----------

/* uma linha por destinatário, em todo disparo (teste ou de verdade).
   "status" só pode ser 'ok' ou 'erro'; quando dá erro, o motivo fica
   em "erro" e o "resend_id" fica vazio. */
create table if not exists public.email_envios (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  assunto     text not null,
  status      text not null default 'ok' check (status in ('ok','erro')),
  erro        text,
  resend_id   text,
  criado_em   timestamptz not null default now()
);
comment on table public.email_envios is 'Registro de prospecção: uma linha por e-mail enviado, com o resultado.';

-- ajuda a conferir rápido "esse e-mail já recebeu este assunto?" e a buscar no histórico
create index if not exists email_envios_assunto_email_idx on public.email_envios (assunto, email);
create index if not exists email_envios_email_idx on public.email_envios (email);
create index if not exists email_envios_criado_em_idx on public.email_envios (criado_em desc);

/* quem respondeu "SAIR". Enquanto o e-mail estiver aqui, a função
   "enviar-emails" nunca manda pra ele, em disparo nenhum. */
create table if not exists public.email_optout (
  email       text primary key,
  criado_em   timestamptz not null default now()
);
comment on table public.email_optout is 'E-mails que pediram pra não receber mais prospecção.';


-- ---------- 3) RLS - A TRANCA DE SEGURANÇA ----------
alter table public.email_envios  enable row level security;
alter table public.email_optout  enable row level security;

grant select on public.email_envios to authenticated;
grant select, insert on public.email_optout to authenticated;

-- Ler o histórico: só você, logada.
create policy "so eu leio os envios"
  on public.email_envios for select
  to authenticated
  using (true);

-- Ler a lista de descadastro: só você, logada.
create policy "so eu leio o descadastro"
  on public.email_optout for select
  to authenticated
  using (true);

-- Descadastrar um e-mail à mão (quando alguém responde "SAIR" na sua
-- caixa de entrada normal, é você que cola o e-mail na aba Prospecção).
create policy "eu descadastro um e-mail manualmente"
  on public.email_optout for insert
  to authenticated
  with check (true);
