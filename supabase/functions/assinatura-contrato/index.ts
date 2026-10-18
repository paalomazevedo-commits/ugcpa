// ============================================================
// ASSINATURA-CONTRATO - manda pra assinar e confere o status
// ============================================================
// Função do Supabase (Edge Function). Fala com a API do
// Autentique (autentique.com.br) pra mandar o contrato em PDF
// pra você e pra marca assinarem, e pra conferir se já assinaram.
// A chave da sua conta do Autentique (AUTENTIQUE_API_KEY) fica só
// nos segredos desta função, nunca aqui no código.
//
// Duas ações, no campo "acao" do corpo do pedido:
//   { acao: "enviar", contratoId, nomeDocumento, pdfBase64,
//     assinantes: [{ nome, email }, ...] }
//     -> manda o PDF pro Autentique, cria os signatários e marca
//        o contrato (na tabela contratos_gerados) como "pendente".
//
//   { acao: "status", contratoId }
//     -> pergunta pro Autentique se já assinaram, e atualiza o
//        status do contrato pra "assinado" quando for o caso.
//
// ESTE É O PRIMEIRO TESTE DESTA INTEGRAÇÃO: se o Autentique
// devolver um erro de "campo não existe" na primeira vez que você
// usar, é só me mandar a mensagem de erro que aparece na tela que
// eu ajusto na hora - a API deles mudou algumas vezes de nome em
// alguns campos e a documentação pública não cobre tudo.
//
// COMO SUBIR ESTA FUNÇÃO: veja o passo a passo que a Claude te
// mandou junto com este arquivo.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_AUTORIZADO = "paalomazevedo@gmail.com";
const API_AUTENTIQUE = "https://api.autentique.com.br/v2/graphql";

function cabecalhosCORS() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function respostaJSON(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCORS(), "Content-Type": "application/json" },
  });
}

