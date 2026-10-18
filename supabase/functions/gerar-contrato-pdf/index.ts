// ============================================================
// GERAR-CONTRATO-PDF - monta o PDF do contrato
// ============================================================
// Função do Supabase (Edge Function). Recebe uma lista de
// "blocos" já prontos (o texto do modelo já com os {{campos}}
// trocados pelos valores reais - essa troca acontece no painel,
// não aqui) e devolve o PDF pronto, em A4, pra download.
//
// Esta função não sabe nada sobre contrato, CNPJ ou dado pessoal
// seu: ela só sabe desenhar os tipos de bloco abaixo. Isso quer
// dizer que ela é só um "datilógrafo" genérico - o conteúdo em si
// nunca fica guardado aqui, só passa e volta como PDF.
//
// TIPOS DE BLOCO ACEITOS (no campo "blocos" do corpo do pedido):
//   { tipo: "titulo",     texto: "..." }
//   { tipo: "secao",      texto: "..." }                     (negrito)
//   { tipo: "paragrafo",  texto: "..." }                      (justificado)
//   { tipo: "lista",      itens: ["...", "..."] }
//   { tipo: "tabela",     linhas: [["a","b"],["c","d"]], cabecalho: true }
//   { tipo: "assinatura", nome: "...", papel: "..." }
//   { tipo: "espaco" }
//
// Também aceita, no corpo do pedido:
//   logoBase64: "data:image/png;base64,...."   (marca d'água, opcional)
//
// COMO SUBIR ESTA FUNÇÃO: veja o passo a passo que a Claude te
// mandou junto com este arquivo.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";

const EMAIL_AUTORIZADO = "paalomazevedo@gmail.com";

const LARGURA_A4 = 595.28;
const ALTURA_A4 = 841.89;
const MARGEM = 56;
const LARGURA_UTIL = LARGURA_A4 - MARGEM * 2;

const TAMANHO_TITULO = 15;
const TAMANHO_SECAO = 11.5;
const TAMANHO_TEXTO = 10.5;
const ALTURA_LINHA = 1.42;

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

// ---------- quebra de linha ----------

