// ============================================================
// ENVIAR-EMAILS - o carteiro da Prospecção
// ============================================================
// Função do Supabase (Edge Function). Ela é o único lugar do
// projeto que sabe a chave do Resend (RESEND_API_KEY), e essa
// chave NUNCA aparece aqui no código: ela vive só nos segredos
// desta função, lá no painel do Supabase.
//
// O QUE ELA FAZ, NESTA ORDEM:
// 1. Confere se quem está chamando é você, logada (recusa
//    qualquer outro e-mail, ou ninguém logado).
// 2. Recebe a lista de destinatários, o assunto e o HTML prontos
//    (o texto já vem montado pelo painel; esta função só troca
//    {{nome}}/{{marca}} de cada um e manda).
// 3. Tira quem está na lista de descadastro e quem já recebeu
//    este mesmo assunto (quando pedido).
// 4. Manda um por um, com uma pausa entre cada envio.
// 5. Grava uma linha por destinatário na tabela email_envios,
//    pra nunca perder o controle de quem recebeu o quê.
// 6. Se o Resend disser que a cota diária acabou, para na hora.
//
// COMO SUBIR ESTA FUNÇÃO: veja o passo a passo que a Claude te
// mandou junto com este arquivo.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// O seu e-mail de contato, o mesmo que já aparece no site. É pra
// cá que vai a resposta de quem recebe o e-mail (reply_to) e pra
// cá que aponta o "SAIR" do rodapé. Não é segredo nenhum, por
// isso pode ficar aqui no código. Se um dia você trocar de
// e-mail, troca só esta linha.
const EMAIL_CONTATO = "paalomazevedo@gmail.com";

// Só este e-mail pode chamar esta função. Qualquer sessão de
// outro usuário é recusada.
const EMAIL_AUTORIZADO = "paalomazevedo@gmail.com";

const MAXIMO_DESTINATARIOS = 250;
const PAUSA_ENTRE_ENVIOS_MS = 200; // ~5 por segundo, ritmo seguro do Resend

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

// pega a primeira palavra do nome da marca, pra usar como saudação
// ("Clínica Bela Pele Ltda" -> "Clínica")
function primeiroNome(nomeMarca: string): string {
  var limpo = String(nomeMarca || "").trim();
  if (!limpo) return "";
  return limpo.split(/\s+/)[0];
}

function normalizarEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

// troca {{nome}} e {{marca}} no texto (funciona em assunto ou em HTML)
function personalizar(texto: string, nomeMarca: string): string {
  var primeiro = primeiroNome(nomeMarca);
  return String(texto || "")
    .replace(/\{\{\s*nome\s*\}\}/gi, primeiro)
    .replace(/\{\{\s*marca\s*\}\}/gi, nomeMarca || "");
}

// o Resend sinaliza a cota diária esgotada de jeitos um pouco
// diferentes dependendo da versão da API, então confere tanto o
// nome do erro quanto o texto da mensagem
function ehCotaEsgotada(nomeErro: string, mensagemErro: string): boolean {
  var alvo = (String(nomeErro || "") + " " + String(mensagemErro || "")).toLowerCase();
  return alvo.indexOf("daily_quota_exceeded") !== -1 || alvo.indexOf("daily quota") !== -1;
}

