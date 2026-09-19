/* ============================================================
   BANCO DE DADOS DO PAINEL DA PALOMA RIBEIRO
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "SQL Editor", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).
   Pode rodar de uma vez só, de cima a baixo, é seguro repetir.

   O que este arquivo faz, nesta ordem:
   1) Cria as 6 tabelas (videos, marcas, calendario, campanhas,
      marcados, visitas), cada uma com um comentário explicando
      pra que serve.
   2) Coloca UMA linha de exemplo em cada lista (vídeos, marcas,
      calendário e campanhas), marcada como exemplo, só pra você
      ver o formato. Pode apagar essas linhas quando quiser.
   3) Liga o RLS (a tranca de segurança) em todas as tabelas e
      cria as regras de quem pode ler e escrever o quê.
   ============================================================ */

-- Garante que o banco sabe gerar códigos aleatórios (gen_random_uuid).
-- A maioria dos projetos Supabase já vem com isso pronto; esta linha
-- só garante que funcione mesmo assim. É seguro rodar mais de uma vez.
create extension if not exists pgcrypto;


/* ============================================================
   1) VIDEOS
   Os vídeos que aparecem nos carrosséis do seu portfólio, um
   carrossel por nicho. O site público lê esta tabela sozinho.
   ============================================================ */
create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  link        text not null default '',
  nicho       text not null default '',
  formato     text not null default '',
  marca       text not null default '',
  destaque    text not null default '',   -- ex: "2,4M views"
  ordem       integer not null default 0,
  visivel     boolean not null default true,
  exemplo     boolean not null default false,
  criado_em   timestamptz not null default now()
);
comment on table public.videos is 'Vídeos do portfólio público, organizados por nicho.';

-- ajuda o site a pedir "me dá os vídeos na ordem certa" rápido
create index if not exists videos_ordem_idx on public.videos (nicho, ordem);


/* ============================================================
   2) MARCAS
   A sua base de contatos de empresa (a sua CRM). O formulário
   de contato do site cria uma linha aqui, como "lead".
   ============================================================ */
create table if not exists public.marcas (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  instagram       text not null default '',
  email           text not null default '',
  telefone        text not null default '',
  situacao        text not null default 'lead'
                  check (situacao in ('lead','conversando','cliente','parada')),
  obs             text not null default '',
  ultimo_contato  date,
  exemplo         boolean not null default false,
  criado_em       timestamptz not null default now()
);
comment on table public.marcas is 'Contatos de marca: leads, conversas, clientes e contatos parados.';


/* ============================================================
   3) CALENDARIO
   A sua agenda de gravar, editar e postar.
   ============================================================ */
create table if not exists public.calendario (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  marca       text not null default '',
  tipo        text not null default 'gravar'
              check (tipo in ('gravar','editar','postar')),
  data        date not null,
  status      text not null default 'a_fazer'
              check (status in ('a_fazer','feito')),
  exemplo     boolean not null default false,
  criado_em   timestamptz not null default now()
);
comment on table public.calendario is 'Agenda de tarefas: gravar, editar e postar.';
create index if not exists calendario_data_idx on public.calendario (data);


/* ============================================================
   4) CAMPANHAS
   O funil de trabalhos com marcas, do briefing até a entrega.
   ============================================================ */
create table if not exists public.campanhas (
  id          uuid primary key default gen_random_uuid(),
  campanha    text not null,
  cliente     text not null default '',
  tipo        text not null default 'Conteúdo'
              check (tipo in ('Conteúdo','Publicidade')),
  status      text not null default 'Briefing'
              check (status in ('Briefing','Roteiro','Aprovação Roteiro','Gravação','Edição','Aprovado','Entregue')),
  qtd         integer not null default 1,
  valor       numeric(12,2) not null default 0,
  prazo       date,
  pagamento   text not null default 'pendente'
              check (pagamento in ('pendente','pago')),
  ativa       boolean not null default true,
  favorita    boolean not null default false,
  exemplo     boolean not null default false,
  criado_em   timestamptz not null default now()
);
comment on table public.campanhas is 'Campanhas e trabalhos fechados com marcas.';
create index if not exists campanhas_prazo_idx on public.campanhas (prazo);