function base64ParaBytes(base64: string): Uint8Array {
  var limpo = base64.replace(/^data:application\/pdf;base64,/, "");
  var binario = atob(limpo);
  var bytes = new Uint8Array(binario.length);
  for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function chamarAutentique(chaveApi: string, operations: unknown, map: unknown, arquivo?: { bytes: Uint8Array; nome: string }) {
  var form = new FormData();
  form.append("operations", JSON.stringify(operations));
  form.append("map", JSON.stringify(map));
  if (arquivo) {
    form.append("file", new Blob([arquivo.bytes], { type: "application/pdf" }), arquivo.nome);
  }
  var resp = await fetch(API_AUTENTIQUE, {
    method: "POST",
    headers: { Authorization: "Bearer " + chaveApi },
    body: form,
  });
  var corpo = await resp.json().catch(function () { return null; });
  return { ok: resp.ok, status: resp.status, corpo: corpo };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cabecalhosCORS() });
  }
  if (req.method !== "POST") {
    return respostaJSON({ ok: false, mensagem: "Método não aceito." }, 405);
  }

  var cabecalhoAuth = req.headers.get("Authorization") || "";
  var token = cabecalhoAuth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return respostaJSON({ ok: false, mensagem: "Você precisa estar logada pra usar isso." }, 401);
  }

  var urlProjeto = Deno.env.get("SUPABASE_URL") || "";
  var chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  var chaveAutentique = Deno.env.get("AUTENTIQUE_API_KEY") || "";
  if (!urlProjeto || !chaveServico) {
    return respostaJSON({ ok: false, mensagem: "A função não está configurada direito (faltam variáveis do Supabase)." }, 500);
  }
  if (!chaveAutentique) {
    return respostaJSON({ ok: false, mensagem: "Falta o segredo AUTENTIQUE_API_KEY no painel do Supabase. Veja o passo a passo pra cadastrar." }, 500);
  }

  var supabase = createClient(urlProjeto, chaveServico);
  var usuarioResp = await supabase.auth.getUser(token);
  var usuario = usuarioResp && usuarioResp.data && usuarioResp.data.user;
  if (!usuario || !usuario.email || usuario.email.toLowerCase() !== EMAIL_AUTORIZADO.toLowerCase()) {
    return respostaJSON({ ok: false, mensagem: "Acesso recusado." }, 403);
  }

  var corpoRequisicao: any;
  try {
    corpoRequisicao = await req.json();
  } catch (e) {
    return respostaJSON({ ok: false, mensagem: "O pedido veio num formato que eu não entendi." }, 400);
  }

  var acao = String(corpoRequisicao.acao || "");

  // ---------- ENVIAR PRA ASSINATURA ----------
  if (acao === "enviar") {
    var contratoId = String(corpoRequisicao.contratoId || "");
    var nomeDocumento = String(corpoRequisicao.nomeDocumento || "Contrato");
    var pdfBase64 = String(corpoRequisicao.pdfBase64 || "");
    var assinantes: { nome: string; email: string }[] = Array.isArray(corpoRequisicao.assinantes) ? corpoRequisicao.assinantes : [];

    if (!contratoId) return respostaJSON({ ok: false, mensagem: "Falta dizer qual contrato." }, 400);
    if (!pdfBase64) return respostaJSON({ ok: false, mensagem: "Falta o PDF do contrato." }, 400);
    if (!assinantes.length) return respostaJSON({ ok: false, mensagem: "Falta pelo menos um assinante." }, 400);

    var mutation =
      "mutation CriarDocumento($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) { " +
      "createDocument(document: $document, signers: $signers, file: $file) { id name signatures { public_id name email } } }";

    var signersGraphQL = assinantes.map(function (a) {
      return { email: String(a.email || "").trim(), action: "SIGN", name: String(a.nome || "").trim() || undefined };
    });

    var resultado = await chamarAutentique(
      chaveAutentique,
      { query: mutation, variables: { document: { name: nomeDocumento }, signers: signersGraphQL, file: null } },
      { file: ["variables.file"] },
      { bytes: base64ParaBytes(pdfBase64), nome: nomeDocumento + ".pdf" }
    );

    if (!resultado.ok || !resultado.corpo || resultado.corpo.errors || !resultado.corpo.data) {
      var mensagemErro = (resultado.corpo && resultado.corpo.errors && resultado.corpo.errors[0] && resultado.corpo.errors[0].message) ||
        "O Autentique recusou o pedido (veja os detalhes técnicos abaixo e me mande essa mensagem).";
      return respostaJSON({ ok: false, mensagem: mensagemErro, detalhesTecnicos: resultado.corpo }, 502);
    }

    var documento = resultado.corpo.data.createDocument;
    await supabase.from("contratos_gerados").update({
      autentique_documento_id: documento.id,
      status_assinatura: "pendente",
      assinantes: assinantes,
    }).eq("id", contratoId);

    return respostaJSON({ ok: true, documentoId: documento.id });
  }

  // ---------- CONFERIR STATUS ----------
  if (acao === "status") {
    var contratoIdStatus = String(corpoRequisicao.contratoId || "");
    if (!contratoIdStatus) return respostaJSON({ ok: false, mensagem: "Falta dizer qual contrato." }, 400);

    var linhaResp = await supabase.from("contratos_gerados").select("autentique_documento_id").eq("id", contratoIdStatus).single();
    var documentoId = linhaResp.data && linhaResp.data.autentique_documento_id;
    if (!documentoId) return respostaJSON({ ok: false, mensagem: "Esse contrato ainda não foi enviado pra assinatura." }, 400);

    var query =
      "query ConferirDocumento($id: UUID!) { " +
      "document(id: $id) { id name signatures { public_id name email created_at signed { created_at } rejected { created_at } } } }";

    var resultadoStatus = await chamarAutentique(chaveAutentique, { query: query, variables: { id: documentoId } }, {});

    if (!resultadoStatus.ok || !resultadoStatus.corpo || resultadoStatus.corpo.errors || !resultadoStatus.corpo.data) {
      var mensagemErroStatus = (resultadoStatus.corpo && resultadoStatus.corpo.errors && resultadoStatus.corpo.errors[0] && resultadoStatus.corpo.errors[0].message) ||
        "Não consegui conferir o status agora (veja os detalhes técnicos e me mande essa mensagem).";
      return respostaJSON({ ok: false, mensagem: mensagemErroStatus, detalhesTecnicos: resultadoStatus.corpo }, 502);
    }

    var assinaturas = (resultadoStatus.corpo.data.document && resultadoStatus.corpo.data.document.signatures) || [];
    var todosAssinaram = assinaturas.length > 0 && assinaturas.every(function (s: any) { return s.signed && s.signed.created_at; });
    var novoStatus = todosAssinaram ? "assinado" : "pendente";

    await supabase.from("contratos_gerados").update({ status_assinatura: novoStatus }).eq("id", contratoIdStatus);

    return respostaJSON({ ok: true, status: novoStatus, assinaturas: assinaturas });
  }

  return respostaJSON({ ok: false, mensagem: "Ação desconhecida." }, 400);
});
