/* ============================================================
   ASSINATURA DIGITAL DOS CONTRATOS (via Autentique)
   ============================================================
   ONDE COLAR: entre no seu projeto em supabase.com, no menu da
   esquerda clique em "Editor SQL", depois em "New query". Cole
   este arquivo INTEIRO na caixa e clique em "Run" (ou Ctrl+Enter).

   O que isso cria:
   - Três colunas novas na tabela contratos_gerados, pra guardar
     o status do envio pra assinatura: o id do documento lá no
     Autentique, o status (não enviado / pendente / assinado) e
     a lista de quem precisa assinar.
   ============================================================ */

alter table public.contratos_gerados
  add column if not exists autentique_documento_id text;

alter table public.contratos_gerados
  add column if not exists status_assinatura text not null default 'nao_enviado';

alter table public.contratos_gerados
  add column if not exists assinantes jsonb;

-- deixa você, logada, também atualizar o status manualmente se precisar
-- (não roda de novo se você já rodou esse SQL antes)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'contratos_gerados'
      and policyname = 'so eu atualizo contratos gerados'
  ) then
    create policy "so eu atualizo contratos gerados"
      on public.contratos_gerados for update to authenticated using (true) with check (true);
  end if;
end $$;
