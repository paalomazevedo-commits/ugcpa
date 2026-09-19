/* ============================================================
   ABA 1 - PORTFÓLIO
   Métricas do site público (visitas) e a tabela dos vídeos que
   aparecem lá, com adicionar, editar, apagar, mostrar/esconder
   e arrastar pra reordenar.
   ============================================================ */
(function () {
  var A = window.Admin;
  var videosAtuais = [];

  function montar(raiz) {
    videosAtuais = [];
    raiz.innerHTML =
      '<div class="kpis" id="pfKpis"></div>' +
      '<div class="duas-colunas">' +
        '<div class="cartao cartao-pad">' +
          '<p class="bloco-titulo">Visitas nos últimos 14 dias</p>' +
          '<div id="pfGrafico"><p class="estado-vazio">Carregando…</p></div>' +
        '</div>' +
        '<div class="cartao cartao-pad">' +
          '<p class="bloco-titulo">De onde as pessoas vêm</p>' +
          '<div id="pfOrigens"><p class="estado-vazio">Carregando…</p></div>' +
        '</div>' +
      '</div>' +
      '<div class="ferramentas">' +
        '<h3 style="font-size:.92rem;font-weight:600;margin:0">Vídeos do portfólio</h3>' +
        '<div class="ferramentas-espaco"></div>' +
        '<button type="button" class="botao" id="pfNovoVideo">' + A.icone("mais") + "Adicionar vídeo</button>" +
      "</div>" +
      '<div class="tabela-scroll"><table class="tabela"><thead><tr>' +
        '<th style="width:34px"></th><th style="width:34px"></th><th>Vídeo</th><th>Nicho</th><th>Destaque</th><th style="text-align:right">Ações</th>' +
      "</tr></thead><tbody id=\"pfTabelaVideos\"><tr class=\"tabela-vazia\"><td colspan=\"6\">Carregando…</td></tr></tbody></table></div>";

    document.getElementById("pfNovoVideo").addEventListener("click", function () { abrirFormularioVideo(null); });

    carregarMetricas();
    carregarVideos();
  }

  /* ---------- métricas ---------- */
  function chaveLocal(d) {
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }
  function ultimosDias(qtd) {
    var lista = [], hoje = new Date();
    for (var i = qtd - 1; i >= 0; i--) {
      var d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
      lista.push(d);
    }
    return lista;
  }
  function rotuloOrigem(origem) {
    if (!origem) return "Direto";
    try {
      var host = new URL(origem).hostname.replace(/^www\./, "");
      return host || origem;
    } catch (e) { return origem; }
  }

  function carregarMetricas() {
    A.buscar("visitas", function (q) { return q.order("data", { ascending: false }).limit(4000); }).then(function (rv) {
      A.buscar("videos").then(function (rvid) {
        renderKpis(rv.dados, rvid.dados);
        renderGrafico(rv.dados);
        renderOrigens(rv.dados);
      });
    });
  }

  function renderKpis(visitas, videos) {
    var dias = ultimosDias(14);
    var chaves14 = dias.map(chaveLocal);
    var hojeChave = chaveLocal(new Date());

    var em14 = 0, hoje = 0;
    var origensNoPeriodo = {};
    visitas.forEach(function (v) {
      var d = new Date(v.data);
      var k = chaveLocal(d);
      if (chaves14.indexOf(k) !== -1) {
        em14++;
        var rot = rotuloOrigem(v.origem);
        origensNoPeriodo[rot] = (origensNoPeriodo[rot] || 0) + 1;
      }
      if (k === hojeChave) hoje++;
    });

    var origemTopo = null, maiorOrigem = 0;
    Object.keys(origensNoPeriodo).forEach(function (k) {
      if (origensNoPeriodo[k] > maiorOrigem) { maiorOrigem = origensNoPeriodo[k]; origemTopo = k; }
    });

    var videosReais = videos.filter(function (v) { return !v.exemplo; });
    var visiveis = videosReais.filter(function (v) { return v.visivel; });
    var contagemNicho = {};
    visiveis.forEach(function (v) {
      var n = (v.nicho || "sem nicho").trim() || "sem nicho";
      contagemNicho[n] = (contagemNicho[n] || 0) + 1;
    });
    var nichoTopo = null, maiorNicho = 0;
    Object.keys(contagemNicho).forEach(function (k) {
      if (contagemNicho[k] > maiorNicho) { maiorNicho = contagemNicho[k]; nichoTopo = k; }
    });

    var itens = [
      { rotulo: "Visitas em 14 dias", valor: String(em14), extra: "" },
      { rotulo: "Visitas hoje", valor: String(hoje), extra: "" },
      { rotulo: "Vídeos no ar", valor: String(visiveis.length), extra: videosReais.length ? (videosReais.length - visiveis.length) + " escondidos" : "" },
      { rotulo: "Nicho mais forte", valor: nichoTopo ? capitaliza(nichoTopo) : "-", extra: nichoTopo ? maiorNicho + (maiorNicho === 1 ? " vídeo" : " vídeos") : "sem vídeos ainda" },
      { rotulo: "De onde mais vêm", valor: origemTopo || "-", extra: origemTopo ? maiorOrigem + (maiorOrigem === 1 ? " visita" : " visitas") + " em 14 dias" : "sem visitas ainda" }
    ];
    document.getElementById("pfKpis").innerHTML = itens.map(function (i) {
      return '<div class="kpi"><p class="kpi-rotulo">' + A.esc(i.rotulo) + '</p><p class="kpi-valor">' + A.esc(i.valor) + "</p>" +
        (i.extra ? '<p class="kpi-extra">' + A.esc(i.extra) + "</p>" : "") + "</div>";
    }).join("");
  }

  function capitaliza(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function renderGrafico(visitas) {
    var alvo = document.getElementById("pfGrafico");
    var dias = ultimosDias(14);
    var hojeChave = chaveLocal(new Date());
    var contagem = {};
    dias.forEach(function (d) { contagem[chaveLocal(d)] = 0; });
    visitas.forEach(function (v) {
      var k = chaveLocal(new Date(v.data));
      if (k in contagem) contagem[k]++;
    });
    var total = dias.reduce(function (s, d) { return s + contagem[chaveLocal(d)]; }, 0);
    if (total === 0) {
      alvo.innerHTML = '<p class="estado-vazio">Ainda não tem visita nenhuma registrada. Assim que alguém abrir o seu portfólio, as barras dos últimos 14 dias começam a aparecer aqui.</p>';
      return;
    }
    var maximo = Math.max.apply(null, dias.map(function (d) { return contagem[chaveLocal(d)]; }));
    alvo.innerHTML = '<div class="grafico-barras">' + dias.map(function (d) {
      var k = chaveLocal(d);
      var v = contagem[k];
      var altura = maximo > 0 ? Math.max(2, Math.round((v / maximo) * 100)) : 2;
      return '<div class="barra-dia" title="' + A.esc(String(d.getDate()) + "/" + String(d.getMonth() + 1) + ": " + v + (v === 1 ? " visita" : " visitas")) + '">' +
        '<div class="barra-dia-corpo" data-hoje="' + (k === hojeChave ? "true" : "false") + '" style="height:' + altura + '%"></div>' +
        '<span class="barra-dia-rotulo">' + String(d.getDate()).padStart(2, "0") + "</span></div>";
    }).join("") + "</div>";
  }

  function renderOrigens(visitas) {
    var alvo = document.getElementById("pfOrigens");
    var dias14 = ultimosDias(14).map(chaveLocal);
    var contagem = {};
    visitas.forEach(function (v) {
      var k = chaveLocal(new Date(v.data));
      if (dias14.indexOf(k) === -1) return;
      var r = rotuloOrigem(v.origem);
      contagem[r] = (contagem[r] || 0) + 1;
    });
    var chaves = Object.keys(contagem);
    if (!chaves.length) {
      alvo.innerHTML = '<p class="estado-vazio">Assim que as visitas começarem a chegar, aqui aparece de onde elas vêm (Instagram, direto pelo link, Google...).</p>';
      return;
    }
    chaves.sort(function (a, b) { return contagem[b] - contagem[a]; });
    var maximo = contagem[chaves[0]];
    alvo.innerHTML = '<div class="lista-origens">' + chaves.slice(0, 7).map(function (k) {
      var pct = Math.max(4, Math.round((contagem[k] / maximo) * 100));
      return '<div class="origem-linha"><span class="origem-nome" title="' + A.esc(k) + '">' + A.esc(k) + '</span>' +
        '<span class="origem-barra"><span class="origem-barra-corpo" style="width:' + pct + '%"></span></span>' +
        '<span class="origem-qtd">' + contagem[k] + "</span></div>";
    }).join("") + "</div>";
  }

  /* ---------- tabela de vídeos ---------- */
  function carregarVideos() {
    A.buscar("videos", function (q) { return q.order("ordem", { ascending: true }); }).then(function (r) {
      videosAtuais = r.dados;
      renderTabelaVideos();
    });
  }

  function renderTabelaVideos() {
    var corpo = document.getElementById("pfTabelaVideos");
    if (!videosAtuais.length) {
      corpo.innerHTML = '<tr class="tabela-vazia"><td colspan="6">Nenhum vídeo cadastrado ainda. Clique em "Adicionar vídeo" pra começar.</td></tr>';
      return;
    }
    corpo.innerHTML = videosAtuais.map(function (v) {
      return '<tr data-id="' + A.esc(v.id) + '"' + (v.exemplo ? ' class="linha-exemplo"' : "") + '>' +
        '<td><span class="alca-arrastar" title="Arraste pra reordenar">' + A.icone("arrasto") + "</span></td>" +
        '<td><button type="button" class="botao-icone botao-olho" data-ligado="' + (v.visivel ? "true" : "false") + '" data-id="' + A.esc(v.id) + '" title="' +
          (v.visivel ? "Visível no site, clique pra esconder" : "Escondido, clique pra mostrar") + '">' + A.icone(v.visivel ? "olho" : "olhoFechado") + "</button></td>" +
        "<td>" + A.esc(v.titulo || "(sem título)") + (v.exemplo ? '<span class="etiqueta-exemplo">exemplo</span>' : "") +
          '<br><span style="color:var(--tinta-media);font-size:.78rem">' + A.esc(v.marca || "") + "</span></td>" +
        "<td>" + A.esc(v.nicho || "-") + "</td>" +
        "<td>" + A.esc(v.destaque || "-") + "</td>" +
        '<td style="text-align:right"><div class="acoes-contato" style="justify-content:flex-end">' +
          '<button type="button" class="botao-icone" data-editar="' + A.esc(v.id) + '" title="Editar">' + A.icone("lapis") + "</button>" +
          '<button type="button" class="botao-icone" data-apagar="' + A.esc(v.id) + '" title="Apagar">' + A.icone("lixeira") + "</button>" +
        "</div></td></tr>";
    }).join("");

    corpo.querySelectorAll("[data-editar]").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = videosAtuais.filter(function (x) { return x.id === b.dataset.editar; })[0];
        abrirFormularioVideo(v || null);
      });
    });
    corpo.querySelectorAll("[data-apagar]").forEach(function (b) {
      b.addEventListener("click", function () { apagarVideo(b.dataset.apagar); });
    });
    corpo.querySelectorAll(".botao-olho").forEach(function (b) {
      b.addEventListener("click", function () { alternarVisivel(b.dataset.id, b.dataset.ligado !== "true"); });
    });
    ativarArrastar(corpo);
  }

  function alternarVisivel(id, novoValor) {
    A.gravar("videos", "update", { id: id, valores: { visivel: novoValor } }).then(function (r) {
      if (!r.ok) { A.toast("Não consegui salvar. Tenta de novo.", "erro"); return; }
      var v = videosAtuais.filter(function (x) { return x.id === id; })[0];
      if (v) v.visivel = novoValor;
      renderTabelaVideos();
      var kpis = document.getElementById("pfKpis");
      if (kpis) carregarMetricas();
    });
  }

  function apagarVideo(id) {
    var v = videosAtuais.filter(function (x) { return x.id === id; })[0];
    if (!v) return;
    if (!A.confirmarExclusao('Apagar o vídeo "' + (v.titulo || "sem título") + '"? Ele some do site na hora.')) return;
    A.gravar("videos", "delete", { id: id }).then(function (r) {
      if (!r.ok) { A.toast("Não consegui apagar. Tenta de novo.", "erro"); return; }
      videosAtuais = videosAtuais.filter(function (x) { return x.id !== id; });
      renderTabelaVideos();
      A.toast("Vídeo apagado.", "ok");
      carregarMetricas();
    });
  }

  function ativarArrastar(tbody) {
    var origem = null;
    tbody.querySelectorAll(".alca-arrastar").forEach(function (alca) {
      alca.setAttribute("draggable", "true");
      alca.addEventListener("dragstart", function (e) {
        origem = alca.closest("tr");
        origem.classList.add("arrastando");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", origem.dataset.id); } catch (err) {}
      });
      alca.addEventListener("dragend", function () {
        if (origem) origem.classList.remove("arrastando");
        tbody.querySelectorAll(".alvo-arrasto").forEach(function (tr) { tr.classList.remove("alvo-arrasto"); });
        origem = null;
      });
    });
    tbody.querySelectorAll("tr").forEach(function (tr) {
      tr.addEventListener("dragover", function (e) {
        if (!origem || tr === origem) return;
        e.preventDefault();
        tr.classList.add("alvo-arrasto");
      });
      tr.addEventListener("dragleave", function () { tr.classList.remove("alvo-arrasto"); });
      tr.addEventListener("drop", function (e) {
        e.preventDefault();
        tr.classList.remove("alvo-arrasto");
        if (!origem || tr === origem) return;
        var linhas = Array.prototype.slice.call(tbody.querySelectorAll("tr"));
        var iOrigem = linhas.indexOf(origem), iAlvo = linhas.indexOf(tr);
        if (iOrigem < iAlvo) tr.parentNode.insertBefore(origem, tr.nextSibling);
        else tr.parentNode.insertBefore(origem, tr);
        salvarNovaOrdem();
      });
    });
  }

  function salvarNovaOrdem() {
    var linhas = Array.prototype.slice.call(document.getElementById("pfTabelaVideos").querySelectorAll("tr[data-id]"));
    var pedidos = linhas.map(function (tr, i) {
      var v = videosAtuais.filter(function (x) { return x.id === tr.dataset.id; })[0];
      if (v) v.ordem = i;
      return A.gravar("videos", "update", { id: tr.dataset.id, valores: { ordem: i } });
    });
    Promise.all(pedidos).then(function () { A.toast("Ordem salva.", "ok"); });
  }

  /* ---------- formulário (adicionar / editar) ---------- */
  function abrirFormularioVideo(video) {
    var ehNovo = !video;
    var html =
      '<h2 class="gaveta-titulo">' + (ehNovo ? "Adicionar vídeo" : "Editar vídeo") + "</h2>" +
      '<form id="formVideo" novalidate>' +
        '<label class="campo"><span>Título</span><input type="text" id="fvTitulo" required value="' + A.esc(video ? video.titulo : "") + '"></label>' +
        '<label class="campo"><span>Link do vídeo (YouTube)</span><input type="url" id="fvLink" required value="' + A.esc(video ? video.link : "") + '" placeholder="https://youtube.com/shorts/..."></label>' +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Nicho</span><input type="text" id="fvNicho" required value="' + A.esc(video ? video.nicho : "") + '" placeholder="beleza, moda, tech..."></label>' +
          '<label class="campo"><span>Marca</span><input type="text" id="fvMarca" value="' + A.esc(video ? video.marca : "") + '"></label>' +
        "</div>" +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Formato</span><input type="text" id="fvFormato" value="' + A.esc(video ? video.formato : "vídeo 9:16") + '"></label>' +
          '<label class="campo"><span>Destaque (ex: 2,4M views)</span><input type="text" id="fvDestaque" value="' + A.esc(video ? video.destaque : "") + '"></label>' +
        "</div>" +
        '<label class="campo-check"><input type="checkbox" id="fvVisivel"' + (!video || video.visivel ? " checked" : "") + "> Visível no site agora</label>" +
        '<p class="erro-campo" id="fvErro" hidden></p>' +
        '<div class="gaveta-acoes">' +
          (ehNovo ? "" : '<button type="button" class="botao botao--perigo" id="fvApagar">' + A.icone("lixeira") + "Apagar</button>") +
          '<button type="submit" class="botao">' + (ehNovo ? "Adicionar" : "Salvar") + "</button>" +
        "</div>" +
      "</form>";

    A.abrirModal({
      lateral: true,
      titulo: ehNovo ? "Adicionar vídeo" : "Editar vídeo",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.querySelector("#formVideo").addEventListener("submit", function (e) {
          e.preventDefault();
          var titulo = document.getElementById("fvTitulo").value.trim();
          var link = document.getElementById("fvLink").value.trim();
          var nicho = document.getElementById("fvNicho").value.trim().toLowerCase();
          var erro = document.getElementById("fvErro");
          if (!titulo || !link || !nicho) {
            erro.hidden = false;
            erro.textContent = "Preencha pelo menos o título, o link e o nicho.";
            return;
          }
          var valores = {
            titulo: titulo,
            link: link,
            nicho: nicho,
            marca: document.getElementById("fvMarca").value.trim(),
            formato: document.getElementById("fvFormato").value.trim(),
            destaque: document.getElementById("fvDestaque").value.trim(),
            visivel: document.getElementById("fvVisivel").checked
          };
          if (ehNovo) {
            var maiorOrdem = videosAtuais.reduce(function (m, v) { return Math.max(m, v.ordem || 0); }, -1);
            valores.ordem = maiorOrdem + 1;
            valores.exemplo = false;
            A.gravar("videos", "insert", { valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal();
              A.toast("Vídeo adicionado.", "ok");
              carregarVideos();
              carregarMetricas();
            });
          } else {
            valores.exemplo = false; // editar promove o exemplo a vídeo de verdade
            A.gravar("videos", "update", { id: video.id, valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal();
              A.toast("Vídeo salvo.", "ok");
              carregarVideos();
              carregarMetricas();
            });
          }
        });
        if (!ehNovo) {
          caixa.querySelector("#fvApagar").addEventListener("click", function () {
            A.fecharModal();
            apagarVideo(video.id);
          });
        }
      }
    });
  }

  window.Admin.registrarSecao({
    id: "portfolio",
    grupo: "meu site",
    nome: "Portfólio",
    legenda: "As métricas do site e os vídeos que aparecem lá.",
    icone: "portfolio",
    montar: montar
  });
})();
