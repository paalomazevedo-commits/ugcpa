/* ============================================================
   ABA PROSPECÇÃO
   Manda o e-mail de apresentação da Paloma pra várias marcas da
   base de uma vez, chamando cada uma pelo nome. Os destinatários
   SEMPRE vêm da aba Marcas (nunca um cadastro à parte). O envio de
   verdade passa pela Edge Function "enviar-emails" (o carteiro),
   que é quem fala com o Resend - esta aba nunca vê a chave do
   Resend, só manda o pedido pra função com o seu login.

   Se o Resend ainda não tiver um domínio verificado, tem o modo
   rascunho: monta o e-mail de cada marca e abre pronto no Gmail,
   sem precisar do Resend.
   ============================================================ */
(function () {
  var A = window.Admin;

  var EMAIL_CONTATO = "paalomazevedo@gmail.com";
  var EMAIL_LOGIN = "paalomazevedo@gmail.com";
  var MEU_NOME = "Paloma Ribeiro";
  var TAMANHO_LOTE_ENVIO = 100;

  var ROTULOS_SITUACAO = {
    lead: { filtro: "Só os leads", pilula: "Lead" },
    conversando: { filtro: "Só quem está conversando", pilula: "Conversando" },
    cliente: { filtro: "Só quem já é cliente", pilula: "Cliente" },
    parada: { filtro: "Só quem está parada", pilula: "Parada" }
  };
  var ORDEM_SITUACOES = ["lead", "conversando", "cliente", "parada"];

  // ---------- estado da aba ----------
  var todasMarcas = [];
  var envios = [];
  var optouts = [];
  var statusCarregamento = { marcas: true, envios: true, optouts: true };

  var filtroAtivo = "selecionadas";
  var modoEscrita = "texto";       // "texto" | "html"
  var modoEnvio = "automatico";    // "automatico" | "rascunho"
  var assuntoAtual = "";
  var corpoTextoAtual = "";
  var corpoHtmlColadoAtual = "";
  var botaoTexto = "";
  var botaoLink = "";
  var pularRepetidos = true;

  var filaRascunho = [];
  var enviando = false;

  /* ============================================================
     FUNÇÕES PEQUENAS DE APOIO
     ============================================================ */
  function primeiroNomeDe(nomeMarca) {
    var limpo = String(nomeMarca || "").trim();
    if (!limpo) return "";
    return limpo.split(/\s+/)[0];
  }

  function personalizar(texto, nomeMarca) {
    var primeiro = primeiroNomeDe(nomeMarca);
    return String(texto || "")
      .replace(/\{\{\s*nome\s*\}\}/gi, primeiro)
      .replace(/\{\{\s*marca\s*\}\}/gi, nomeMarca || "");
  }

  function linkificar(textoEscapado) {
    return textoEscapado.replace(
      /((https?:\/\/|www\.)[^\s<]+)/gi,
      function (m) {
        var href = /^https?:\/\//i.test(m) ? m : "https://" + m;
        return '<a href="' + href + '" style="color:#1f4e9c;text-decoration:underline">' + m + "</a>";
      }
    );
  }

  function quebrasDeLinha(textoEscapado) {
    return textoEscapado.replace(/\n/g, "<br>\n");
  }

  // monta o HTML completo do modo "texto fácil": fundo branco, largura
  // máxima de 560px, o texto digitado, o botão quando preenchido e o
  // rodapé do SAIR. {{nome}} e {{marca}} continuam como estão aqui -
  // só são trocados depois, na hora de mostrar a prévia ou de mandar.
  function montarHTMLTextoFacil(corpoPlano, botaoTxt, botaoHref) {
    var corpoHTML = quebrasDeLinha(linkificar(A.esc(corpoPlano)));
    var blocoBotao = "";
    if (botaoTxt && botaoHref) {
      blocoBotao =
        '<tr><td align="center" style="padding:6px 28px 26px;">' +
          '<a href="' + A.esc(botaoHref) + '" style="display:inline-block;background:#1f4e9c;color:#ffffff;text-decoration:none;' +
          'font-weight:600;padding:12px 26px;border-radius:4px;font-size:14px;font-family:Arial,Helvetica,sans-serif;">' +
          A.esc(botaoTxt) + "</a></td></tr>";
    }
    return (
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f2;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">' +
        '<tr><td align="center">' +
          '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;" cellpadding="0" cellspacing="0">' +
            '<tr><td style="padding:32px 28px 10px;color:#16233b;font-size:15px;line-height:1.65;">' + corpoHTML + "</td></tr>" +
            blocoBotao +
            '<tr><td style="padding:22px 28px 28px;border-top:1px solid #eceae2;margin-top:10px;">' +
              '<p style="margin:0;font-size:12px;color:#8791a5;line-height:1.5;">Se não quiser mais receber e-mails como este, é só responder com a palavra SAIR.</p>' +
            "</td></tr>" +
          "</table>" +
        "</td></tr>" +
      "</table>"
    );
  }

  // devolve o HTML final (com {{nome}}/{{marca}} ainda por trocar) de
  // acordo com o modo ativo no momento
  function htmlAtualDoModo() {
    if (modoEscrita === "html") return corpoHtmlColadoAtual;
    return montarHTMLTextoFacil(corpoTextoAtual, botaoTexto, botaoLink);
  }

  function temPalavraSair(html) {
    return /sair/i.test(String(html || ""));
  }

  /* ============================================================
     DESTINATÁRIOS (sempre a partir da tabela marcas)
     ============================================================ */
  function construirOpcoesFiltro() {
    var opcoes = [
      { id: "selecionadas", rotulo: "Só as marcas selecionadas" },
      { id: "teste", rotulo: "Só pra mim (teste)" },
      { id: "todas", rotulo: "Todas as marcas com e-mail" }
    ];
    var porSituacao = {};
    todasMarcas.forEach(function (m) { if (m.situacao) porSituacao[m.situacao] = (porSituacao[m.situacao] || 0) + 1; });
    ORDEM_SITUACOES.forEach(function (s) {
      if (porSituacao[s]) opcoes.push({ id: "situacao:" + s, rotulo: ROTULOS_SITUACAO[s].filtro });
    });
    Object.keys(porSituacao).forEach(function (s) {
      if (ORDEM_SITUACOES.indexOf(s) === -1) opcoes.push({ id: "situacao:" + s, rotulo: 'Só "' + s + '"' });
    });
    return opcoes;
  }

  function listaBaseParaFiltro(id) {
    if (id === "selecionadas") return todasMarcas.filter(function (m) { return m.selecionada; });
    if (id === "teste") return [{ id: null, nome: MEU_NOME, email: EMAIL_LOGIN }];
    if (id === "todas") return todasMarcas;
    if (id.indexOf("situacao:") === 0) {
      var s = id.slice(9);
      return todasMarcas.filter(function (m) { return m.situacao === s; });
    }
    return [];
  }

  // devolve { lista (sem repetido, com e-mail), semEmail, duplicados }
  function calcularDestinatarios(id) {
    var base = listaBaseParaFiltro(id);
    var comEmail = base.filter(function (m) { return (m.email || "").trim(); });
    var semEmail = base.length - comEmail.length;
    var vistos = {}, finalLista = [];
    comEmail.forEach(function (m) {
      var email = m.email.trim().toLowerCase();
      if (vistos[email]) return;
      vistos[email] = true;
      finalLista.push(m);
    });
    return { lista: finalLista, semEmail: semEmail, duplicados: comEmail.length - finalLista.length };
  }

  function jaReceberamEsteAssunto(lista, assunto) {
    if (!pularRepetidos || !assunto) return {};
    var feito = {};
    envios.forEach(function (e) {
      if (e.status === "ok" && e.assunto === assunto) feito[String(e.email || "").trim().toLowerCase()] = true;
    });
    var mapa = {};
    lista.forEach(function (m) { if (feito[(m.email || "").trim().toLowerCase()]) mapa[m.id || m.email] = true; });
    return mapa;
  }

  /* ============================================================
     MONTAR A ABA
     ============================================================ */
  function montar(raiz) {
    filtroAtivo = "selecionadas";
    modoEscrita = "texto";
    modoEnvio = "automatico";
    assuntoAtual = ""; corpoTextoAtual = ""; corpoHtmlColadoAtual = ""; botaoTexto = ""; botaoLink = "";
    pularRepetidos = true;
    filaRascunho = [];

    raiz.innerHTML = '<p class="estado-vazio">Carregando a sua prospecção…</p>';

    Promise.all([
      A.buscar("marcas", function (q) { return q.order("nome", { ascending: true }); }),
      A.buscar("email_envios", function (q) { return q.order("criado_em", { ascending: false }); }),
      A.buscar("email_optout", function (q) { return q.order("criado_em", { ascending: false }); })
    ]).then(function (resultados) {
      todasMarcas = resultados[0].dados;
      envios = resultados[1].dados;
      optouts = resultados[2].dados;
      statusCarregamento = { marcas: resultados[0].ok, envios: resultados[1].ok, optouts: resultados[2].ok };
      renderizar(raiz);
    });
  }

  function carregar() { A.irPara("prospeccao"); }

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  function renderizar(raiz) {
    var totalEnviados = statusCarregamento.envios ? envios.filter(function (e) { return e.status === "ok"; }).length : null;
    var baseComEmail = statusCarregamento.marcas ? todasMarcas.filter(function (m) { return (m.email || "").trim(); }).length : null;
    var jaReceberamBase = statusCarregamento.marcas ? todasMarcas.filter(function (m) { return m.ultimo_email_em; }).length : null;
    var falhasBase = statusCarregamento.envios ? envios.filter(function (e) { return e.status === "erro"; }).length : null;
    var descadastradosBase = statusCarregamento.optouts ? optouts.length : null;
    var destAtual = calcularDestinatarios(filtroAtivo);

    raiz.innerHTML =
      capaHTML(totalEnviados) +
      cartoesHTML(baseComEmail, destAtual.lista.length, jaReceberamBase, falhasBase, descadastradosBase) +
      corpoPrincipalHTML() +
      historicoHTML();

    ligarCapaECartoes(raiz);

    if (!baseComEmailDisponivel()) {
      document.getElementById("ppBaseVaziaBotao").addEventListener("click", function () { A.irPara("marcas"); });
      return; // nada mais pra ligar: o formulário nem foi desenhado
    }

    ligarFormulario(raiz);
    ligarHistorico(raiz);
    ligarDescadastro(raiz);
    atualizarPrevia();
  }

  function baseComEmailDisponivel() {
    return !statusCarregamento.marcas || todasMarcas.some(function (m) { return (m.email || "").trim(); });
  }

  /* ---------- CAPA ---------- */
  function capaHTML(totalEnviados) {
    return (
      '<div class="prosp-capa">' +
        '<div class="prosp-capa-topo">' +
          '<div class="prosp-capa-icone">' + A.icone("envelope") + "</div>" +
          '<div class="prosp-capa-texto">' +
            "<h2>Prospecção</h2>" +
            "<p>Manda o seu e-mail de apresentação pra várias marcas de uma vez, chamando cada uma pelo nome.</p>" +
          "</div>" +
          '<div class="prosp-capa-numero">' +
            '<span class="prosp-capa-numero-valor">' + (totalEnviados === null ? "-" : totalEnviados) + "</span>" +
            '<span class="prosp-capa-numero-legenda">enviados até agora</span>' +
          "</div>" +
        "</div>" +
        '<div class="prosp-capa-etiquetas">' +
          '<span class="prosp-etiqueta">teste antes sempre</span>' +
          '<span class="prosp-etiqueta">a chave vive no Supabase</span>' +
          '<span class="prosp-etiqueta">quem responde SAIR sai da lista</span>' +
        "</div>" +
      "</div>"
    );
  }

  /* ---------- CARTÕES ---------- */
  function cartaoHTML(cor, valor, rotulo, contexto) {
    return (
      '<div class="prosp-cartao prosp-cartao--' + cor + '">' +
        '<span class="prosp-cartao-valor">' + (valor === null ? "-" : valor) + "</span>" +
        '<span class="prosp-cartao-rotulo">' + rotulo + "</span>" +
        (contexto ? '<span class="prosp-cartao-contexto">' + contexto + "</span>" : "") +
      "</div>"
    );
  }

  function cartoesHTML(comEmail, aEnviar, jaReceberam, falhas, descadastrados) {
    return (
      '<div class="prosp-cartoes">' +
        cartaoHTML("principal", comEmail, "na base com e-mail", "") +
        cartaoHTML("azul", aEnviar, "a enviar agora", "no filtro escolhido") +
        cartaoHTML("verde", jaReceberam, "já receberam", "alguma vez") +
        cartaoHTML("ambar", falhas, "falhas no envio", "no histórico") +
        cartaoHTML("vermelho", descadastrados, "descadastrados", "nunca mais recebem") +
      "</div>"
    );
  }

  function ligarCapaECartoes() { /* nada clicável aqui por enquanto */ }

  /* ---------- CORPO PRINCIPAL (formulário + prévia) ---------- */
  function corpoPrincipalHTML() {
    if (!baseComEmailDisponivel()) {
      return (
        '<div class="cartao cartao-pad" style="margin-bottom:22px">' +
          '<p class="estado-vazio" style="border:0;padding:10px 4px">' +
            "A sua base ainda está sem nenhuma marca com e-mail cadastrado. Cadastre ou importe a sua planilha na aba Marcas primeiro, aí a Prospecção libera." +
          "</p>" +
          '<div style="text-align:center;margin-top:6px">' +
            '<button type="button" class="botao" id="ppBaseVaziaBotao">Ir pra Marcas</button>' +
          "</div>" +
        "</div>"
      );
    }

    return (
      '<div class="prosp-modo-envio">' +
        '<span class="prosp-modo-envio-rotulo">Como enviar</span>' +
        '<div class="chips-filtro">' +
          '<button type="button" class="chip-filtro" data-modo-envio="automatico" aria-pressed="true">Automático (Resend)</button>' +
          '<button type="button" class="chip-filtro" data-modo-envio="rascunho" aria-pressed="false">Rascunho (sem Resend)</button>' +
        "</div>" +
        '<p class="texto-apoio" style="margin:6px 0 0">No modo automático, a função manda pelo Resend sozinha. No modo rascunho, eu monto cada e-mail e abro pronto no seu Gmail, pra você clicar em enviar - funciona mesmo sem domínio verificado.</p>' +
      "</div>" +

      '<div class="prosp-grid">' +
        '<div class="prosp-form-col">' +
          blocoEscolherDestinatariosHTML() +
          blocoEscreverHTML() +
          '<div id="ppBlocoEnvio"></div>' +
        "</div>" +
        '<div class="prosp-preview-col">' +
          blocoPreviaHTML() +
        "</div>" +
      "</div>"
    );
  }

  function blocoEscolherDestinatariosHTML() {
    var opcoes = construirOpcoesFiltro();
    return (
      '<div class="cartao cartao-pad prosp-bloco">' +
        '<h3 class="bloco-titulo">Pra quem vai</h3>' +
        '<p class="texto-apoio" style="margin-bottom:12px">Os e-mails vêm da sua aba Marcas.</p>' +
        '<div class="chips-filtro" id="ppFiltroChips">' +
          opcoes.map(function (o) {
            return '<button type="button" class="chip-filtro" data-filtro="' + A.esc(o.id) + '" aria-pressed="' + (o.id === filtroAtivo) + '">' + A.esc(o.rotulo) + "</button>";
          }).join("") +
        "</div>" +
        '<div id="ppContagemDestinatarios" class="prosp-contagem"></div>' +
        '<label class="campo-check" style="margin-top:4px"><input type="checkbox" id="ppPularRepetidos"' + (pularRepetidos ? " checked" : "") + "> Pular quem já recebeu este mesmo assunto</label>" +
      "</div>"
    );
  }

  function blocoEscreverHTML() {
    return (
      '<div class="cartao cartao-pad prosp-bloco">' +
        '<h3 class="bloco-titulo">Escrever o e-mail</h3>' +
        '<div class="chips-filtro" style="margin-bottom:16px">' +
          '<button type="button" class="chip-filtro" data-modo-escrita="texto" aria-pressed="' + (modoEscrita === "texto") + '">Texto fácil</button>' +
          '<button type="button" class="chip-filtro" data-modo-escrita="html" aria-pressed="' + (modoEscrita === "html") + '">HTML</button>' +
        "</div>" +
        '<label class="campo"><span>Assunto</span><input type="text" id="ppAssunto" placeholder="Um assunto curto, direto" value="' + A.esc(assuntoAtual) + '"></label>' +
        '<div id="ppCorpoModo"></div>' +
      "</div>"
    );
  }

  function corpoModoTextoHTML() {
    return (
      '<label class="campo"><span>O seu texto</span>' +
        '<textarea id="ppCorpoTexto" style="min-height:190px" placeholder="Oi {{nome}}, tudo bem? Meu nome é Paloma e eu crio conteúdo (UGC) pra marcas como a {{marca}}...">' + A.esc(corpoTextoAtual) + "</textarea>" +
      "</label>" +
      '<p class="texto-apoio" style="margin-top:-8px">Use {{nome}} e {{marca}} onde quiser que entre o nome da marca. Links que você escrever viram clicáveis sozinhos.</p>' +
      '<div class="campo-linha">' +
        '<label class="campo"><span>Texto do botão (opcional)</span><input type="text" id="ppBotaoTexto" placeholder="Ver meu portfólio" value="' + A.esc(botaoTexto) + '"></label>' +
        '<label class="campo"><span>Link do botão</span><input type="text" id="ppBotaoLink" placeholder="https://..." value="' + A.esc(botaoLink) + '"></label>' +
      "</div>"
    );
  }

  function corpoModoHtmlHTML() {
    return (
      '<label class="campo"><span>O seu HTML</span>' +
        '<textarea id="ppCorpoHtml" style="min-height:220px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.82rem" placeholder="Cole aqui o HTML pronto do seu e-mail">' + A.esc(corpoHtmlColadoAtual) + "</textarea>" +
      "</label>" +
      '<p class="texto-apoio" style="margin-top:-8px">{{nome}} e {{marca}} também funcionam aqui dentro. O que você colar é exatamente o que sai - não esqueça o rodapé do SAIR.</p>' +
      '<button type="button" class="botao botao--linha" id="ppComecarModelo">Começar do modelo pronto</button>'
    );
  }

  function blocoPreviaHTML() {
    return (
      '<div class="prosp-palco">' +
        '<button type="button" class="botao botao--linha botao--mini" id="ppTelaCheia" style="margin-bottom:10px">' + A.icone("tela") + "Ver em tela cheia</button>" +
        '<div class="prosp-janela-email" id="ppJanelaPrevia"></div>' +
      "</div>" +
      '<p class="texto-apoio" style="margin-top:10px">Lembrete: manda o teste pra você mesma e abre no celular antes de disparar de verdade.</p>'
    );
  }

  function janelaPreviaHTML(exemploNome, assunto, html) {
    var inicial = (MEU_NOME || "P").trim().charAt(0).toUpperCase();
    return (
      '<div class="prosp-janela-cabecalho">' +
        '<div class="prosp-janela-avatar">' + A.esc(inicial) + "</div>" +
        '<div>' +
          '<p class="prosp-janela-assunto">' + (A.esc(assunto) || "(sem assunto)") + "</p>" +
          '<p class="prosp-janela-de">' + A.esc(MEU_NOME) + " &lt;" + A.esc(EMAIL_CONTATO) + "&gt; para você</p>" +
        "</div>" +
      "</div>" +
      '<div class="prosp-janela-corpo">' + html + "</div>"
    );
  }

  /* ---------- HISTÓRICO ---------- */
  function historicoHTML() {
    return (
      '<div class="cartao cartao-pad" style="margin-top:24px">' +
        '<h3 class="bloco-titulo">Histórico de envios</h3>' +
        (statusCarregamento.envios
          ? (
            '<div class="busca" style="max-width:280px;margin-bottom:12px">' + A.icone("busca") + '<input type="text" id="ppBuscaHistorico" placeholder="Buscar por e-mail"></div>' +
            '<div class="tabela-scroll"><table class="tabela"><thead><tr><th>E-mail</th><th>Assunto</th><th>Quando</th><th>Status</th></tr></thead><tbody id="ppTabelaHistorico"></tbody></table></div>'
          )
          : '<p class="estado-vazio">Ainda não consegui ler o histórico (a tabela email_envios talvez não exista ainda). O resto da aba continua funcionando.</p>'
        ) +
      "</div>" +
      '<div class="cartao cartao-pad" style="margin-top:16px">' +
        '<h3 class="bloco-titulo">Descadastro manual</h3>' +
        '<p class="texto-apoio">Quando alguém responder "SAIR" na sua caixa de e-mail normal, cole o e-mail aqui pra ele nunca mais receber prospecção.</p>' +
        '<div class="campo-linha" style="align-items:end">' +
          '<label class="campo" style="margin-bottom:0"><span>E-mail</span><input type="email" id="ppDescadastrarEmail" placeholder="marca@exemplo.com"></label>' +
          '<button type="button" class="botao botao--linha" id="ppDescadastrarBotao">Adicionar ao descadastro</button>' +
        "</div>" +
      "</div>"
    );
  }

  /* ============================================================
     LIGAÇÕES (eventos)
     ============================================================ */
  function ligarFormulario(raiz) {
    document.querySelectorAll('[data-modo-envio]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        modoEnvio = btn.dataset.modoEnvio;
        document.querySelectorAll('[data-modo-envio]').forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        renderizarBlocoEnvio();
      });
    });

    document.querySelectorAll('#ppFiltroChips [data-filtro]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        filtroAtivo = btn.dataset.filtro;
        document.querySelectorAll('#ppFiltroChips [data-filtro]').forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        atualizarContagemDestinatarios();
        atualizarPrevia();
        atualizarCartaoAEnviar();
      });
    });

    document.getElementById("ppPularRepetidos").addEventListener("change", function (e) {
      pularRepetidos = e.target.checked;
      atualizarContagemDestinatarios();
    });

    document.querySelectorAll('[data-modo-escrita]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        modoEscrita = btn.dataset.modoEscrita;
        document.querySelectorAll('[data-modo-escrita]').forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
        renderizarCorpoModo();
      });
    });

    document.getElementById("ppAssunto").addEventListener("input", A.debounce(function (e) {
      assuntoAtual = e.target.value;
      atualizarContagemDestinatarios();
      atualizarPrevia();
    }, 150));

    renderizarCorpoModo();
    atualizarContagemDestinatarios();
    renderizarBlocoEnvio();
  }

  function renderizarCorpoModo() {
    var alvo = document.getElementById("ppCorpoModo");
    alvo.innerHTML = modoEscrita === "texto" ? corpoModoTextoHTML() : corpoModoHtmlHTML();

    if (modoEscrita === "texto") {
      document.getElementById("ppCorpoTexto").addEventListener("input", A.debounce(function (e) { corpoTextoAtual = e.target.value; atualizarPrevia(); }, 150));
      document.getElementById("ppBotaoTexto").addEventListener("input", A.debounce(function (e) { botaoTexto = e.target.value; atualizarPrevia(); }, 150));
      document.getElementById("ppBotaoLink").addEventListener("input", A.debounce(function (e) { botaoLink = e.target.value; atualizarPrevia(); }, 150));
    } else {
      document.getElementById("ppCorpoHtml").addEventListener("input", A.debounce(function (e) { corpoHtmlColadoAtual = e.target.value; atualizarPrevia(); }, 150));
      document.getElementById("ppComecarModelo").addEventListener("click", function () {
        var modelo = montarHTMLTextoFacil(corpoTextoAtual || "Oi {{nome}}, tudo bem?\n\nMeu nome é Paloma e eu crio conteúdo (UGC) pra marcas como a {{marca}}.", botaoTexto, botaoLink);
        corpoHtmlColadoAtual = modelo;
        document.getElementById("ppCorpoHtml").value = modelo;
        atualizarPrevia();
      });
    }

    document.getElementById("ppTelaCheia").addEventListener("click", abrirPreviaTelaCheia);
  }

  function atualizarContagemDestinatarios() {
    var alvo = document.getElementById("ppContagemDestinatarios");
    var destino = calcularDestinatarios(filtroAtivo);

    if (filtroAtivo === "selecionadas" && !destino.lista.length) {
      alvo.innerHTML =
        '<p class="aviso" style="margin:10px 0">' + A.icone("aviso") +
          '<span>Você ainda não selecionou nenhuma marca. <button type="button" class="botao botao--linha botao--mini" id="ppIrMarcas" style="margin-left:6px">Ir pra Marcas</button></span>' +
        "</p>";
      document.getElementById("ppIrMarcas").addEventListener("click", function () { A.irPara("marcas"); });
      return;
    }

    var jaReceberam = jaReceberamEsteAssunto(destino.lista, assuntoAtual.trim());
    var aMandar = destino.lista.filter(function (m) { return !jaReceberam[m.id || m.email]; });

    var partes = [aMandar.length + (aMandar.length === 1 ? " marca vai receber" : " marcas vão receber")];
    if (destino.semEmail) partes.push(destino.semEmail + (destino.semEmail === 1 ? " ficou de fora por não ter e-mail" : " ficaram de fora por não ter e-mail"));
    if (destino.duplicados) partes.push(destino.duplicados + (destino.duplicados === 1 ? " repetido (mesmo e-mail em duas marcas)" : " repetidos (mesmo e-mail em duas marcas)"));
    if (pularRepetidos && Object.keys(jaReceberam).length) partes.push(Object.keys(jaReceberam).length + " já receberam este assunto e vão ser pulados");

    alvo.innerHTML = '<p class="texto-apoio" style="margin:10px 0 0">' + partes.join(". ") + "." + "</p>";
  }

  function atualizarCartaoAEnviar() {
    var el = document.querySelector(".prosp-cartao--azul .prosp-cartao-valor");
    if (!el) return;
    el.textContent = calcularDestinatarios(filtroAtivo).lista.length;
  }

  function atualizarPrevia() {
    var destino = calcularDestinatarios(filtroAtivo);
    var exemplo = destino.lista[0] || { nome: "Estúdio Flor (exemplo)" };
    var htmlBase = htmlAtualDoModo();
    var assuntoExemplo = personalizar(assuntoAtual, exemplo.nome);
    var htmlExemplo = personalizar(htmlBase, exemplo.nome);
    var alvo = document.getElementById("ppJanelaPrevia");
    if (alvo) alvo.innerHTML = janelaPreviaHTML(exemplo.nome, assuntoExemplo, htmlExemplo);
  }

  function abrirPreviaTelaCheia() {
    var destino = calcularDestinatarios(filtroAtivo);
    var exemplo = destino.lista[0] || { nome: "Estúdio Flor (exemplo)" };
    var htmlExemplo = personalizar(htmlAtualDoModo(), exemplo.nome);
    var assuntoExemplo = personalizar(assuntoAtual, exemplo.nome);
    A.abrirModal({
      titulo: "Prévia do e-mail",
      corpoHTML: '<div class="prosp-janela-email">' + janelaPreviaHTML(exemplo.nome, assuntoExemplo, htmlExemplo) + "</div>",
      onMontar: function (caixa) { caixa.classList.add("modal-caixa--largo"); }
    });
  }

  /* ---------- BLOCO DE ENVIO (muda conforme o modo) ---------- */
  function renderizarBlocoEnvio() {
    var alvo = document.getElementById("ppBlocoEnvio");
    if (!alvo) return;
    if (modoEnvio === "rascunho") {
      alvo.innerHTML = blocoRascunhoHTML();
      ligarRascunho();
    } else {
      alvo.innerHTML = blocoAutomaticoHTML();
      ligarAutomatico();
    }
  }

  function blocoAutomaticoHTML() {
    return (
      '<div class="cartao cartao-pad prosp-bloco">' +
        '<h3 class="bloco-titulo">Enviar</h3>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
          '<button type="button" class="botao botao--linha" id="ppEnviarTeste">Enviar teste pra mim</button>' +
          '<button type="button" class="botao" id="ppDisparar">Disparar</button>' +
        "</div>" +
        '<div id="ppProgresso" class="prosp-progresso" hidden>' +
          '<div class="prosp-progresso-barra"><div class="prosp-progresso-corpo" id="ppProgressoCorpo" style="width:0%"></div></div>' +
          '<p class="texto-apoio" id="ppProgressoTexto" style="margin-top:6px"></p>' +
        "</div>" +
        '<div id="ppResultado"></div>' +
      "</div>"
    );
  }

  function blocoRascunhoHTML() {
    return (
      '<div class="cartao cartao-pad prosp-bloco">' +
        '<h3 class="bloco-titulo">Fila de rascunhos</h3>' +
        '<p class="texto-apoio">Monto o e-mail de cada marca, uma de cada vez. Você copia ou abre no Gmail, manda com a sua conta e marca como enviada.</p>' +
        '<button type="button" class="botao" id="ppComecarFila">Começar fila de rascunhos</button>' +
        '<div id="ppFilaArea" style="margin-top:16px"></div>' +
      "</div>"
    );
  }

  /* ---------- MODO AUTOMÁTICO (Resend) ---------- */
  function chamarFuncaoEnviar(payload) {
    return window.banco.auth.getSession().then(function (r) {
      var sessao = r && r.data && r.data.session;
      if (!sessao) return { ok: false, mensagem: "Sua sessão expirou. Recarregue a página e entre de novo." };
      var urlBase = window.URL_PROJETO_SUPABASE;
      if (!urlBase) return { ok: false, mensagem: "Não achei o endereço do projeto (js/banco.js). Recarregue a página." };
      return fetch(urlBase + "/functions/v1/enviar-emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + sessao.access_token, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (resp) {
        return resp.json().catch(function () { return null; }).then(function (corpo) {
          if (!resp.ok || !corpo) {
            return { ok: false, mensagem: (corpo && corpo.mensagem) || "Não consegui mandar agora (a função respondeu com um erro)." };
          }
          return corpo;
        });
      }).catch(function () {
        return { ok: false, mensagem: "Não consegui falar com a função de envio agora. Confira a sua internet." };
      });
    });
  }

  function ligarAutomatico() {
    document.getElementById("ppEnviarTeste").addEventListener("click", function () {
      if (!assuntoAtual.trim()) { A.toast("Escreva um assunto antes de mandar o teste.", "erro"); return; }
      var botao = document.getElementById("ppEnviarTeste");
      botao.disabled = true; botao.textContent = "Mandando...";
      chamarFuncaoEnviar({
        destinatarios: [{ email: EMAIL_LOGIN, nome: MEU_NOME }],
        assunto: assuntoAtual,
        html: htmlAtualDoModo(),
        pularRepetidos: false
      }).then(function (r) {
        botao.disabled = false; botao.textContent = "Enviar teste pra mim";
        mostrarResultadoEnvio(r, true);
      });
    });

    document.getElementById("ppDisparar").addEventListener("click", abrirConfirmacaoDisparo);
  }

  function abrirConfirmacaoDisparo() {
    if (enviando) return;
    if (!assuntoAtual.trim()) { A.toast("Escreva um assunto antes de disparar.", "erro"); return; }
    if (modoEscrita === "html" && !temPalavraSair(corpoHtmlColadoAtual)) {
      A.toast('O seu HTML não tem a palavra "SAIR" em lugar nenhum. Adicione o aviso de descadastro antes de disparar.', "erro");
      return;
    }
    var destino = calcularDestinatarios(filtroAtivo);
    var jaReceberam = jaReceberamEsteAssunto(destino.lista, assuntoAtual.trim());
    var aMandar = destino.lista.filter(function (m) { return !jaReceberam[m.id || m.email]; });
    if (!aMandar.length) { A.toast("Não há ninguém pra mandar com esse filtro agora.", "erro"); return; }

    var opcaoAtiva = construirOpcoesFiltro().filter(function (o) { return o.id === filtroAtivo; })[0];
    A.abrirModal({
      titulo: "Confirmar disparo",
      corpoHTML:
        '<h2 class="gaveta-titulo">Confirmar disparo</h2>' +
        '<p class="texto-apoio">Vai para <b>' + aMandar.length + (aMandar.length === 1 ? " marca" : " marcas") + "</b>, da lista <b>" + A.esc(opcaoAtiva ? opcaoAtiva.rotulo : filtroAtivo) + "</b>. Não dá pra desfazer." +
        "</p>" +
        '<div class="gaveta-acoes">' +
          '<button type="button" class="botao botao--fantasma" id="ppCancelarDisparo">Cancelar</button>' +
          '<button type="button" class="botao" id="ppConfirmarDisparo">Confirmar e enviar</button>' +
        "</div>",
      onMontar: function (caixa) {
        caixa.querySelector("#ppCancelarDisparo").addEventListener("click", A.fecharModal);
        caixa.querySelector("#ppConfirmarDisparo").addEventListener("click", function () {
          A.fecharModal();
          executarDisparo(aMandar);
        });
      }
    });
  }

  function executarDisparo(destinatarios) {
    enviando = true;
    var progresso = document.getElementById("ppProgresso");
    var progressoCorpo = document.getElementById("ppProgressoCorpo");
    var progressoTexto = document.getElementById("ppProgressoTexto");
    progresso.hidden = false;
    document.getElementById("ppDisparar").disabled = true;
    document.getElementById("ppEnviarTeste").disabled = true;

    var lotes = [];
    for (var i = 0; i < destinatarios.length; i += TAMANHO_LOTE_ENVIO) lotes.push(destinatarios.slice(i, i + TAMANHO_LOTE_ENVIO));

    var total = destinatarios.length;
    var processados = 0, enviados = 0, falhas = 0, pulados = 0, cotaEsgotada = false;
    var todosResultados = [];
    var assuntoDisparo = assuntoAtual;
    var htmlDisparo = htmlAtualDoModo();

    function proximoLote(indice) {
      if (indice >= lotes.length || cotaEsgotada) return finalizar();
      var lote = lotes[indice];
      chamarFuncaoEnviar({
        destinatarios: lote.map(function (m) { return { email: m.email, nome: m.nome }; }),
        assunto: assuntoDisparo,
        html: htmlDisparo,
        pularRepetidos: pularRepetidos
      }).then(function (r) {
        if (r.ok) {
          enviados += r.enviados || 0;
          falhas += r.falhas || 0;
          pulados += r.pulados || 0;
          if (r.resultados) todosResultados = todosResultados.concat(r.resultados);
          if (r.cotaEsgotada) cotaEsgotada = true;
        } else {
          falhas += lote.length;
        }
        processados += lote.length;
        var pct = Math.round((processados / total) * 100);
        progressoCorpo.style.width = pct + "%";
        progressoTexto.textContent = processados + " de " + total + " marcas processadas";
        proximoLote(indice + 1);
      });
    }

    function finalizar() {
      enviando = false;
      document.getElementById("ppDisparar").disabled = false;
      document.getElementById("ppEnviarTeste").disabled = false;

      // mostra o resumo JÁ, sem esperar nada - é a primeira coisa que ela
      // precisa ver. As atualizações de banco abaixo acontecem por baixo,
      // sem recarregar a aba inteira (senão essa mensagem some na hora).
      mostrarResultadoEnvio({ ok: true, enviados: enviados, falhas: falhas, pulados: pulados, cotaEsgotada: cotaEsgotada }, false);

      var sucessos = todosResultados.filter(function (r) { return r.ok; }).map(function (r) { return r.email; });
      var idsParaMarcar = destinatarios.filter(function (m) { return m.id && sucessos.indexOf(m.email) !== -1; });
      var agora = new Date().toISOString();

      // reflete os envios no histórico local, sem precisar recarregar
      todosResultados.forEach(function (r) {
        envios.unshift({ id: "local-" + Math.random().toString(36).slice(2), email: r.email, assunto: assuntoDisparo, status: r.ok ? "ok" : "erro", erro: r.erro || null, resend_id: null, criado_em: agora });
      });
      atualizarPainelDepoisDoEnvio();

      if (!idsParaMarcar.length) return;
      Promise.all(idsParaMarcar.map(function (m) { return A.gravar("marcas", "update", { id: m.id, valores: { ultimo_email_em: agora } }); })).then(function (resultadosGravacao) {
        resultadosGravacao.forEach(function (r, i) { if (r.ok) idsParaMarcar[i].ultimo_email_em = agora; });
        atualizarPainelDepoisDoEnvio();

        if (filtroAtivo !== "selecionadas") return;
        if (!window.confirm("Quer limpar a sua seleção de marcas agora? (Se você for mandar a mesma lista de novo, pode deixar como está.)")) return;
        Promise.all(idsParaMarcar.map(function (m) { return A.gravar("marcas", "update", { id: m.id, valores: { selecionada: false } }); })).then(function (r2) {
          r2.forEach(function (r, i) { if (r.ok) idsParaMarcar[i].selecionada = false; });
          atualizarContagemDestinatarios();
          atualizarPainelDepoisDoEnvio();
        });
      });
    }

    proximoLote(0);
  }

  // atualiza a capa, os cartões e o histórico sem mexer no formulário nem
  // na mensagem de resultado que acabou de aparecer
  function atualizarPainelDepoisDoEnvio() {
    var numeroCapa = document.querySelector(".prosp-capa-numero-valor");
    if (numeroCapa) numeroCapa.textContent = envios.filter(function (e) { return e.status === "ok"; }).length;

    var cartoesEl = document.querySelector(".prosp-cartoes");
    if (cartoesEl) {
      var baseComEmail = todasMarcas.filter(function (m) { return (m.email || "").trim(); }).length;
      var aEnviar = calcularDestinatarios(filtroAtivo).lista.length;
      var jaReceberam = todasMarcas.filter(function (m) { return m.ultimo_email_em; }).length;
      var falhasAtuais = envios.filter(function (e) { return e.status === "erro"; }).length;
      var descadastradosAtuais = optouts.length;
      cartoesEl.outerHTML = cartoesHTML(baseComEmail, aEnviar, jaReceberam, falhasAtuais, descadastradosAtuais);
    }

    if (statusCarregamento.envios && document.getElementById("ppTabelaHistorico")) {
      var termo = document.getElementById("ppBuscaHistorico") ? document.getElementById("ppBuscaHistorico").value.trim().toLowerCase() : "";
      renderizarTabelaHistorico(termo);
    }
  }

  function mostrarResultadoEnvio(r, ehTeste) {
    var alvo = document.getElementById("ppResultado");
    if (!alvo) return;
    if (!r.ok) {
      alvo.innerHTML = '<p class="erro-campo" style="margin-top:12px">' + A.esc(r.mensagem || "Não consegui mandar.") + "</p>";
      return;
    }
    if (ehTeste) {
      alvo.innerHTML = '<p class="texto-apoio" style="margin-top:12px;color:var(--verde)">Teste mandado! Confira a sua caixa de entrada (e o celular).</p>';
      return;
    }
    var linhas = [r.enviados + (r.enviados === 1 ? " enviado" : " enviados"), r.falhas + (r.falhas === 1 ? " falha" : " falhas"), r.pulados + (r.pulados === 1 ? " pulado" : " pulados")];
    var html = '<p class="texto-apoio" style="margin-top:12px">' + linhas.join(", ") + "." + "</p>";
    if (r.cotaEsgotada) {
      html += '<p class="aviso" style="margin-top:8px">' + A.icone("aviso") +
        '<span>A cota diária do Resend acabou no meio do disparo. Volta amanhã, cola o mesmo assunto e o mesmo texto, deixa marcada a caixinha de pular quem já recebeu, e ele manda só pros que faltaram.</span></p>';
    }
    alvo.innerHTML = html;
  }

  /* ---------- MODO RASCUNHO (sem Resend) ---------- */
  function ligarRascunho() {
    document.getElementById("ppComecarFila").addEventListener("click", function () {
      var destino = calcularDestinatarios(filtroAtivo);
      var jaReceberam = jaReceberamEsteAssunto(destino.lista, assuntoAtual.trim());
      filaRascunho = destino.lista.filter(function (m) { return !jaReceberam[m.id || m.email]; });
      if (!filaRascunho.length) { A.toast("Não há ninguém pra mandar com esse filtro agora.", "erro"); return; }
      renderizarFila();
    });
  }

  function htmlParaTexto(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function renderizarFila() {
    var area = document.getElementById("ppFilaArea");
    if (!filaRascunho.length) {
      area.innerHTML = '<p class="texto-apoio" style="color:var(--verde)">Fila terminada! Todo mundo foi marcado como enviado.</p>';
      return;
    }
    var atual = filaRascunho[0];
    var assuntoPersonalizado = personalizar(assuntoAtual, atual.nome);
    var htmlPersonalizado = personalizar(htmlAtualDoModo(), atual.nome);
    var textoPersonalizado = modoEscrita === "texto" ? personalizar(corpoTextoAtual, atual.nome) : htmlParaTexto(htmlPersonalizado);

    area.innerHTML =
      '<p class="texto-apoio">Faltam ' + filaRascunho.length + (filaRascunho.length === 1 ? " marca na fila." : " marcas na fila.") + "</p>" +
      '<div class="prosp-fila-item">' +
        '<div class="prosp-fila-item-topo"><strong>' + A.esc(atual.nome) + "</strong><span>" + A.esc(atual.email) + "</span></div>" +
        '<p class="prosp-fila-item-assunto">' + A.esc(assuntoPersonalizado) + "</p>" +
        '<pre class="prosp-fila-item-corpo">' + A.esc(textoPersonalizado) + "</pre>" +
        '<div class="prosp-fila-item-acoes">' +
          '<button type="button" class="botao botao--linha botao--mini" id="ppFilaCopiar">' + A.icone("copiar") + "Copiar texto</button>" +
          '<button type="button" class="botao botao--linha botao--mini" id="ppFilaGmail">Abrir no Gmail</button>' +
          '<button type="button" class="botao botao--mini" id="ppFilaMarcar">Marcar como enviada</button>' +
        "</div>" +
      "</div>";

    document.getElementById("ppFilaCopiar").addEventListener("click", function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textoPersonalizado).then(function () {
          A.toast("Texto copiado.", "ok");
        }).catch(function () { A.toast("Não consegui copiar. Selecione o texto à mão.", "erro"); });
      } else {
        A.toast("Esse navegador não deixa copiar automático. Selecione o texto à mão.", "erro");
      }
    });

    document.getElementById("ppFilaGmail").addEventListener("click", function () {
      var url = "https://mail.google.com/mail/?view=cm&fs=1" +
        "&to=" + encodeURIComponent(atual.email) +
        "&su=" + encodeURIComponent(assuntoPersonalizado) +
        "&body=" + encodeURIComponent(textoPersonalizado);
      window.open(url, "_blank", "noopener");
    });

    document.getElementById("ppFilaMarcar").addEventListener("click", function () {
      var marca = atual;
      filaRascunho = filaRascunho.slice(1);
      if (marca.id) {
        A.gravar("marcas", "update", { id: marca.id, valores: { ultimo_email_em: new Date().toISOString() } }).then(function (r) {
          if (!r.ok) { A.toast("Marquei na fila, mas não consegui salvar a data no banco.", "erro"); return; }
          var m = todasMarcas.filter(function (x) { return x.id === marca.id; })[0];
          if (m) m.ultimo_email_em = new Date().toISOString();
          atualizarPainelDepoisDoEnvio();
        });
      }
      renderizarFila();
    });
  }

  /* ---------- HISTÓRICO ---------- */
  function ligarHistorico() {
    if (!statusCarregamento.envios) return;
    renderizarTabelaHistorico("");
    document.getElementById("ppBuscaHistorico").addEventListener("input", A.debounce(function (e) {
      renderizarTabelaHistorico(e.target.value.trim().toLowerCase());
    }, 200));
  }

  function renderizarTabelaHistorico(termo) {
    var corpo = document.getElementById("ppTabelaHistorico");
    var lista = envios.filter(function (e) { return !termo || (e.email || "").toLowerCase().indexOf(termo) !== -1; });
    if (!lista.length) {
      corpo.innerHTML = '<tr class="tabela-vazia"><td colspan="4">' + (envios.length ? "Nenhum envio encontrado com essa busca." : "Nenhum e-mail enviado ainda.") + "</td></tr>";
      return;
    }
    corpo.innerHTML = lista.map(function (e) {
      var pilula = e.status === "ok" ? '<span class="pilula pilula--verde">Enviado</span>' : '<span class="pilula pilula--vermelho">Erro</span>';
      return "<tr><td>" + A.esc(e.email) + "</td><td>" + A.esc(e.assunto) + "</td><td>" + (A.formatarDataHora(e.criado_em) || "-") + "</td><td>" + pilula + (e.status === "erro" && e.erro ? ' <span class="texto-apoio" title="' + A.esc(e.erro) + '">(ver motivo)</span>' : "") + "</td></tr>";
    }).join("");
  }

  /* ---------- DESCADASTRO MANUAL ---------- */
  function ligarDescadastro() {
    document.getElementById("ppDescadastrarBotao").addEventListener("click", function () {
      var campo = document.getElementById("ppDescadastrarEmail");
      var email = campo.value.trim().toLowerCase();
      if (!email || email.indexOf("@") === -1) { A.toast("Escreva um e-mail válido.", "erro"); return; }
      A.gravar("email_optout", "insert", { valores: { email: email } }).then(function (r) {
        if (!r.ok) {
          var jaExiste = r.erro && (r.erro.code === "23505" || /duplicate/i.test(r.erro.message || ""));
          A.toast(jaExiste ? "Esse e-mail já está no descadastro." : "Não consegui salvar. Tenta de novo.", "erro");
          return;
        }
        campo.value = "";
        A.toast("E-mail descadastrado.", "ok");
        carregar();
      });
    });
  }

  window.Admin.registrarSecao({
    id: "prospeccao",
    grupo: "minha rotina",
    nome: "Prospecção",
    legenda: "Manda o seu e-mail de apresentação pra várias marcas de uma vez.",
    icone: "envelope",
    montar: montar
  });
})();