async function mandarUmEmail(opcoes: {
  resendApiKey: string;
  remetente: string;
  destinatario: string;
  assunto: string;
  html: string;
}) {
  var resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + opcoes.resendApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opcoes.remetente,
      to: [opcoes.destinatario],
      subject: opcoes.assunto,
      html: opcoes.html,
      reply_to: EMAIL_CONTATO,
      headers: {
        "List-Unsubscribe": "<mailto:" + EMAIL_CONTATO + "?subject=SAIR>",
      },
    }),
  });

  var corpo: any = null;
  try { corpo = await resp.json(); } catch (e) { corpo = null; }

  if (resp.ok && corpo && corpo.id) {
    return { ok: true, id: corpo.id as string, erro: null, cotaEsgotada: false };
  }

  var nomeErro = (corpo && (corpo.name || corpo.error)) || "";
  var mensagemErro = (corpo && corpo.message) || resp.statusText || "Erro desconhecido ao enviar.";
  return {
    ok: false,
    id: null,
    erro: String(mensagemErro),
    cotaEsgotada: ehCotaEsgotada(nomeErro, mensagemErro),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cabecalhosCORS() });
  }
  if (req.method !== "POST") {
    return respostaJSON({ ok: false, mensagem: "Método não aceito." }, 405);
  }

  // ---------- 1) QUEM ESTÁ CHAMANDO? ----------
  var cabecalhoAuth = req.headers.get("Authorization") || "";
  var token = cabecalhoAuth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return respostaJSON({ ok: false, mensagem: "Você precisa estar logada pra usar isso." }, 401);
  }

  var urlProjeto = Deno.env.get("SUPABASE_URL") || "";
  var chaveServico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  var chaveResend = Deno.env.get("RESEND_API_KEY") || "";
  var remetente = Deno.env.get("REMETENTE_EMAIL") || "Paloma Ribeiro <onboarding@resend.dev>";

  if (!urlProjeto || !chaveServico) {
    return respostaJSON({ ok: false, mensagem: "A função não está configurada direito (faltam variáveis do Supabase)." }, 500);
  }
  if (!chaveResend) {
    return respostaJSON({ ok: false, mensagem: "Falta o segredo RESEND_API_KEY no painel do Supabase. Veja o passo a passo pra cadastrar." }, 500);
  }

  var supabase = createClient(urlProjeto, chaveServico);

  var usuarioResp = await supabase.auth.getUser(token);
  var usuario = usuarioResp && usuarioResp.data && usuarioResp.data.user;
  if (!usuario || !usuario.email || usuario.email.toLowerCase() !== EMAIL_AUTORIZADO.toLowerCase()) {
    return respostaJSON({ ok: false, mensagem: "Acesso recusado." }, 403);
  }

  // ---------- 2) O QUE CHEGOU ----------
  var corpoRequisicao: any;
  try {
    corpoRequisicao = await req.json();
  } catch (e) {
    return respostaJSON({ ok: false, mensagem: "O pedido veio num formato que eu não entendi." }, 400);
  }

  var destinatariosBrutos: any[] = Array.isArray(corpoRequisicao.destinatarios) ? corpoRequisicao.destinatarios : [];
  var assunto: string = String(corpoRequisicao.assunto || "").trim();
  var html: string = String(corpoRequisicao.html || "");
  var pularRepetidos: boolean = corpoRequisicao.pularRepetidos !== false; // padrão: true

  if (!assunto) return respostaJSON({ ok: false, mensagem: "Falta o assunto do e-mail." }, 400);
  if (!html) return respostaJSON({ ok: false, mensagem: "Falta o texto do e-mail." }, 400);
  if (!destinatariosBrutos.length) return respostaJSON({ ok: false, mensagem: "Não veio nenhum destinatário." }, 400);
  if (destinatariosBrutos.length > MAXIMO_DESTINATARIOS) {
    return respostaJSON({
      ok: false,
      mensagem: "Isso é mais de " + MAXIMO_DESTINATARIOS + " destinatários numa chamada só. O painel já devia ter dividido em lotes menores.",
    }, 400);
  }

  // ---------- 3) LIMPEZA: sem repetido, sem quem pediu pra sair ----------
  var vistos: Record<string, boolean> = {};
  var destinatarios: { email: string; nome: string }[] = [];
  var puladosRepetidoNaLista = 0;
  destinatariosBrutos.forEach(function (d) {
    var email = normalizarEmail(d && d.email);
    if (!email || email.indexOf("@") === -1) return;
    if (vistos[email]) { puladosRepetidoNaLista++; return; }
    vistos[email] = true;
    destinatarios.push({ email: email, nome: String((d && d.nome) || "") });
  });

  var listaEmails = destinatarios.map(function (d) { return d.email; });

  var optoutResp = await supabase.from("email_optout").select("email").in("email", listaEmails);
  var emailsDescadastrados: Record<string, boolean> = {};
  (optoutResp.data || []).forEach(function (linha: any) { emailsDescadastrados[normalizarEmail(linha.email)] = true; });

  var emailsJaReceberam: Record<string, boolean> = {};
  if (pularRepetidos) {
    var historicoResp = await supabase
      .from("email_envios")
      .select("email")
      .eq("assunto", assunto)
      .eq("status", "ok")
      .in("email", listaEmails);
    (historicoResp.data || []).forEach(function (linha: any) { emailsJaReceberam[normalizarEmail(linha.email)] = true; });
  }

  var filaFinal = destinatarios.filter(function (d) {
    return !emailsDescadastrados[d.email] && !emailsJaReceberam[d.email];
  });
  var puladosDescadastro = destinatarios.filter(function (d) { return emailsDescadastrados[d.email]; }).length;
  var puladosJaReceberam = destinatarios.filter(function (d) { return emailsJaReceberam[d.email]; }).length;
  var totalPulados = puladosRepetidoNaLista + puladosDescadastro + puladosJaReceberam;

  // ---------- 4) MANDAR, UM POR UM ----------
  var resultados: { email: string; ok: boolean; erro: string | null }[] = [];
  var enviados = 0, falhas = 0, cotaEsgotada = false;

  for (var i = 0; i < filaFinal.length; i++) {
    var destino = filaFinal[i];
    var assuntoPersonalizado = personalizar(assunto, destino.nome);
    var htmlPersonalizado = personalizar(html, destino.nome);

    var resultado = await mandarUmEmail({
      resendApiKey: chaveResend,
      remetente: remetente,
      destinatario: destino.email,
      assunto: assuntoPersonalizado,
      html: htmlPersonalizado,
    });

    await supabase.from("email_envios").insert({
      email: destino.email,
      assunto: assunto,
      status: resultado.ok ? "ok" : "erro",
      erro: resultado.ok ? null : resultado.erro,
      resend_id: resultado.ok ? resultado.id : null,
    });

    if (resultado.ok) {
      enviados++;
      resultados.push({ email: destino.email, ok: true, erro: null });
    } else {
      falhas++;
      resultados.push({ email: destino.email, ok: false, erro: resultado.erro });
    }

    if (resultado.cotaEsgotada) {
      cotaEsgotada = true;
      break; // para na hora, não tenta o resto
    }

    if (i < filaFinal.length - 1) {
      await new Promise(function (resolve) { setTimeout(resolve, PAUSA_ENTRE_ENVIOS_MS); });
    }
  }

  var processados = resultados.length;
  var faltaram = filaFinal.length - processados;

  return respostaJSON({
    ok: true,
    enviados: enviados,
    falhas: falhas,
    pulados: totalPulados,
    faltaram: faltaram,
    cotaEsgotada: cotaEsgotada,
    resultados: resultados,
  });
});