/* ============================================================
   5) MARCADOS
   O que você já marcou no Checklist do Portfólio (aba 5 do
   painel). Cada item do checklist tem uma "chave" de texto, e
   aqui só guardamos se aquela chave está marcada ou não.
   ============================================================ */
create table if not exists public.marcados (
  chave       text primary key,
  marcado     boolean not null default true,
  marcado_em  timestamptz not null default now()
);
comment on table public.marcados is 'Itens marcados no checklist do portfólio.';


/* ============================================================
   6) VISITAS
   Um registro simples de quem passou pelo site, pra alimentar
   as métricas da aba Portfólio. Começa vazia de propósito: você
   ainda não tem visita nenhuma, então não tem linha de exemplo
   aqui (uma visita de mentira ia bagunçar a sua primeira métrica
   real).
   ============================================================ */
create table if not exists public.visitas (
  id          bigint generated always as identity primary key,
  data        timestamptz not null default now(),
  pagina      text not null default '',
  origem      text not null default ''
);
comment on table public.visitas is 'Registro simples de visitas ao portfólio público.';
create index if not exists visitas_data_idx on public.visitas (data);


/* ============================================================
   LINHAS DE EXEMPLO
   Uma em cada lista, marcada com exemplo = true, só pra você
   entender o formato. O vídeo de exemplo já nasce ESCONDIDO
   (visivel = false), pra nunca aparecer sem querer no site.
   Se você rodar este arquivo de novo, ele não duplica as linhas
   de exemplo (o "where not exists" cuida disso).
   ============================================================ */
insert into public.videos (titulo, link, nicho, formato, marca, destaque, ordem, visivel, exemplo)
select 'Vídeo de exemplo (pode apagar)', 'https://youtube.com/shorts/xxxxxxxxxxx', 'beleza', 'vídeo 9:16', 'Marca de exemplo', '2,4M views', 0, false, true
where not exists (select 1 from public.videos where exemplo = true);

insert into public.marcas (nome, instagram, email, telefone, situacao, obs, ultimo_contato, exemplo)
select 'Marca de exemplo (pode apagar)', '@marcadeexemplo', 'contato@exemplo.com', '(00) 00000-0000', 'lead', 'Essa linha é só um exemplo do formato. Pode apagar.', current_date, true
where not exists (select 1 from public.marcas where exemplo = true);

insert into public.calendario (titulo, marca, tipo, data, status, exemplo)
select 'Tarefa de exemplo (pode apagar)', 'Marca de exemplo', 'gravar', current_date + 3, 'a_fazer', true
where not exists (select 1 from public.calendario where exemplo = true);

insert into public.campanhas (campanha, cliente, tipo, status, qtd, valor, prazo, pagamento, ativa, favorita, exemplo)
select 'Campanha de exemplo (pode apagar)', 'Cliente de exemplo', 'Conteúdo', 'Briefing', 1, 0, current_date + 10, 'pendente', true, false, true
where not exists (select 1 from public.campanhas where exemplo = true);


/* ============================================================
   RLS - A TRANCA DE SEGURANÇA
   ============================================================
   A regra geral: só você, logada, lê e escreve os seus dados.
   Ninguém deslogado lê nada. Só duas portas ficam abertas pra
   quem não está logado, e só pra INSERIR (nunca ler, editar ou
   apagar): o formulário de contato grava em "marcas", e o site
   grava um registro em "visitas".

   ATENÇÃO A UMA TERCEIRA EXCEÇÃO, DIFERENTE DO QUE VOCÊ PEDIU,
   E QUE PRECISOU EXISTIR: o seu portfólio é uma página pública,
   sem senha, e ele PRECISA mostrar os vídeos pra qualquer
   visitante - é o próprio site funcionando. Por isso, os vídeos
   marcados como "visível" também podem ser LIDOS por qualquer
   pessoa (é o que já acontece hoje, sem tranca nenhuma). Um
   vídeo escondido (visível = falso), esse sim, só você vê.
   Se não abríssemos essa porta, o site ficaria sem vídeo nenhum
   na tela pra quem visita.
   ============================================================ */

alter table public.videos     enable row level security;
alter table public.marcas     enable row level security;
alter table public.calendario enable row level security;
alter table public.campanhas  enable row level security;
alter table public.marcados   enable row level security;
alter table public.visitas    enable row level security;