function quebraEmLinhas(texto: string, fonte: any, tamanho: number, larguraMax: number): string[] {
  var palavras = String(texto || "").split(/\s+/).filter(function (p) { return p.length > 0; });
  if (!palavras.length) return [""];

  var linhas: string[] = [];
  var linhaAtual = "";

  palavras.forEach(function (palavra) {
    var tentativa = linhaAtual ? linhaAtual + " " + palavra : palavra;
    var largura = fonte.widthOfTextAtSize(tentativa, tamanho);
    if (largura <= larguraMax || !linhaAtual) {
      linhaAtual = tentativa;
    } else {
      linhas.push(linhaAtual);
      linhaAtual = palavra;
    }
  });
  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

// ---------- gerenciador de página / cursor ----------

class Pagina {
  pdfDoc: any;
  fonteNormal: any;
  fonteNegrito: any;
  paginaAtual: any;
  y: number = 0;

  constructor(pdfDoc: any, fonteNormal: any, fonteNegrito: any) {
    this.pdfDoc = pdfDoc;
    this.fonteNormal = fonteNormal;
    this.fonteNegrito = fonteNegrito;
    this.novaPagina();
  }

  novaPagina() {
    this.paginaAtual = this.pdfDoc.addPage([LARGURA_A4, ALTURA_A4]);
    this.y = ALTURA_A4 - MARGEM;
  }

  garanteEspaco(alturaNecessaria: number) {
    if (this.y - alturaNecessaria < MARGEM) this.novaPagina();
  }

  linhaSimples(texto: string, opcoes: { negrito?: boolean; tamanho?: number; centralizado?: boolean; cor?: any } = {}) {
    var fonte = opcoes.negrito ? this.fonteNegrito : this.fonteNormal;
    var tamanho = opcoes.tamanho || TAMANHO_TEXTO;
    var alturaLinha = tamanho * ALTURA_LINHA;
    this.garanteEspaco(alturaLinha);
    var largura = fonte.widthOfTextAtSize(texto, tamanho);
    var x = opcoes.centralizado ? MARGEM + (LARGURA_UTIL - largura) / 2 : MARGEM;
    this.paginaAtual.drawText(texto, {
      x: x,
      y: this.y - tamanho,
      size: tamanho,
      font: fonte,
      color: opcoes.cor || rgb(0.12, 0.12, 0.12),
    });
    this.y -= alturaLinha;
  }

  paragrafoJustificado(texto: string, tamanho = TAMANHO_TEXTO) {
    var alturaLinha = tamanho * ALTURA_LINHA;
    var linhas = quebraEmLinhas(texto, this.fonteNormal, tamanho, LARGURA_UTIL);

    linhas.forEach(function (this: Pagina, linha: string, indice: number) {
      this.garanteEspaco(alturaLinha);
      var ultimaLinhaDoParagrafo = indice === linhas.length - 1;
      var palavras = linha.split(/\s+/).filter(function (p) { return p.length > 0; });

      if (ultimaLinhaDoParagrafo || palavras.length < 2) {
        this.paginaAtual.drawText(linha, {
          x: MARGEM, y: this.y - tamanho, size: tamanho, font: this.fonteNormal, color: rgb(0.12, 0.12, 0.12),
        });
      } else {
        var larguraTexto = this.fonteNormal.widthOfTextAtSize(linha.replace(/\s+/g, ""), tamanho);
        var larguraPalavras = palavras.reduce(function (soma: number, p: string) { return soma + this.fonteNormal.widthOfTextAtSize(p, tamanho); }.bind(this), 0);
        var espacoExtra = (LARGURA_UTIL - larguraPalavras) / (palavras.length - 1);
        var cursorX = MARGEM;
        palavras.forEach(function (this: Pagina, palavra: string, i: number) {
          this.paginaAtual.drawText(palavra, { x: cursorX, y: this.y - tamanho, size: tamanho, font: this.fonteNormal, color: rgb(0.12, 0.12, 0.12) });
          cursorX += this.fonteNormal.widthOfTextAtSize(palavra, tamanho) + espacoExtra;
        }.bind(this));
      }
      this.y -= alturaLinha;
    }.bind(this));
  }

  itemDeLista(texto: string, tamanho = TAMANHO_TEXTO) {
    var recuo = 16;
    var alturaLinha = tamanho * ALTURA_LINHA;
    var linhas = quebraEmLinhas(texto, this.fonteNormal, tamanho, LARGURA_UTIL - recuo);
    linhas.forEach(function (this: Pagina, linha: string, indice: number) {
      this.garanteEspaco(alturaLinha);
      if (indice === 0) {
        this.paginaAtual.drawText("•", { x: MARGEM, y: this.y - tamanho, size: tamanho, font: this.fonteNormal, color: rgb(0.12, 0.12, 0.12) });
      }
      this.paginaAtual.drawText(linha, { x: MARGEM + recuo, y: this.y - tamanho, size: tamanho, font: this.fonteNormal, color: rgb(0.12, 0.12, 0.12) });
      this.y -= alturaLinha;
    }.bind(this));
  }

  espacoVertical(pontos: number) {
    this.y -= pontos;
  }

  tabela(linhas: string[][], temCabecalho: boolean) {
    if (!linhas.length) return;
    var numColunas = linhas[0].length;
    var larguraColuna = LARGURA_UTIL / numColunas;
    var paddingCelula = 6;
    var tamanho = TAMANHO_TEXTO - 1;
    var alturaLinhaTexto = tamanho * ALTURA_LINHA;

    for (var l = 0; l < linhas.length; l++) {
      var ehCabecalho = temCabecalho && l === 0;
      var linhasPorCelula = linhas[l].map(function (celula) {
        return quebraEmLinhas(celula, ehCabecalho ? this.fonteNegrito : this.fonteNormal, tamanho, larguraColuna - paddingCelula * 2);
      }.bind(this));
      var maxLinhas = Math.max.apply(null, linhasPorCelula.map(function (a: string[]) { return a.length; }));
      var alturaLinhaTabela = maxLinhas * alturaLinhaTexto + paddingCelula * 2;

      this.garanteEspaco(alturaLinhaTabela);
      var yTopo = this.y;

      for (var c = 0; c < numColunas; c++) {
        var x = MARGEM + c * larguraColuna;
        this.paginaAtual.drawRectangle({
          x: x, y: yTopo - alturaLinhaTabela, width: larguraColuna, height: alturaLinhaTabela,
          borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.75,
          color: ehCabecalho ? rgb(0.94, 0.94, 0.94) : undefined,
        });
        var fonteCelula = ehCabecalho ? this.fonteNegrito : this.fonteNormal;
        linhasPorCelula[c].forEach(function (this: Pagina, textoLinha: string, i: number) {
          this.paginaAtual.drawText(textoLinha, {
            x: x + paddingCelula,
            y: yTopo - paddingCelula - tamanho - i * alturaLinhaTexto,
            size: tamanho, font: fonteCelula, color: rgb(0.12, 0.12, 0.12),
          });
        }.bind(this));
      }
      this.y -= alturaLinhaTabela;
    }
  }

  assinatura(nome: string, papel: string) {
    var alturaBloco = 46;
    this.garanteEspaco(alturaBloco);
    this.y -= 26;
    this.paginaAtual.drawLine({
      start: { x: MARGEM, y: this.y }, end: { x: MARGEM + 220, y: this.y },
      thickness: 0.75, color: rgb(0.3, 0.3, 0.3),
    });
    this.y -= 14;
    this.linhaSimples(nome + (papel ? " (" + papel + ")" : ""), { tamanho: TAMANHO_TEXTO });
    this.y -= 6;
  }
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
  if (!urlProjeto || !chaveServico) {
    return respostaJSON({ ok: false, mensagem: "A função não está configurada direito (faltam variáveis do Supabase)." }, 500);
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

  var blocos: any[] = Array.isArray(corpoRequisicao.blocos) ? corpoRequisicao.blocos : [];
  var logoBase64: string = String(corpoRequisicao.logoBase64 || "");
  if (!blocos.length) {
    return respostaJSON({ ok: false, mensagem: "Não veio nenhum conteúdo pra montar o PDF." }, 400);
  }

  try {
    var pdfDoc = await PDFDocument.create();
    var fonteNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    var fonteNegrito = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    var pagina = new Pagina(pdfDoc, fonteNormal, fonteNegrito);

    blocos.forEach(function (bloco: any) {
      var tipo = String(bloco && bloco.tipo || "");
      if (tipo === "titulo") {
        pagina.linhaSimples(String(bloco.texto || ""), { negrito: true, tamanho: TAMANHO_TITULO, centralizado: true });
        pagina.espacoVertical(10);
      } else if (tipo === "secao") {
        pagina.espacoVertical(4);
        pagina.linhaSimples(String(bloco.texto || ""), { negrito: true, tamanho: TAMANHO_SECAO });
        pagina.espacoVertical(2);
      } else if (tipo === "paragrafo") {
        pagina.paragrafoJustificado(String(bloco.texto || ""));
        pagina.espacoVertical(4);
      } else if (tipo === "lista") {
        (Array.isArray(bloco.itens) ? bloco.itens : []).forEach(function (item: string) {
          pagina.itemDeLista(String(item || ""));
        });
        pagina.espacoVertical(4);
      } else if (tipo === "tabela") {
        pagina.tabela(Array.isArray(bloco.linhas) ? bloco.linhas : [], !!bloco.cabecalho);
        pagina.espacoVertical(8);
      } else if (tipo === "assinatura") {
        pagina.assinatura(String(bloco.nome || ""), String(bloco.papel || ""));
      } else if (tipo === "espaco") {
        pagina.espacoVertical(Number(bloco.pontos) || 10);
      }
    });

    // ---------- marca d'água (logo bem clarinha, centrada) ----------
    var paginas = pdfDoc.getPages();
    var imagemLogo: any = null;
    if (logoBase64) {
      try {
        var combinacao = logoBase64.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
        if (combinacao) {
          var bytesBase64 = combinacao[2];
          var binario = atob(bytesBase64);
          var bytes = new Uint8Array(binario.length);
          for (var i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
          imagemLogo = /png/i.test(combinacao[1]) ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        }
      } catch (e) {
        imagemLogo = null; // se a logo vier quebrada, segue sem marca d'água
      }
    }

    paginas.forEach(function (p: any, indice: number) {
      if (imagemLogo) {
        var larguraDesejada = LARGURA_A4 * 0.5;
        var escala = larguraDesejada / imagemLogo.width;
        var larguraFinal = imagemLogo.width * escala;
        var alturaFinal = imagemLogo.height * escala;
        p.drawImage(imagemLogo, {
          x: (LARGURA_A4 - larguraFinal) / 2,
          y: (ALTURA_A4 - alturaFinal) / 2,
          width: larguraFinal,
          height: alturaFinal,
          opacity: 0.08,
        });
      }
      var textoRodape = "Página " + (indice + 1) + " de " + paginas.length;
      var larguraRodape = fonteNormal.widthOfTextAtSize(textoRodape, 8.5);
      p.drawText(textoRodape, {
        x: (LARGURA_A4 - larguraRodape) / 2,
        y: MARGEM / 2,
        size: 8.5,
        font: fonteNormal,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    var pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: { ...cabecalhosCORS(), "Content-Type": "application/pdf" },
    });
  } catch (erro) {
    return respostaJSON({ ok: false, mensagem: "Não consegui montar o PDF: " + String(erro) }, 500);
  }
});
