/* ============================================================
   ABORDAGENS E BIOS
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).
   Pode rodar mais de uma vez sem problema: nada é apagado.

   O que isso cria:
   - abordagens_canais: cada canal de abordagem (Gmail, DM do
     Instagram, WhatsApp...), com a dica e a estrutura dele.
   - abordagens_modelos: as versões de texto de cada canal, com
     os campos {{assim}} que se preenchem sozinhos.
   - bios: as suas bios de cada rede e plataforma.
   - configuracoes: a mesma tabela da aba Roteiros. Aqui ela
     guarda as suas respostas (nome, @, a marca da vez...).
   Os textos padrão entram sozinhos na primeira vez que você
   abrir a aba. Tudo fica trancado: só você, logada, lê e escreve.
   ============================================================ */

create table if not exists public.abordagens_canais (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  padrao      text,
  nome        text not null,
  dica        text,
  estrutura   jsonb not null default '[]',
  ordem       int not null default 0
);

create table if not exists public.abordagens_modelos (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  canal_id    uuid not null references public.abordagens_canais (id) on delete cascade,
  padrao      text,
  nome        text not null,
  assunto     text,
  corpo       text not null default '',
  ordem       int not null default 0
);

create index if not exists abordagens_modelos_canal_idx on public.abordagens_modelos (canal_id, ordem);

create table if not exists public.bios (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  plataforma  text not null,
  texto       text not null default '',
  limite      int not null default 0,
  ordem       int not null default 0
);

create table if not exists public.configuracoes (
  chave      text primary key,
  valor      text,
  updated_at timestamptz not null default now()
);

-- atualiza o updated_at sozinho a cada edição
create or replace function public.abordagens_marca_atualizacao()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists abordagens_modelos_updated_at on public.abordagens_modelos;
create trigger abordagens_modelos_updated_at
  before update on public.abordagens_modelos
  for each row execute function public.abordagens_marca_atualizacao();

drop trigger if exists bios_updated_at on public.bios;
create trigger bios_updated_at
  before update on public.bios
  for each row execute function public.abordagens_marca_atualizacao();

-- tranca ligada nas tabelas
alter table public.abordagens_canais  enable row level security;
alter table public.abordagens_modelos enable row level security;
alter table public.bios               enable row level security;
alter table public.configuracoes      enable row level security;

-- quem não está logado não tem acesso nenhum; você, logada, tem tudo
revoke all on public.abordagens_canais, public.abordagens_modelos, public.bios, public.configuracoes from anon;
grant select, insert, update, delete on public.abordagens_canais, public.abordagens_modelos, public.bios, public.configuracoes to authenticated;

drop policy if exists "so eu leio canais"   on public.abordagens_canais;
drop policy if exists "so eu crio canais"   on public.abordagens_canais;
drop policy if exists "so eu edito canais"  on public.abordagens_canais;
drop policy if exists "so eu apago canais"  on public.abordagens_canais;
create policy "so eu leio canais"
  on public.abordagens_canais for select to authenticated using (true);
create policy "so eu crio canais"
  on public.abordagens_canais for insert to authenticated with check (true);
create policy "so eu edito canais"
  on public.abordagens_canais for update to authenticated using (true) with check (true);
create policy "so eu apago canais"
  on public.abordagens_canais for delete to authenticated using (true);

drop policy if exists "so eu leio modelos"   on public.abordagens_modelos;
drop policy if exists "so eu crio modelos"   on public.abordagens_modelos;
drop policy if exists "so eu edito modelos"  on public.abordagens_modelos;
drop policy if exists "so eu apago modelos"  on public.abordagens_modelos;
create policy "so eu leio modelos"
  on public.abordagens_modelos for select to authenticated using (true);
create policy "so eu crio modelos"
  on public.abordagens_modelos for insert to authenticated with check (true);
create policy "so eu edito modelos"
  on public.abordagens_modelos for update to authenticated using (true) with check (true);
create policy "so eu apago modelos"
  on public.abordagens_modelos for delete to authenticated using (true);

drop policy if exists "so eu leio bios"   on public.bios;
drop policy if exists "so eu crio bios"   on public.bios;
drop policy if exists "so eu edito bios"  on public.bios;
drop policy if exists "so eu apago bios"  on public.bios;
create policy "so eu leio bios"
  on public.bios for select to authenticated using (true);
create policy "so eu crio bios"
  on public.bios for insert to authenticated with check (true);
create policy "so eu edito bios"
  on public.bios for update to authenticated using (true) with check (true);
create policy "so eu apago bios"
  on public.bios for delete to authenticated using (true);

drop policy if exists "so eu leio configuracoes"   on public.configuracoes;
drop policy if exists "so eu crio configuracoes"   on public.configuracoes;
drop policy if exists "so eu edito configuracoes"  on public.configuracoes;
drop policy if exists "so eu apago configuracoes"  on public.configuracoes;
create policy "so eu leio configuracoes"
  on public.configuracoes for select to authenticated using (true);
create policy "so eu crio configuracoes"
  on public.configuracoes for insert to authenticated with check (true);
create policy "so eu edito configuracoes"
  on public.configuracoes for update to authenticated using (true) with check (true);
create policy "so eu apago configuracoes"
  on public.configuracoes for delete to authenticated using (true);