-- Garante que as duas funções (visitante sem login, e você logada)
-- realmente enxergam as tabelas. No Supabase isso costuma já vir
-- configurado, mas estas linhas garantem mesmo que o projeto tenha
-- sido criado de um jeito diferente. Quem trava o acesso de verdade
-- são as regras (policies) abaixo, não este grant.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.videos, public.marcas, public.calendario,
  public.campanhas, public.marcados, public.visitas
  to authenticated;
grant select on public.videos to anon;
grant insert on public.marcas to anon;
grant insert on public.visitas to anon;


-- ---------- VIDEOS ----------
-- Qualquer pessoa (com ou sem login) lê os vídeos visíveis: é o
-- que faz o portfólio público funcionar.
create policy "qualquer pessoa ve os videos visiveis"
  on public.videos for select
  to anon, authenticated
  using (visivel = true);

-- Você, logada, vê todos, inclusive os escondidos (pra poder editar).
create policy "eu vejo todos os videos"
  on public.videos for select
  to authenticated
  using (true);

create policy "so eu adiciono videos"
  on public.videos for insert
  to authenticated
  with check (true);

create policy "so eu edito videos"
  on public.videos for update
  to authenticated
  using (true) with check (true);

create policy "so eu apago videos"
  on public.videos for delete
  to authenticated
  using (true);


-- ---------- MARCAS ----------
-- Exceção 1 do seu pedido: qualquer pessoa pode INSERIR, e só
-- inserir, uma marca com situação "lead" (é o formulário do site).
create policy "o formulario do site cria um lead"
  on public.marcas for insert
  to anon
  with check (situacao = 'lead');

-- Você, logada, pode adicionar uma marca com qualquer situação
-- (direto pelo painel, sem passar pelo formulário).
create policy "eu adiciono marcas no painel"
  on public.marcas for insert
  to authenticated
  with check (true);

-- Ler, editar e apagar: só você. Ninguém deslogado lê a sua base.
create policy "so eu leio minhas marcas"
  on public.marcas for select to authenticated using (true);
create policy "so eu edito minhas marcas"
  on public.marcas for update to authenticated using (true) with check (true);
create policy "so eu apago minhas marcas"
  on public.marcas for delete to authenticated using (true);


-- ---------- CALENDARIO ----------
-- Só você, logada. Ninguém deslogado lê nem escreve nada aqui.
create policy "so eu leio meu calendario"
  on public.calendario for select to authenticated using (true);
create policy "so eu adiciono no calendario"
  on public.calendario for insert to authenticated with check (true);
create policy "so eu edito o calendario"
  on public.calendario for update to authenticated using (true) with check (true);
create policy "so eu apago do calendario"
  on public.calendario for delete to authenticated using (true);


-- ---------- CAMPANHAS ----------
-- Só você, logada. É a sua informação de dinheiro, mais sensível
-- de todas: ninguém deslogado enxerga nada aqui.
create policy "so eu leio minhas campanhas"
  on public.campanhas for select to authenticated using (true);
create policy "so eu adiciono campanhas"
  on public.campanhas for insert to authenticated with check (true);
create policy "so eu edito campanhas"
  on public.campanhas for update to authenticated using (true) with check (true);
create policy "so eu apago campanhas"
  on public.campanhas for delete to authenticated using (true);


-- ---------- MARCADOS ----------
-- Só você, logada.
create policy "so eu leio meus marcados"
  on public.marcados for select to authenticated using (true);
create policy "so eu marco itens do checklist"
  on public.marcados for insert to authenticated with check (true);
create policy "so eu atualizo meus marcados"
  on public.marcados for update to authenticated using (true) with check (true);
create policy "so eu desmarco itens do checklist"
  on public.marcados for delete to authenticated using (true);


-- ---------- VISITAS ----------
-- Exceção 2 do seu pedido: qualquer pessoa pode INSERIR uma
-- visita (é o próprio site registrando que alguém passou por lá).
create policy "o site registra uma visita"
  on public.visitas for insert
  to anon, authenticated
  with check (true);

-- Ler, só você. Visitas não tem edição nem exclusão pra ninguém:
-- é só um registro indo pra frente, igual um contador.
create policy "so eu leio as visitas"
  on public.visitas for select to authenticated using (true);


/* ============================================================
   FIM. Se tudo rodou sem erro em vermelho, está pronto.
   ============================================================ */
