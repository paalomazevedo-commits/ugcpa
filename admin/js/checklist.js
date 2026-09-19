/* ============================================================
   ABA 5 - CHECKLIST DO PORTFÓLIO
   Usa window.Biblioteca (js/biblioteca.js), com 5 sub-abas.
   Só a primeira sub-aba salva estado (na tabela marcados); as
   outras são só consulta.
   ============================================================ */
(function () {
  var A = window.Admin;
  var B = null;

  var SUB_ABAS = [
    { id: "checklist", nome: "Checklist do portfólio" },
    { id: "referencias", nome: "Referências de vídeo" },
    { id: "roteiros", nome: "Roteiros" },
    { id: "nichos", nome: "Ideias por nicho" },
    { id: "revisao", nome: "Revisar meu roteiro" }
  ];
  var subAtiva = "checklist";

  var marcadosMap = {};
  var secoesAbertasCheck = {};
  var secoesAbertasTipos = {};

  function montar(raiz) {
    B = window.Biblioteca;
    subAtiva = "checklist";
    secoesAbertasCheck = {};
    secoesAbertasTipos = {};

    raiz.innerHTML = '<div class="sub-abas" id="ckSubAbas"></div><div id="ckCorpo"></div>';
    document.getElementById("ckSubAbas").innerHTML = SUB_ABAS.map(function (s) {
      return '<button type="button" class="sub-aba" data-sub="' + s.id + '" aria-selected="' + (s.id === subAtiva ? "true" : "false") + '">' + A.esc(s.nome) + "</button>";
    }).join("");
    document.querySelectorAll("#ckSubAbas .sub-aba").forEach(function (b) {
      b.addEventListener("click", function () {
        subAtiva = b.dataset.sub;
        document.querySelectorAll("#ckSubAbas .sub-aba").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        renderSubAba();
      });
    });

    if (!B) {
      document.getElementById("ckCorpo").innerHTML = '<p class="estado-vazio">Não encontrei o conteúdo do checklist (js/biblioteca.js). Confira se esse arquivo está publicado na pasta js/ do projeto, do jeito que veio, sem alterar nada.</p>';
      return;
    }

    document.getElementById("ckCorpo").innerHTML = '<p class="estado-vazio">Carregando…</p>';
    A.buscar("marcados").then(function (r) {
      marcadosMap = {};
      r.dados.forEach(function (m) { marcadosMap[m.chave] = !!m.marcado; });
      renderSubAba();
    });
  }

  function renderSubAba() {
    var corpo = document.getElementById("ckCorpo");
    if (subAtiva === "checklist") renderChecklist(corpo);
    else if (subAtiva === "referencias") renderReferencias(corpo);
    else if (subAtiva === "roteiros") renderRoteiros(corpo);
    else if (subAtiva === "nichos") renderNichos(corpo);
    else renderRevisao(corpo);
  }

  /* ============================================================
     1) CHECKLIST DO PORTFÓLIO - persiste em "marcados"
     ============================================================ */
  function chaveItem(secaoId, i) { return "checklist:" + secaoId + ":" + i; }

  function progressoSecao(secao) {
    var total = secao.itens.length;
    var feitos = 0;
    secao.itens.forEach(function (_, i) { if (marcadosMap[chaveItem(secao.id, i)]) feitos++; });
    return { total: total, feitos: feitos, pct: total ? Math.round((feitos / total) * 100) : 0 };
  }

  function renderChecklist(corpo) {
    var totalGeral = 0, feitosGeral = 0;
    B.CHECKLIST.forEach(function (s) { var p = progressoSecao(s); totalGeral += p.total; feitosGeral += p.feitos; });
    var pctGeral = totalGeral ? Math.round((feitosGeral / totalGeral) * 100) : 0;

    corpo.innerHTML =
      '<div class="progresso-geral"><div class="progresso-barra"><div class="progresso-barra-corpo" style="width:' + pctGeral + '%"></div></div>' +
      '<span class="progresso-texto">' + feitosGeral + " de " + totalGeral + " feito (" + pctGeral + "%)</span></div>" +
      '<div id="ckSecoes"></div>';

    document.getElementById("ckSecoes").innerHTML = B.CHECKLIST.map(function (secao) {
      var p = progressoSecao(secao);
      var aberta = !!secoesAbertasCheck[secao.id];
      var itensHTML = secao.itens.map(function (item, i) {
        var chave = chaveItem(secao.id, i);
        var marcado = !!marcadosMap[chave];
        return '<label class="check-item" data-marcado="' + marcado + '">' +
          '<input type="checkbox" data-chave="' + A.esc(chave) + '"' + (marcado ? " checked" : "") + ">" +
          '<span><span class="check-item-titulo">' + A.esc(item.t) + '</span><span class="check-item-explicacao">' + A.esc(item.d) + "</span></span>" +
          "</label>";
      }).join("");
      return '<div class="check-secao" data-aberta="' + aberta + '">' +
        '<button type="button" class="check-secao-cabecalho" data-secao="' + A.esc(secao.id) + '">' +
          '<span class="check-secao-emoji">' + secao.emoji + "</span>" +
          '<span style="flex:1"><span class="check-secao-nome">' + A.esc(secao.nome) + '</span><br><span class="check-secao-resumo">' + A.esc(secao.resumo) + "</span></span>" +
          '<span class="check-secao-barra"><span class="check-secao-barra-corpo" style="width:' + p.pct + '%"></span></span>' +
          '<span class="check-secao-pct">' + p.pct + "%</span>" +
          '<span class="check-secao-seta">' + A.icone("seta") + "</span>" +
        "</button>" +
        '<div class="check-secao-corpo"' + (aberta ? "" : " hidden") + '>' +
          '<p class="check-secao-porque">' + A.esc(secao.porque) + "</p>" +
          itensHTML +
        "</div></div>";
    }).join("");

    document.querySelectorAll("#ckSecoes .check-secao-cabecalho").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.secao;
        secoesAbertasCheck[id] = !secoesAbertasCheck[id];
        var secaoEl = btn.closest(".check-secao");
        secaoEl.dataset.aberta = String(secoesAbertasCheck[id]);
        secaoEl.querySelector(".check-secao-corpo").hidden = !secoesAbertasCheck[id];
      });
    });
    document.querySelectorAll("#ckSecoes input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var chave = cb.dataset.chave;
        marcadosMap[chave] = cb.checked;
        cb.closest(".check-item").dataset.marcado = String(cb.checked);
        salvarMarcado(chave, cb.checked);
        atualizarBarras();
      });
    });
  }

  function atualizarBarras() {
    var totalGeral = 0, feitosGeral = 0;
    document.querySelectorAll("#ckSecoes .check-secao").forEach(function (el) {
      var itens = el.querySelectorAll(".check-item");
      var feitos = el.querySelectorAll('.check-item[data-marcado="true"]').length;
      var total = itens.length;
      var pct = total ? Math.round((feitos / total) * 100) : 0;
      totalGeral += total; feitosGeral += feitos;
      var barra = el.querySelector(".check-secao-barra-corpo");
      if (barra) barra.style.width = pct + "%";
      var pctEl = el.querySelector(".check-secao-pct");
      if (pctEl) pctEl.textContent = pct + "%";
    });
    var pctGeral = totalGeral ? Math.round((feitosGeral / totalGeral) * 100) : 0;
    var barraGeral = document.querySelector(".progresso-barra-corpo");
    if (barraGeral) barraGeral.style.width = pctGeral + "%";
    var textoGeral = document.querySelector(".progresso-texto");
    if (textoGeral) textoGeral.textContent = feitosGeral + " de " + totalGeral + " feito (" + pctGeral + "%)";
  }

  function salvarMarcado(chave, marcado) {
    if (!window.banco) { A.avisar("marcados", null); return; }
    window.banco.from("marcados").upsert({ chave: chave, marcado: marcado, marcado_em: new Date().toISOString() }, { onConflict: "chave" })
      .then(function (resp) { if (resp.error) throw resp.error; })
      .catch(function (erro) { A.avisar("marcados", erro); });
  }

  /* ============================================================
     2) REFERÊNCIAS DE VÍDEO - grade + ficha em modal
     ============================================================ */
  function renderReferencias(corpo) {
    corpo.innerHTML = '<div class="grade-referencias">' + B.REFERENCIAS.map(function (r) {
      return '<button type="button" class="ref-cartao" data-ref="' + A.esc(r.id) + '">' +
        '<div class="ref-capa">' + r.emoji + "</div>" +
        '<div class="ref-info"><p class="ref-titulo">' + A.esc(r.titulo) + '</p>' +
        '<p class="ref-meta">' + A.esc(r.estilo) + " · " + A.esc(r.duracao) + "</p>" +
        '<p class="ref-meta">' + A.esc(r.marca) + "</p></div></button>";
    }).join("") + "</div>";

    corpo.querySelectorAll("[data-ref]").forEach(function (b) {
      b.addEventListener("click", function () { abrirFichaReferencia(b.dataset.ref); });
    });
  }

  function abrirFichaReferencia(id) {
    var r = B.REFERENCIAS.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var roteiroHTML = r.roteiro.map(function (linha) {
      return '<div class="ficha-roteiro-linha"><span class="ficha-roteiro-tempo">' + A.esc(linha.t) + '</span><span class="ficha-roteiro-texto">' + linha.o + "</span></div>";
    }).join("");
    var html =
      '<h2 class="gaveta-titulo">' + r.emoji + " " + A.esc(r.titulo) + "</h2>" +
      '<p style="color:var(--tinta-media);font-size:.82rem;margin:-10px 0 16px">' + A.esc(r.estilo) + " · " + A.esc(r.audiencia) + " · " + A.esc(r.duracao) + " · " + A.esc(r.marca) + "</p>" +
      '<div class="ficha-bloco"><p class="ficha-rotulo">Gancho</p><p class="ficha-texto" style="font-style:italic">' + A.esc(r.gancho) + "</p></div>" +
      '<div class="ficha-bloco"><p class="ficha-rotulo">Por que funciona</p><p class="ficha-texto">' + A.esc(r.porque) + "</p></div>" +
      '<div class="ficha-bloco"><p class="ficha-rotulo">Diferencial</p><p class="ficha-texto">' + A.esc(r.diferencial) + "</p></div>" +
      '<div class="ficha-bloco"><p class="ficha-rotulo">Erro comum</p><p class="ficha-texto">' + A.esc(r.erro) + "</p></div>" +
      '<div class="ficha-bloco"><p class="ficha-rotulo">Roteiro em blocos</p>' + roteiroHTML + "</div>" +
      '<a class="botao" style="width:100%;justify-content:center;margin-top:6px" href="' + A.esc(r.youtube) + '" target="_blank" rel="noopener">' + A.icone("externo") + "Assistir no YouTube</a>";
    A.abrirModal({ titulo: r.titulo, corpoHTML: html });
  }

  /* ============================================================
     3) ROTEIROS - TIPOS em acordeão (abre pra mostrar quando
     usar e os blocos de tempo)
     ============================================================ */
  function renderRoteiros(corpo) {
    corpo.innerHTML = '<div id="ckTipos"></div>';
    document.getElementById("ckTipos").innerHTML = B.TIPOS.map(function (tipo) {
      var aberta = !!secoesAbertasTipos[tipo.id];
      var beatsHTML = tipo.beats.map(function (linha) {
        return '<div class="ficha-roteiro-linha"><span class="ficha-roteiro-tempo">' + A.esc(linha.t) + '</span><span class="ficha-roteiro-texto">' + linha.o + "</span></div>";
      }).join("");
      var errosHTML = tipo.erros && tipo.erros.length
        ? '<div class="tipo-erros"><p class="tipo-erros-titulo">Erros comuns</p><ul>' + tipo.erros.map(function (e) { return "<li>" + A.esc(e) + "</li>"; }).join("") + "</ul></div>"
        : "";
      return '<div class="check-secao" data-aberta="' + aberta + '">' +
        '<button type="button" class="check-secao-cabecalho" data-tipo="' + A.esc(tipo.id) + '">' +
          '<span class="check-secao-emoji">' + tipo.emoji + "</span>" +
          '<span style="flex:1"><span class="check-secao-nome">' + A.esc(tipo.nome) + '</span><br><span class="check-secao-resumo">' + A.esc(tipo.duracao) + "</span></span>" +
          '<span class="check-secao-seta">' + A.icone("seta") + "</span>" +
        "</button>" +
        '<div class="check-secao-corpo"' + (aberta ? "" : " hidden") + '>' +
          '<p class="ficha-rotulo">Quando usar</p><p class="ficha-texto" style="margin-bottom:14px">' + A.esc(tipo.porque) + "</p>" +
          '<p class="ficha-rotulo">Blocos de tempo</p>' + beatsHTML + errosHTML +
        "</div></div>";
    }).join("");

    document.querySelectorAll("#ckTipos .check-secao-cabecalho").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.dataset.tipo;
        secoesAbertasTipos[id] = !secoesAbertasTipos[id];
        var el = btn.closest(".check-secao");
        el.dataset.aberta = String(secoesAbertasTipos[id]);
        el.querySelector(".check-secao-corpo").hidden = !secoesAbertasTipos[id];
      });
    });
  }

  /* ============================================================
     4) IDEIAS POR NICHO
     ============================================================ */
  function renderNichos(corpo) {
    corpo.innerHTML = '<div class="grade-nichos">' + B.NICHOS.map(function (n) {
      var ideiasHTML = n.ideias.map(function (i) {
        return '<div class="nicho-ideia"><p class="nicho-ideia-titulo">' + A.esc(i.t) + '</p><p class="nicho-ideia-gancho">' + A.esc(i.gancho) + "</p></div>";
      }).join("");
      return '<div class="nicho-cartao"><p class="nicho-cartao-topo">' + n.emoji + " " + A.esc(n.nome) + "</p>" + ideiasHTML + "</div>";
    }).join("") + "</div>";
  }

  /* ============================================================
     5) REVISAR MEU ROTEIRO - campo pra colar + blocos de REVISAO
     ============================================================
     Os cliques aqui não salvam em lugar nenhum: é só um apoio
     visual enquanto você lê o seu próprio roteiro colado ao lado. */
  function renderRevisao(corpo) {
    corpo.innerHTML =
      '<div class="revisao-caixa"><p class="bloco-titulo">Cole o seu roteiro aqui pra ler com calma</p>' +
      '<textarea id="ckRoteiroColado" placeholder="Cole aqui o texto do seu roteiro..."></textarea></div>' +
      '<p class="bloco-titulo">Confira item por item</p>' +
      '<div class="revisao-blocos">' + B.REVISAO.map(function (bloco, iBloco) {
        var itensHTML = bloco.itens.map(function (item, iItem) {
          return '<label class="check-item"><input type="checkbox" data-rev="' + iBloco + "-" + iItem + '">' +
            '<span><span class="check-item-titulo">' + A.esc(item.t) + '</span><span class="check-item-explicacao">' + A.esc(item.d) + "</span></span></label>";
        }).join("");
        return '<div class="cartao cartao-pad"><p class="bloco-titulo">' + bloco.emoji + " " + A.esc(bloco.bloco) + "</p>" + itensHTML + "</div>";
      }).join("") + "</div>";

    corpo.querySelectorAll("[data-rev]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        cb.closest(".check-item").dataset.marcado = String(cb.checked);
      });
    });
  }

  window.Admin.registrarSecao({
    id: "checklist",
    grupo: "minha rotina",
    nome: "Checklist",
    legenda: "O guia completo pra deixar o seu portfólio pronto pra vender.",
    icone: "checklist",
    montar: montar
  });
})();
