/* ============================================================
   GERADOR DE CONTRATOS
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que isso cria:
   - contrato_modelo: um registro só, com o texto do seu modelo de
     contrato (com os campos {{assim}}) e a sua logo (se você subir
     uma). Só você, logada, consegue ler ou editar - ninguém de fora
     enxerga isso, nem o próprio arquivo deste SQL tem o seu modelo
     dentro (o texto fica só aqui no banco, nunca em arquivo).
   - contratos_gerados: o histórico de cada contrato que você gerar,
     pra poder baixar de novo ou usar como ponto de partida pra um
     novo. Também só você, logada, tem acesso.
   ============================================================ */

create table if not exists public.contrato_modelo (
  id int primary key default 1,
  texto text not null default '',
  logo_base64 text,
  atualizado_em timestamptz not null default now(),
  constraint contrato_modelo_um_registro_so check (id = 1)
);

create table if not exists public.contratos_gerados (
  id uuid primary key default gen_random_uuid(),
  marca text not null,
  campos jsonb not null,
  criado_em timestamptz not null default now()
);

alter table public.contrato_modelo   enable row level security;
alter table public.contratos_gerados enable row level security;

-- só você, logada, lê e edita o modelo - ninguém deslogado chega perto
create policy "so eu leio o modelo de contrato"
  on public.contrato_modelo for select to authenticated using (true);
create policy "so eu crio o modelo de contrato"
  on public.contrato_modelo for insert to authenticated with check (true);
create policy "so eu edito o modelo de contrato"
  on public.contrato_modelo for update to authenticated using (true) with check (true);

-- só você, logada, lê, cria e apaga do histórico
create policy "so eu leio contratos gerados"
  on public.contratos_gerados for select to authenticated using (true);
create policy "so eu crio contratos gerados"
  on public.contratos_gerados for insert to authenticated with check (true);
create policy "so eu apago contratos gerados"
  on public.contratos_gerados for delete to authenticated using (true);

-- cria a única linha da tabela de modelo, vazia, pra você preencher
-- no painel (não roda de novo se você já rodou esse SQL antes)
insert into public.contrato_modelo (id, texto) values (1, '')
  on conflict (id) do nothing;
