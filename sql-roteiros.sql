/* ============================================================
   ROTEIROS (biblioteca de transcrições) + CONFIGURAÇÕES
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).
   Pode rodar mais de uma vez sem problema: nada é apagado.

   O que isso cria:
   - roteiros: cada vídeo transcrito (seu ou de outra creator),
     com a transcrição, as tags e as suas notas.
   - configuracoes: pares de chave e valor. Hoje guarda só a sua
     chave da Supadata, pra ela funcionar em qualquer computador
     em que você entrar no painel.
   As duas tabelas ficam trancadas: só você, logada, lê e escreve.
   Quem não está logado não enxerga nada.
   ============================================================ */

create table if not exists public.roteiros (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  fonte       text not null default 'manual'
              check (fonte in ('instagram', 'tiktok', 'youtube', 'manual')),
  url         text,
  perfil      text,
  de_quem     text not null default 'outra'
              check (de_quem in ('minha', 'outra')),
  titulo      text,
  transcricao text,
  legenda     text,
  postado_em  date,
  tags        text[] not null default '{}',
  obs         text,
  status      text not null default 'pronto'
              check (status in ('processando', 'pronto', 'falhou')),
  erro        text,
  segmentos   jsonb
);

create index if not exists roteiros_created_at_idx on public.roteiros (created_at desc);
create index if not exists roteiros_url_idx on public.roteiros (url);

create table if not exists public.configuracoes (
  chave      text primary key,
  valor      text,
  updated_at timestamptz not null default now()
);

-- atualiza o updated_at sozinho a cada edição
create or replace function public.roteiros_marca_atualizacao()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists roteiros_updated_at on public.roteiros;
create trigger roteiros_updated_at
  before update on public.roteiros
  for each row execute function public.roteiros_marca_atualizacao();

drop trigger if exists configuracoes_updated_at on public.configuracoes;
create trigger configuracoes_updated_at
  before update on public.configuracoes
  for each row execute function public.roteiros_marca_atualizacao();

-- tranca ligada nas duas tabelas
alter table public.roteiros      enable row level security;
alter table public.configuracoes enable row level security;

-- quem não está logado não tem acesso nenhum; você, logada, tem tudo
revoke all on public.roteiros, public.configuracoes from anon;
grant select, insert, update, delete on public.roteiros, public.configuracoes to authenticated;

drop policy if exists "so eu leio roteiros"   on public.roteiros;
drop policy if exists "so eu crio roteiros"   on public.roteiros;
drop policy if exists "so eu edito roteiros"  on public.roteiros;
drop policy if exists "so eu apago roteiros"  on public.roteiros;
create policy "so eu leio roteiros"
  on public.roteiros for select to authenticated using (true);
create policy "so eu crio roteiros"
  on public.roteiros for insert to authenticated with check (true);
create policy "so eu edito roteiros"
  on public.roteiros for update to authenticated using (true) with check (true);
create policy "so eu apago roteiros"
  on public.roteiros for delete to authenticated using (true);

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
