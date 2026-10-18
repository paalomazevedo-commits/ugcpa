/* ============================================================
   ABA - CONTRATOS
   Gera o contrato de UGC/publi em PDF a partir de um modelo seu,
   com campos que mudam a cada marca (CNPJ, valor, prazo etc).
   O modelo (com os seus dados e os campos {{assim}}) fica só no
   banco, protegido por login - nunca em arquivo público. Esta
   página: edita o modelo, preenche um formulário pra cada marca,
   mostra a prévia em tempo real e manda pra uma Edge Function
   (gerar-contrato-pdf) que devolve o PDF pronto.
   ============================================================ */
(function () {
  var A = window.Admin;

  /* o e-mail que recebe o pedido de assinatura como CONTRATADA - o
     mesmo que já aparece no contrato e no site, não o e-mail de
     login do admin (que pode ser outro). */
  var EMAIL_ASSINATURA_PALOMA = "contato@palomaribeirougc.com";

  var MESES_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  var DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  var DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  var CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  /* os 14 campos que a Paloma pediu pra existirem sempre. Qualquer
     {{campo}} novo que ela escrever no modelo (tipo {{produto}})
     aparece sozinho no formulário como texto simples, sem precisar
     tocar neste código. */
  var CAMPOS_CONHECIDOS = {
    razao_social: { rotulo: "Razão social da marca", tipo: "texto" },
    cnpj_marca: { rotulo: "CNPJ da marca", tipo: "cnpj" },
    representante: { rotulo: "Representante legal (nome, cargo e CPF)", tipo: "texto" },
    email_marca: { rotulo: "E-mail da marca", tipo: "email" },
    qtd_videos: { rotulo: "Quantidade de vídeos", tipo: "numero", extenso: true },
    duracao_video: { rotulo: "Duração de cada vídeo", tipo: "texto" },
    qtd_fotos: { rotulo: "Quantidade de fotos", tipo: "numero", extenso: true, opcional: true },
    prazo_entrega: { rotulo: "Prazo de entrega (dias úteis)", tipo: "numero", extenso: true, padrao: "7" },
    valor: { rotulo: "Valor (R$)", tipo: "moeda", extenso: true },
    forma_pagamento: { rotulo: "Forma de pagamento", tipo: "texto", padrao: "PIX" },
    prazo_pagamento: { rotulo: "Prazo de pagamento (dias)", tipo: "numero", extenso: true },
    meses_licenca: { rotulo: "Meses de licença de mídia paga", tipo: "numero", extenso: true },
    cidade_assinatura: { rotulo: "Cidade da assinatura", tipo: "texto", padrao: "Praia Grande/SP" },
    data_assinatura: { rotulo: "Data da assinatura", tipo: "data", extenso: true, padrao: "hoje" }
  };

  var modeloAtual = { texto: "", logo_base64: null };
  var logoBase64Atual = null;
  var blocosCrus = [];
  var camposAtuais = [];

  /* ---------- números por extenso (PT-BR) ---------- */

  function extensoAte999(n) {
    if (n === 0) return "";
    if (n === 100) return "cem";
    var centena = Math.floor(n / 100), resto = n % 100;
    var partes = [];
    if (centena) partes.push(CENTENAS[centena]);
    if (resto) {
      if (resto < 10) partes.push(UNIDADES[resto]);
      else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
      else {
        var dezena = Math.floor(resto / 10), unidade = resto % 10;
        partes.push(DEZENAS[dezena] + (unidade ? " e " + UNIDADES[unidade] : ""));
      }
    }
    return partes.join(" e ");
  }

  function numeroExtenso(numero) {
    var n = Math.floor(Math.abs(Number(numero) || 0));
    if (n === 0) return "zero";
    var escalas = [
      { valor: 1000000000, singular: "bilhão", plural: "bilhões" },
      { valor: 1000000, singular: "milhão", plural: "milhões" },
      { valor: 1000, singular: "mil", plural: "mil" }
    ];
    var partes = [];
    var resto = n;
    escalas.forEach(function (escala) {
      var quantidade = Math.floor(resto / escala.valor);
      if (quantidade > 0) {
        if (escala.valor === 1000 && quantidade === 1) partes.push("mil");
        else partes.push(extensoAte999(quantidade) + " " + (quantidade === 1 ? escala.singular : escala.plural));
        resto = resto % escala.valor;
      }
    });
    if (resto > 0 || !partes.length) partes.push(extensoAte999(resto) || "zero");
    return partes.join(" e ");
  }

  function valorExtenso(valor) {
    var v = Number(valor) || 0;
    var reaisInteiros = Math.floor(v);
    var centavos = Math.round((v - reaisInteiros) * 100);
    var partes = [];
    if (reaisInteiros > 0 || centavos === 0) {
      partes.push(numeroExtenso(reaisInteiros) + " " + (reaisInteiros === 1 ? "real" : "reais"));
    }
    if (centavos > 0) {
      partes.push(numeroExtenso(centavos) + " " + (centavos === 1 ? "centavo" : "centavos"));
    }
    return partes.join(" e ") || "zero reais";
  }

  function dataExtenso(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    var ano = m[1], mes = Number(m[2]), dia = Number(m[3]);
    return dia + " de " + (MESES_EXTENSO[mes - 1] || "") + " de " + ano;
  }

  function dataHojeISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function formatarDataISOparaBR(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
  }

  function parseMoedaParaNumero(txt) {
    var limpo = String(txt || "").trim().replace(/\./g, "").replace(",", ".");
    return Number(limpo) || 0;
  }

  function parseDataBRparaISO(txt) {
    var m = String(txt || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
  }

  function mascaraCNPJ(valorCru) {
    var d = String(valorCru || "").replace(/\D/g, "").slice(0, 14);
    var saida = "";
    if (d.length > 0) saida = d.slice(0, 2);
    if (d.length > 2) saida += "." + d.slice(2, 5);
    if (d.length > 5) saida += "." + d.slice(5, 8);
    if (d.length > 8) saida += "/" + d.slice(8, 12);
    if (d.length > 12) saida += "-" + d.slice(12, 14);
    return saida;
  }

  function humanizaNome(nome) {
    return String(nome || "").replace(/_/g, " ").replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
  }

  /* ============================================================
     MARCAÇÃO LEVE DO MODELO -> blocos
     # título | ## seção | - item de lista | @ Nome (Papel) assinatura
     coluna|coluna tabela (comece a linha com ! pra virar cabeçalho)
     ?campo? no início da linha: ela só aparece se esse campo numérico
     estiver preenchido e for maior que zero (ex.: a linha das fotos)
     ============================================================ */
  function analisaModelo(texto) {
    var linhas = String(texto || "").replace(/\r\n/g, "\n").split("\n");
    var blocos = [];
    var paragrafoAtual = [];
    var paragrafoCondicao = null;
    var listaAtual = null;
    var tabelaAtual = null;

    function fechaParagrafo() {
      if (paragrafoAtual.length) {
        blocos.push({ tipo: "paragrafo", texto: paragrafoAtual.join(" "), condicao: paragrafoCondicao });
        paragrafoAtual = [];
        paragrafoCondicao = null;
      }
    }
    function fechaLista() {
      if (listaAtual) { blocos.push(listaAtual); listaAtual = null; }
    }
    function fechaTabela() {
      if (tabelaAtual) { blocos.push(tabelaAtual); tabelaAtual = null; }
    }

    linhas.forEach(function (linhaOriginal) {
      var condicao = null;
      var linha = linhaOriginal;
      var mCond = linha.match(/^\?([a-zA-Z0-9_]+)\?(.*)$/);
      if (mCond) { condicao = mCond[1]; linha = mCond[2]; }
      var linhaTrim = linha.trim();

      if (!linhaTrim) { fechaParagrafo(); fechaLista(); fechaTabela(); return; }

      if (linhaTrim.indexOf("## ") === 0) {
        fechaParagrafo(); fechaLista(); fechaTabela();
        blocos.push({ tipo: "secao", texto: linhaTrim.slice(3).trim() });
      } else if (linhaTrim.indexOf("# ") === 0) {
        fechaParagrafo(); fechaLista(); fechaTabela();
        blocos.push({ tipo: "titulo", texto: linhaTrim.slice(2).trim() });
      } else if (linhaTrim.indexOf("- ") === 0) {
        fechaParagrafo(); fechaTabela();
        if (!listaAtual) listaAtual = { tipo: "lista", itens: [] };
        listaAtual.itens.push({ texto: linhaTrim.slice(2).trim(), condicao: condicao });
      } else if (linhaTrim.charAt(0) === "@") {
        fechaParagrafo(); fechaLista(); fechaTabela();
        var restoAssinatura = linhaTrim.slice(1).trim();
        var mAssin = restoAssinatura.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        blocos.push({ tipo: "assinatura", nome: mAssin ? mAssin[1] : restoAssinatura, papel: mAssin ? mAssin[2] : "", condicao: condicao });
      } else if (linhaTrim.charAt(0) === "!" && linhaTrim.indexOf("|") !== -1) {
        fechaParagrafo(); fechaLista();
        if (!tabelaAtual) tabelaAtual = { tipo: "tabela", linhas: [], cabecalho: true };
        tabelaAtual.linhas.push(linhaTrim.slice(1).split("|").map(function (c) { return c.trim(); }));
      } else if (linhaTrim.indexOf("|") !== -1) {
        fechaParagrafo(); fechaLista();
        if (!tabelaAtual) tabelaAtual = { tipo: "tabela", linhas: [], cabecalho: false };
        tabelaAtual.linhas.push(linhaTrim.split("|").map(function (c) { return c.trim(); }));
      } else {
        fechaLista(); fechaTabela();
        if (!paragrafoAtual.length) paragrafoCondicao = condicao;
        paragrafoAtual.push(linhaTrim);
      }
    });
    fechaParagrafo(); fechaLista(); fechaTabela();
    return blocos;
  }

  /* detecta os {{campos}} do texto do modelo, na ordem em que aparecem.
     {{campo_extenso}} não entra como campo próprio: ele é gerado a
     partir do campo principal, então só conta o nome base. */
  function camposDoTexto(texto) {
    var vistos = {};
    var lista = [];
    var re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    var m;
    while ((m = re.exec(String(texto || "")))) {
      var nome = m[1].replace(/_extenso$/, "");
      if (vistos[nome]) continue;
      vistos[nome] = true;
      lista.push({ nome: nome, def: CAMPOS_CONHECIDOS[nome] || { rotulo: humanizaNome(nome), tipo: "texto" } });
    }
    return lista;
  }

  /* ---------- substituição dos campos ---------- */

  function substituiTexto(texto, valores) {
    return String(texto || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (m, nome) {
      return valores[nome] != null ? valores[nome] : "";
    });
  }

  function destacaCampos(texto, valores) {
    var escapado = A.esc(texto);
    return escapado.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (m, nome) {
      var valor = valores[nome];
      if (valor != null && String(valor).trim() !== "") return A.esc(String(valor));
      return '<mark class="contrato-campo-vazio">{{' + nome + "}}</mark>";
    });
  }

  function avaliaCondicao(condicao, crus) {
    if (!condicao) return true;
    var v = crus[condicao];
    var n = Number(v);
    if (v !== undefined && v !== "" && !isNaN(n)) return n > 0;
    return !!(v && String(v).trim());
  }

  function montarBlocosResolvidos(blocos, valores, crus) {
    var saida = [];
    blocos.forEach(function (b) {
      if ((b.tipo === "paragrafo" || b.tipo === "assinatura") && !avaliaCondicao(b.condicao, crus)) return;
      if (b.tipo === "titulo" || b.tipo === "secao" || b.tipo === "paragrafo") {
        saida.push({ tipo: b.tipo, texto: substituiTexto(b.texto, valores) });
      } else if (b.tipo === "lista") {
        var itens = b.itens.filter(function (it) { return avaliaCondicao(it.condicao, crus); }).map(function (it) { return substituiTexto(it.texto, valores); });
        if (itens.length) saida.push({ tipo: "lista", itens: itens });
      } else if (b.tipo === "tabela") {
        saida.push({ tipo: "tabela", cabecalho: !!b.cabecalho, linhas: b.linhas.map(function (linha) { return linha.map(function (c) { return substituiTexto(c, valores); }); }) });
      } else if (b.tipo === "assinatura") {
        saida.push({ tipo: "assinatura", nome: substituiTexto(b.nome, valores), papel: substituiTexto(b.papel || "", valores) });
      }
    });
    return saida;
  }

  function montarPreviaHTML(blocos, valores, crus) {
    var partes = [];
    blocos.forEach(function (b) {
      if ((b.tipo === "paragrafo" || b.tipo === "assinatura") && !avaliaCondicao(b.condicao, crus)) return;
      if (b.tipo === "titulo") partes.push('<p class="contrato-previa-titulo">' + destacaCampos(b.texto, valores) + "</p>");
      else if (b.tipo === "secao") partes.push('<p class="contrato-previa-secao">' + destacaCampos(b.texto, valores) + "</p>");
      else if (b.tipo === "paragrafo") partes.push('<p class="contrato-previa-paragrafo">' + destacaCampos(b.texto, valores) + "</p>");
      else if (b.tipo === "lista") {
        var itens = b.itens.filter(function (it) { return avaliaCondicao(it.condicao, crus); });
        if (!itens.length) return;
        partes.push('<ul class="contrato-previa-lista">' + itens.map(function (it) { return "<li>" + destacaCampos(it.texto, valores) + "</li>"; }).join("") + "</ul>");
      } else if (b.tipo === "tabela") {
        partes.push('<table class="contrato-previa-tabela">' + b.linhas.map(function (linha, i) {
          var tag = b.cabecalho && i === 0 ? "th" : "td";
          return "<tr>" + linha.map(function (c) { return "<" + tag + ">" + destacaCampos(c, valores) + "</" + tag + ">"; }).join("") + "</tr>";
        }).join("") + "</table>");
      } else if (b.tipo === "assinatura") {
        partes.push('<p class="contrato-previa-assinatura">_____________________<br>' + destacaCampos(b.nome, valores) + (b.papel ? " (" + destacaCampos(b.papel, valores) + ")" : "") + "</p>");
      }
    });
    return partes.join("");
  }

  /* ============================================================
     FORMULÁRIO DINÂMICO
     ============================================================ */

  function campoHTML(nome, def) {
    var id = "cfCampo_" + nome;
    var rotulo = def.rotulo || humanizaNome(nome);
    var valorPadrao = typeof def.padrao !== "undefined" ? (def.padrao === "hoje" ? dataHojeISO() : def.padrao) : "";
    var apoio = def.opcional ? ' <span class="texto-apoio" style="font-weight:400">(opcional, deixe em branco ou 0 se não tiver)</span>' : "";
    var inputHTML;
    if (def.tipo === "data") inputHTML = '<input type="date" id="' + id + '" value="' + A.esc(valorPadrao) + '">';
    else if (def.tipo === "numero") inputHTML = '<input type="number" min="0" step="1" id="' + id + '" value="' + A.esc(valorPadrao) + '">';
    else if (def.tipo === "moeda") inputHTML = '<input type="number" min="0" step="0.01" id="' + id + '" placeholder="0,00" value="' + A.esc(valorPadrao) + '">';
    else if (def.tipo === "email") inputHTML = '<input type="email" id="' + id + '" value="' + A.esc(valorPadrao) + '">';
    else if (def.tipo === "cnpj") inputHTML = '<input type="text" inputmode="numeric" placeholder="00.000.000/0000-00" id="' + id + '" value="' + A.esc(valorPadrao) + '">';
    else inputHTML = '<input type="text" id="' + id + '" value="' + A.esc(valorPadrao) + '">';
    return '<label class="campo"><span>' + A.esc(rotulo) + apoio + "</span>" + inputHTML + "</label>";
  }

  function montarCamposFormulario() {
    camposAtuais = camposDoTexto(modeloAtual.texto || "");
    var alvo = document.getElementById("ctCampos");
    if (!alvo) return;
    alvo.innerHTML = camposAtuais.length
      ? camposAtuais.map(function (c) { return campoHTML(c.nome, c.def); }).join("")
      : '<p class="texto-apoio">Escreva o modelo na aba "Editar modelo" pra ver os campos aqui.</p>';

    camposAtuais.forEach(function (c) {
      var el = document.getElementById("cfCampo_" + c.nome);
      if (!el) return;
      if (c.def.tipo === "cnpj") {
        el.addEventListener("input", function () {
          el.value = mascaraCNPJ(el.value);
          atualizarPrevia();
        });
      } else {
        el.addEventListener("input", A.debounce(atualizarPrevia, 150));
      }
    });
  }

  function obterValores() {
    var formatados = {}, crus = {};
    camposAtuais.forEach(function (c) {
      var el = document.getElementById("cfCampo_" + c.nome);
      if (!el) return;
      var bruto = el.value;
      crus[c.nome] = bruto;
      if (c.def.tipo === "moeda") {
        var numero = Number(bruto) || 0;
        formatados[c.nome] = numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (c.def.extenso) formatados[c.nome + "_extenso"] = valorExtenso(numero);
      } else if (c.def.tipo === "numero") {
        var inteiro = Math.floor(Number(bruto) || 0);
        formatados[c.nome] = String(inteiro);
        if (c.def.extenso) formatados[c.nome + "_extenso"] = numeroExtenso(inteiro);
      } else if (c.def.tipo === "data") {
        formatados[c.nome] = formatarDataISOparaBR(bruto);
        if (c.def.extenso) formatados[c.nome + "_extenso"] = dataExtenso(bruto);
      } else {
        formatados[c.nome] = String(bruto || "").trim();
      }
    });
    return { formatados: formatados, crus: crus };
  }

  function validarObrigatorios(crus) {
    var faltando = [];
    camposAtuais.forEach(function (c) {
      if (c.def.opcional) return;
      var v = crus[c.nome];
      if (v === undefined || v === null || String(v).trim() === "") faltando.push(c.def.rotulo || humanizaNome(c.nome));
    });
    return faltando;
  }

  function atualizarPrevia() {
    var obtidos = obterValores();
    var alvo = document.getElementById("ctPrevia");
    if (!alvo) return;
    alvo.innerHTML = montarPreviaHTML(blocosCrus, obtidos.formatados, obtidos.crus) || '<p class="texto-apoio">Escreva o modelo do contrato na aba "Editar modelo" pra ver a prévia aqui.</p>';
  }

  function aplicarCamposNoFormulario(campos) {
    ativarAba("form");
    camposAtuais.forEach(function (c) {
      var el = document.getElementById("cfCampo_" + c.nome);
      if (!el) return;
      var valor = campos[c.nome];
      if (valor == null) return;
      if (c.def.tipo === "moeda") el.value = parseMoedaParaNumero(valor);
      else if (c.def.tipo === "data") el.value = parseDataBRparaISO(valor);
      else el.value = valor;
    });
    atualizarPrevia();
  }

  /* ============================================================
     GERAÇÃO DO PDF (Edge Function) e DOWNLOAD
     ============================================================ */

  function gerarPDF(blocos, logoBase64) {
    return window.banco.auth.getSession().then(function (r) {
      var sessao = r && r.data && r.data.session;
      if (!sessao) return { ok: false, mensagem: "Sua sessão expirou. Recarregue a página e entre de novo." };
      var urlBase = window.URL_PROJETO_SUPABASE;
      if (!urlBase) return { ok: false, mensagem: "Não achei o endereço do projeto (js/banco.js). Recarregue a página." };
      return fetch(urlBase + "/functions/v1/gerar-contrato-pdf", {
        method: "POST",
        headers: { Authorization: "Bearer " + sessao.access_token, "Content-Type": "application/json" },
        body: JSON.stringify({ blocos: blocos, logoBase64: logoBase64 || null })
      }).then(function (resp) {
        var tipo = resp.headers.get("Content-Type") || "";
        if (resp.ok && tipo.indexOf("application/pdf") !== -1) {
          return resp.blob().then(function (blob) { return { ok: true, blob: blob }; });
        }
        return resp.json().catch(function () { return null; }).then(function (corpo) {
          return { ok: false, mensagem: (corpo && corpo.mensagem) || "A função respondeu com um erro." };
        });
      });
    }).catch(function () {
      return { ok: false, mensagem: "Não consegui falar com a função de gerar PDF agora. Confira a sua internet." };
    });
  }

  function baixarBlob(blob, nomeArquivo) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = nomeArquivo;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function blobParaBase64(blob) {
    return new Promise(function (resolve, reject) {
      var leitor = new FileReader();
      leitor.onload = function () { resolve(String(leitor.result || "")); };
      leitor.onerror = reject;
      leitor.readAsDataURL(blob);
    });
  }

  /* ============================================================
     ASSINATURA DIGITAL (via Autentique)
     ============================================================ */

  function chamarAssinatura(corpo) {
    return window.banco.auth.getSession().then(function (r) {
      var sessao = r && r.data && r.data.session;
      if (!sessao) return { ok: false, mensagem: "Sua sessão expirou. Recarregue a página e entre de novo." };
      var urlBase = window.URL_PROJETO_SUPABASE;
      if (!urlBase) return { ok: false, mensagem: "Não achei o endereço do projeto (js/banco.js). Recarregue a página." };
      return fetch(urlBase + "/functions/v1/assinatura-contrato", {
        method: "POST",
        headers: { Authorization: "Bearer " + sessao.access_token, "Content-Type": "application/json" },
        body: JSON.stringify(corpo)
      }).then(function (resp) {
        return resp.json().catch(function () { return null; }).then(function (corpoResp) {
          if (!resp.ok || !corpoResp) return { ok: false, mensagem: (corpoResp && corpoResp.mensagem) || "A função respondeu com um erro." };
          return corpoResp;
        });
      });
    }).catch(function () {
      return { ok: false, mensagem: "Não consegui falar com a função de assinatura agora. Confira a sua internet." };
    });
  }

  function abrirEnvioAssinatura(contratoId, nomeDocumento, blocosResolvidos, valoresParaPreencher) {
    var html =
      '<h2 class="gaveta-titulo">Enviar para assinatura</h2>' +
      '<p class="texto-apoio">Vai pedir a assinatura sua e da marca, pelo Autentique. Confira o e-mail da marca antes de mandar.</p>' +
      '<label class="campo"><span>Nome de quem assina pela marca</span><input type="text" id="eaNome" value="' + A.esc(valoresParaPreencher.representante || "") + '"></label>' +
      '<label class="campo"><span>E-mail de quem assina pela marca</span><input type="email" id="eaEmail" value="' + A.esc(valoresParaPreencher.email_marca || "") + '"></label>' +
      '<p class="erro-campo" id="eaErro" hidden></p>' +
      '<div class="gaveta-acoes"><button type="button" class="botao" id="eaEnviar">Enviar pra assinatura</button></div>';

    A.abrirModal({
      titulo: "Enviar para assinatura",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.querySelector("#eaEnviar").addEventListener("click", function () {
          var nome = document.getElementById("eaNome").value.trim();
          var email = document.getElementById("eaEmail").value.trim();
          var erro = document.getElementById("eaErro");
          if (!email) { erro.hidden = false; erro.textContent = "Preencha o e-mail da marca."; return; }
          erro.hidden = true;
          var botao = document.getElementById("eaEnviar");
          botao.disabled = true; botao.textContent = "Gerando PDF...";
          gerarPDF(blocosResolvidos, logoBase64Atual).then(function (r) {
            if (!r.ok) {
              botao.disabled = false; botao.textContent = "Enviar pra assinatura";
              erro.hidden = false; erro.textContent = r.mensagem || "Não consegui gerar o PDF.";
              return;
            }
            botao.textContent = "Enviando...";
            blobParaBase64(r.blob).then(function (base64) {
              return chamarAssinatura({
                acao: "enviar",
                contratoId: contratoId,
                nomeDocumento: nomeDocumento,
                pdfBase64: base64,
                assinantes: [
                  { nome: "Paloma Ribeiro", email: EMAIL_ASSINATURA_PALOMA },
                  { nome: nome, email: email }
                ]
              });
            }).then(function (resultado) {
              botao.disabled = false; botao.textContent = "Enviar pra assinatura";
              if (!resultado.ok) { erro.hidden = false; erro.textContent = resultado.mensagem || "Não consegui enviar."; return; }
              A.fecharModal();
              A.toast("Contrato enviado para assinatura.", "ok");
            });
          });
        });
      }
    });
  }

  function rotuloStatusAssinatura(status) {
    if (status === "assinado") return "Assinado";
    if (status === "pendente") return "Aguardando assinatura";
    return "Não enviado";
  }

  function limpaNomeArquivo(t) {
    return String(t || "").replace(/[\\/:*?"<>|]/g, "-").trim();
  }

  function montaNomeArquivo(valores) {
    var marca = limpaNomeArquivo(valores.razao_social || "contrato");
    var dataTxt = limpaNomeArquivo(valores.data_assinatura || formatarDataISOparaBR(dataHojeISO()));
    return "Contrato - " + marca + " - " + dataTxt + ".pdf";
  }

  function salvarHistorico(valores) {
    return A.gravar("contratos_gerados", "insert", { valores: { marca: valores.razao_social || "Sem nome", campos: valores } });
  }

  /* ============================================================
     HISTÓRICO
     ============================================================ */

  function abrirHistorico() {
    A.buscar("contratos_gerados", function (q) { return q.order("criado_em", { ascending: false }).limit(100); }).then(function (r) {
      var lista = r.dados || [];
      var html =
        '<h2 class="gaveta-titulo">Histórico de contratos</h2>' +
        (lista.length
          ? '<div class="tabela-scroll"><table class="tabela"><thead><tr><th>Marca</th><th>Gerado em</th><th>Assinatura</th><th></th></tr></thead><tbody>' +
            lista.map(function (h) {
              var acoesAssinatura = h.status_assinatura === "nao_enviado" || !h.status_assinatura
                ? '<button type="button" class="botao botao--linha botao--mini" data-assinar="' + A.esc(h.id) + '">Enviar pra assinatura</button>'
                : h.status_assinatura === "pendente"
                  ? '<button type="button" class="botao botao--linha botao--mini" data-conferir="' + A.esc(h.id) + '">Conferir status</button>'
                  : "";
              return "<tr><td>" + A.esc(h.marca) + "</td><td>" + (A.formatarData(h.criado_em) || "-") + "</td>" +
                '<td data-status-de="' + A.esc(h.id) + '">' + rotuloStatusAssinatura(h.status_assinatura) + "</td>" +
                '<td style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<button type="button" class="botao botao--linha botao--mini" data-usar="' + A.esc(h.id) + '">Usar como base</button>' +
                '<button type="button" class="botao botao--linha botao--mini" data-baixar="' + A.esc(h.id) + '">Baixar de novo</button>' +
                acoesAssinatura + "</td></tr>";
            }).join("") + "</tbody></table></div>"
          : '<p class="texto-apoio">Nenhum contrato gerado ainda.</p>');

      A.abrirModal({
        titulo: "Histórico de contratos",
        corpoHTML: html,
        onMontar: function (caixa) {
          caixa.classList.add("modal-caixa--largo");
          caixa.querySelectorAll("[data-usar]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var item = lista.filter(function (h) { return String(h.id) === btn.dataset.usar; })[0];
              if (!item) return;
              A.fecharModal();
              aplicarCamposNoFormulario(item.campos || {});
            });
          });
          caixa.querySelectorAll("[data-baixar]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var item = lista.filter(function (h) { return String(h.id) === btn.dataset.baixar; })[0];
              if (!item) return;
              btn.disabled = true; btn.textContent = "Gerando...";
              var resolvidos = montarBlocosResolvidos(blocosCrus, item.campos || {}, item.campos || {});
              gerarPDF(resolvidos, logoBase64Atual).then(function (res) {
                btn.disabled = false; btn.textContent = "Baixar de novo";
                if (!res.ok) { A.toast(res.mensagem || "Não consegui gerar o PDF.", "erro"); return; }
                baixarBlob(res.blob, montaNomeArquivo(item.campos || {}));
              });
            });
          });
          caixa.querySelectorAll("[data-assinar]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              var item = lista.filter(function (h) { return String(h.id) === btn.dataset.assinar; })[0];
              if (!item) return;
              var resolvidos = montarBlocosResolvidos(blocosCrus, item.campos || {}, item.campos || {});
              var nomeDoc = montaNomeArquivo(item.campos || {}).replace(/\.pdf$/, "");
              abrirEnvioAssinatura(item.id, nomeDoc, resolvidos, item.campos || {});
            });
          });
          caixa.querySelectorAll("[data-conferir]").forEach(function (btn) {
            btn.addEventListener("click", function () {
              btn.disabled = true; btn.textContent = "Conferindo...";
              chamarAssinatura({ acao: "status", contratoId: btn.dataset.conferir }).then(function (res) {
                btn.disabled = false; btn.textContent = "Conferir status";
                if (!res.ok) { A.toast(res.mensagem || "Não consegui conferir o status.", "erro"); return; }
                var celula = caixa.querySelector('[data-status-de="' + btn.dataset.conferir + '"]');
                if (celula) celula.textContent = rotuloStatusAssinatura(res.status);
                if (res.status === "assinado") { btn.hidden = true; A.toast("Contrato assinado!", "ok"); }
              });
            });
          });
        }
      });
    });
  }

  /* ============================================================
     ABAS / MONTAGEM DA PÁGINA
     ============================================================ */

  function ativarAba(nome) {
    var ehForm = nome === "form";
    var btnForm = document.getElementById("ctAbaForm");
    var btnModelo = document.getElementById("ctAbaModelo");
    if (btnForm) btnForm.setAttribute("aria-pressed", String(ehForm));
    if (btnModelo) btnModelo.setAttribute("aria-pressed", String(!ehForm));
    var painelForm = document.getElementById("ctPainelForm");
    var painelModelo = document.getElementById("ctPainelModelo");
    if (painelForm) painelForm.hidden = !ehForm;
    if (painelModelo) painelModelo.hidden = ehForm;
  }

  function atualizaLogoStatus() {
    var el = document.getElementById("ctLogoStatus");
    if (!el) return;
    el.textContent = logoBase64Atual
      ? "Logo carregada. Ela aparece bem clarinha, como marca d'água, em cada página do PDF."
      : "Nenhuma logo escolhida ainda. Sem ela, o PDF sai sem marca d'água.";
  }

  function montar(raiz) {
    modeloAtual = { texto: "", logo_base64: null };
    logoBase64Atual = null;
    blocosCrus = [];
    camposAtuais = [];

    raiz.innerHTML =
      '<div class="chips-filtro" style="margin-bottom:16px">' +
        '<button type="button" class="chip-filtro" id="ctAbaForm" aria-pressed="true">Preencher contrato</button>' +
        '<button type="button" class="chip-filtro" id="ctAbaModelo" aria-pressed="false">Editar modelo</button>' +
      "</div>" +
      '<div id="ctPainelForm" class="contrato-colunas">' +
        '<div class="cartao cartao-pad">' +
          '<h3 class="bloco-titulo">Dados deste contrato</h3>' +
          '<div id="ctCampos"></div>' +
          '<p class="erro-campo" id="ctErro" hidden></p>' +
          '<div class="gaveta-acoes" style="justify-content:flex-start">' +
            '<button type="button" class="botao" id="ctGerar">' + A.icone("baixar") + "Gerar PDF</button>" +
            '<button type="button" class="botao botao--linha" id="ctHistorico">Histórico</button>' +
            '<button type="button" class="botao botao--linha" id="ctEnviarAssinatura" hidden>Enviar pra assinatura</button>' +
          "</div>" +
        "</div>" +
        '<div class="cartao cartao-pad">' +
          '<h3 class="bloco-titulo">Prévia</h3>' +
          '<div id="ctPrevia" class="contrato-previa"></div>' +
        "</div>" +
      "</div>" +
      '<div id="ctPainelModelo" class="cartao cartao-pad" hidden>' +
        '<h3 class="bloco-titulo">Modelo do contrato</h3>' +
        '<p class="texto-apoio">Escreva aqui o texto do seu contrato. Use # para o título, ## para um título de seção, - para item de lista, @ Nome (Papel) para uma linha de assinatura e coluna|coluna pra criar uma tabela (comece a linha com ! pra ela ser o cabeçalho). Marque o que muda a cada marca com chaves duplas, assim: {{razao_social}}. Pra uma linha só aparecer quando um campo numérico estiver preenchido e maior que zero, comece a linha com ?nome_do_campo? (é assim que a linha das fotos funciona).</p>' +
        '<textarea id="ctModeloTexto" class="contrato-modelo-textarea" spellcheck="false"></textarea>' +
        '<label class="campo-arquivo" id="ctEscolherLogo">' + A.icone("subir") +
          "<span>Clique para escolher a sua logo (PNG ou JPG)</span>" +
          '<input type="file" accept="image/png,image/jpeg" id="ctLogoArquivo">' +
        "</label>" +
        '<p class="texto-apoio" id="ctLogoStatus"></p>' +
        '<p class="erro-campo" id="ctErroModelo" hidden></p>' +
        '<div class="gaveta-acoes" style="justify-content:flex-start">' +
          '<button type="button" class="botao" id="ctSalvarModelo">Salvar modelo</button>' +
        "</div>" +
      "</div>";

    document.getElementById("ctAbaForm").addEventListener("click", function () { ativarAba("form"); });
    document.getElementById("ctAbaModelo").addEventListener("click", function () { ativarAba("modelo"); });

    document.getElementById("ctLogoArquivo").addEventListener("change", function (e) {
      var arquivo = e.target.files && e.target.files[0];
      if (!arquivo) return;
      var leitor = new FileReader();
      leitor.onload = function () { logoBase64Atual = String(leitor.result || ""); atualizaLogoStatus(); };
      leitor.readAsDataURL(arquivo);
    });

    document.getElementById("ctSalvarModelo").addEventListener("click", function () {
      var texto = document.getElementById("ctModeloTexto").value;
      var erro = document.getElementById("ctErroModelo");
      var botao = document.getElementById("ctSalvarModelo");
      botao.disabled = true; botao.textContent = "Salvando...";
      A.gravar("contrato_modelo", "update", { id: 1, valores: { texto: texto, logo_base64: logoBase64Atual, atualizado_em: new Date().toISOString() } }).then(function (r) {
        botao.disabled = false; botao.textContent = "Salvar modelo";
        if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Confira se já rodou o SQL do gerador de contratos no Supabase."; return; }
        erro.hidden = true;
        modeloAtual.texto = texto;
        blocosCrus = analisaModelo(texto);
        montarCamposFormulario();
        atualizarPrevia();
        A.toast("Modelo salvo.", "ok");
      });
    });

    document.getElementById("ctGerar").addEventListener("click", function () {
      var obtidos = obterValores();
      var faltando = validarObrigatorios(obtidos.crus);
      var erro = document.getElementById("ctErro");
      if (faltando.length) {
        erro.hidden = false;
        erro.textContent = "Preencha antes: " + faltando.join(", ") + ".";
        return;
      }
      erro.hidden = true;
      var blocosResolvidos = montarBlocosResolvidos(blocosCrus, obtidos.formatados, obtidos.crus);
      var botao = document.getElementById("ctGerar");
      botao.disabled = true; botao.textContent = "Gerando...";
      gerarPDF(blocosResolvidos, logoBase64Atual).then(function (r) {
        botao.disabled = false; botao.textContent = "Gerar PDF";
        if (!r.ok) { erro.hidden = false; erro.textContent = r.mensagem || "Não consegui gerar o PDF. Tenta de novo."; return; }
        baixarBlob(r.blob, montaNomeArquivo(obtidos.formatados));
        A.toast("Contrato gerado.", "ok");
        salvarHistorico(obtidos.formatados).then(function (rHist) {
          if (!rHist.ok || !rHist.dados || !rHist.dados[0]) return;
          var contratoId = rHist.dados[0].id;
          var nomeDoc = montaNomeArquivo(obtidos.formatados).replace(/\.pdf$/, "");
          var botaoAssinatura = document.getElementById("ctEnviarAssinatura");
          botaoAssinatura.hidden = false;
          botaoAssinatura.onclick = function () {
            abrirEnvioAssinatura(contratoId, nomeDoc, blocosResolvidos, obtidos.formatados);
          };
        });
      });
    });

    document.getElementById("ctHistorico").addEventListener("click", abrirHistorico);

    carregar();
  }

  function carregar() {
    A.buscar("contrato_modelo", function (q) { return q.eq("id", 1); }).then(function (r) {
      var linha = (r.dados && r.dados[0]) || { texto: "", logo_base64: null };
      modeloAtual = linha;
      logoBase64Atual = linha.logo_base64 || null;
      var textoEl = document.getElementById("ctModeloTexto");
      if (textoEl) textoEl.value = linha.texto || "";
      atualizaLogoStatus();
      blocosCrus = analisaModelo(linha.texto || "");
      montarCamposFormulario();
      atualizarPrevia();
    });
  }

  window.Admin.registrarSecao({
    id: "contratos",
    grupo: "minha rotina",
    nome: "Contratos",
    legenda: "Gere os seus contratos de UGC/publi em PDF.",
    icone: "contrato",
    montar: montar
  });
})();
