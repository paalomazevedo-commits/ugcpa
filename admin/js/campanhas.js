/* ============================================================
   ABA 4 - CAMPANHAS
   O funil de trabalhos com marcas. Toda coluna ordena ao clicar
   no cabeçalho (status segue a ordem do funil, não a alfabética).
   Estrela destaca, prazo avisa quando está perto ou atrasado.
   ============================================================ */
(function () {
  var A = window.Admin;
  var todas = [];
  var termoBusca = "";
  var filtroAtivo = "todas";
  var ordem = { campo: "prazo", direcao: "asc" };

  var STATUS_FUNIL = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];
  var STATUS_PILULA = {
    "Briefing": "pilula--cinza", "Roteiro": "pilula--azul", "Aprovação Roteiro": "pilula--azul",
    "Gravação": "pilula--azul", "Edição": "pilula--ambar", "Aprovado": "pilula--ambar", "Entregue": "pilula--verde"
  };
  var TIPO_ORDEM = ["Conteúdo", "Publicidade"];
  var TIPO_PILULA = { "Conteúdo": "pilula--azul", "Publicidade": "pilula--ambar" };
  var PAGAMENTO_ORDEM = ["pendente", "pago"];
  var PAGAMENTO_ROTULO = { pendente: "Pendente", pago: "Pago" };
  var PAGAMENTO_PILULA = { pendente: "pilula--ambar", pago: "pilula--verde" };

  var COLUNAS = [
    { campo: "favorita", rotulo: "", tipo: "bool" },
    { campo: "campanha", rotulo: "Campanha", tipo: "texto" },
    { campo: "cliente", rotulo: "Cliente", tipo: "texto" },
    { campo: "tipo", rotulo: "Tipo", tipo: "lista", lista: TIPO_ORDEM },
    { campo: "status", rotulo: "Status", tipo: "lista", lista: STATUS_FUNIL },
    { campo: "qtd", rotulo: "Qtd", tipo: "numero" },
    { campo: "valor", rotulo: "Valor", tipo: "numero" },
    { campo: "prazo", rotulo: "Prazo", tipo: "data" },
    { campo: "pagamento", rotulo: "Pagamento", tipo: "lista", lista: PAGAMENTO_ORDEM }
  ];

  function montar(raiz) {
    todas = []; termoBusca = ""; filtroAtivo = "todas"; ordem = { campo: "prazo", direcao: "asc" };
    raiz.innerHTML =
      '<div class="kpis" id="cpKpis"></div>' +
      '<div class="ferramentas">' +
        '<div class="chips-filtro" id="cpChips">' +
          '<button type="button" class="chip-filtro" data-filtro="todas" aria-pressed="true">Todas</button>' +
          '<button type="button" class="chip-filtro" data-filtro="ativas" aria-pressed="false">Ativas</button>' +
          '<button type="button" class="chip-filtro" data-filtro="finalizadas" aria-pressed="false">Finalizadas</button>' +
        "</div>" +
        '<div class="busca">' + A.icone("busca") + '<input type="text" id="cpBusca" placeholder="Buscar por campanha ou cliente"></div>' +
        '<div class="ferramentas-espaco"></div>' +
        '<button type="button" class="botao botao--linha" id="cpBaixar">' + A.icone("baixar") + "Baixar CSV</button>" +
        '<button type="button" class="botao" id="cpNova">' + A.icone("mais") + "Adicionar campanha</button>" +
      "</div>" +
      '<div class="tabela-scroll"><table class="tabela"><thead><tr id="cpCabecalho"></tr></thead><tbody id="cpTabela"><tr class="tabela-vazia"><td colspan="9">Carregando…</td></tr></tbody></table></div>';

    document.querySelectorAll("#cpChips .chip-filtro").forEach(function (c) {
      c.addEventListener("click", function () {
        filtroAtivo = c.dataset.filtro;
        document.querySelectorAll("#cpChips .chip-filtro").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        renderTabela();
      });
    });
    document.getElementById("cpBusca").addEventListener("input", A.debounce(function (e) {
      termoBusca = e.target.value.trim().toLowerCase();
      renderTabela();
    }, 200));
    document.getElementById("cpNova").addEventListener("click", function () { abrirFormulario(null); });
    document.getElementById("cpBaixar").addEventListener("click", baixarCSV);

    carregar();
  }

  function carregar() {
    A.buscar("campanhas", function (q) { return q.order("criado_em", { ascending: false }); }).then(function (r) {
      todas = r.dados;
      renderKpis();
      renderTabela();
    });
  }

  function renderKpis() {
    var reais = todas.filter(function (c) { return !c.exemplo; });
    var ativas = reais.filter(function (c) { return c.ativa; }).length;
    var valorTotal = reais.reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);
    var qtdTotal = reais.reduce(function (s, c) { return s + (Number(c.qtd) || 0); }, 0);
    var ticket = qtdTotal > 0 ? A.formatarMoeda(valorTotal / qtdTotal) : "-";
    var aReceber = reais.filter(function (c) { return c.pagamento === "pendente"; }).reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);
    var recebido = reais.filter(function (c) { return c.pagamento === "pago"; }).reduce(function (s, c) { return s + (Number(c.valor) || 0); }, 0);

    var itens = [
      { rotulo: "Campanhas", valor: String(reais.length), extra: "" },
      { rotulo: "Ativas", valor: String(ativas), extra: "" },
      { rotulo: "Valor total", valor: A.formatarMoeda(valorTotal), extra: "ticket médio: " + ticket + " / vídeo" },
      { rotulo: "A receber", valor: A.formatarMoeda(aReceber), extra: "já recebido: " + A.formatarMoeda(recebido) }
    ];
    document.getElementById("cpKpis").innerHTML = itens.map(function (i) {
      return '<div class="kpi"><p class="kpi-rotulo">' + A.esc(i.rotulo) + '</p><p class="kpi-valor">' + A.esc(i.valor) + "</p>" +
        (i.extra ? '<p class="kpi-extra">' + A.esc(i.extra) + "</p>" : "") + "</div>";
    }).join("");
  }

  function filtradasBuscaEFiltro() {
    return todas.filter(function (c) {
      if (filtroAtivo === "ativas" && !c.ativa) return false;
      if (filtroAtivo === "finalizadas" && c.status !== "Entregue") return false;
      if (!termoBusca) return true;
      var alvo = ((c.campanha || "") + " " + (c.cliente || "")).toLowerCase();
      return alvo.indexOf(termoBusca) !== -1;
    });
  }

  function comparar(a, b, coluna) {
    var dir = ordem.direcao === "asc" ? 1 : -1;
    if (coluna.tipo === "bool") return ((a.favorita ? 1 : 0) - (b.favorita ? 1 : 0)) * dir;
    if (coluna.tipo === "numero") return ((Number(a[coluna.campo]) || 0) - (Number(b[coluna.campo]) || 0)) * dir;
    if (coluna.tipo === "lista") return (coluna.lista.indexOf(a[coluna.campo]) - coluna.lista.indexOf(b[coluna.campo])) * dir;
    if (coluna.tipo === "data") {
      var va = a[coluna.campo], vb = b[coluna.campo];
      if (!va && !vb) return 0;
      if (!va) return 1;   // sem prazo vai sempre pro fim
      if (!vb) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    }
    var ta = (a[coluna.campo] || "").toString();
    var tb = (b[coluna.campo] || "").toString();
    return ta.localeCompare(tb, "pt-BR") * dir;
  }

  function badgePrazo(c) {
    if (!c.prazo || c.status === "Entregue") return "";
    var dias = A.diasEntre(A.hojeISO(), String(c.prazo).slice(0, 10));
    if (dias < 0) return '<span class="badge-prazo badge-prazo--atrasado">' + (-dias) + (dias === -1 ? " dia atrasado" : " dias atrasado") + "</span>";
    if (dias <= 3) {
      var txt = dias === 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : "vence em " + dias + " dias";
      return '<span class="badge-prazo badge-prazo--proximo">' + txt + "</span>";
    }
    return "";
  }

  function renderCabecalho() {
    document.getElementById("cpCabecalho").innerHTML = COLUNAS.map(function (col) {
      var ativa = ordem.campo === col.campo;
      var iconeOrdem = ativa ? (ordem.direcao === "asc" ? A.icone("ordemAsc") : A.icone("ordemDesc")) : A.icone("ordemNeutra");
      return '<th class="ordenavel" data-campo="' + col.campo + '"' + (ativa ? " data-ordenado" : "") + '>' +
        '<span class="cabecalho-th">' + A.esc(col.rotulo) + iconeOrdem + "</span></th>";
    }).join("");
    document.querySelectorAll("#cpCabecalho th").forEach(function (th) {
      th.addEventListener("click", function () {
        if (ordem.campo === th.dataset.campo) ordem.direcao = ordem.direcao === "asc" ? "desc" : "asc";
        else { ordem.campo = th.dataset.campo; ordem.direcao = "asc"; }
        renderTabela();
      });
    });
  }

  function renderTabela() {
    renderCabecalho();
    var corpo = document.getElementById("cpTabela");
    var col = COLUNAS.filter(function (c) { return c.campo === ordem.campo; })[0];
    var lista = filtradasBuscaEFiltro().slice().sort(function (a, b) { return comparar(a, b, col); });

    if (!lista.length) {
      corpo.innerHTML = '<tr class="tabela-vazia"><td colspan="9">' +
        (todas.length ? "Nenhuma campanha encontrada com esse filtro." : 'Nenhuma campanha cadastrada ainda. Clique em "Adicionar campanha" pra começar.') +
        "</td></tr>";
      return;
    }
    corpo.innerHTML = lista.map(function (c) {
      return '<tr class="linha-clicavel' + (c.favorita ? " linha-favorita" : "") + (c.exemplo ? " linha-exemplo" : "") + '" data-id="' + A.esc(c.id) + '">' +
        '<td class="campanha-estrela-cel"><button type="button" class="botao-estrela" data-estrela="' + A.esc(c.id) + '" data-marcada="' + (c.favorita ? "true" : "false") + '" aria-label="Destacar campanha">' + A.icone("estrela") + "</button></td>" +
        "<td>" + A.esc(c.campanha) + (c.exemplo ? '<span class="etiqueta-exemplo">exemplo</span>' : "") + "</td>" +
        "<td>" + A.esc(c.cliente || "-") + "</td>" +
        '<td><span class="pilula ' + (TIPO_PILULA[c.tipo] || "pilula--cinza") + '">' + A.esc(c.tipo) + "</span></td>" +
        '<td><span class="pilula ' + (STATUS_PILULA[c.status] || "pilula--cinza") + '">' + A.esc(c.status) + "</span></td>" +
        '<td class="celula-numero">' + A.esc(c.qtd) + "</td>" +
        '<td class="celula-numero">' + A.formatarMoeda(c.valor) + "</td>" +
        "<td>" + (c.prazo ? A.formatarData(c.prazo) : "-") + badgePrazo(c) + "</td>" +
        '<td><span class="pilula ' + (PAGAMENTO_PILULA[c.pagamento] || "pilula--cinza") + '">' + (PAGAMENTO_ROTULO[c.pagamento] || c.pagamento) + "</span></td>" +
        "</tr>";
    }).join("");

    corpo.querySelectorAll("tr[data-id]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var c = todas.filter(function (x) { return x.id === tr.dataset.id; })[0];
        if (c) abrirFormulario(c);
      });
    });
    corpo.querySelectorAll("[data-estrela]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var novo = b.dataset.marcada !== "true";
        A.gravar("campanhas", "update", { id: b.dataset.estrela, valores: { favorita: novo } }).then(function (r) {
          if (!r.ok) { A.toast("Não consegui salvar. Tenta de novo.", "erro"); return; }
          var c = todas.filter(function (x) { return x.id === b.dataset.estrela; })[0];
          if (c) c.favorita = novo;
          renderTabela();
        });
      });
    });
  }

  function baixarCSV() {
    var lista = filtradasBuscaEFiltro();
    var linhas = lista.map(function (c) {
      return [
        c.campanha || "", c.cliente || "", c.tipo || "", c.status || "",
        String(c.qtd || 0), String(Number(c.valor || 0).toFixed(2)).replace(".", ","),
        c.prazo ? A.formatarData(c.prazo) : "", PAGAMENTO_ROTULO[c.pagamento] || c.pagamento || "",
        c.favorita ? "Sim" : "Não"
      ];
    });
    A.baixarCSV("minhas-campanhas.csv", ["Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor", "Prazo", "Pagamento", "Favorita"], linhas);
  }

  function abrirFormulario(campanha) {
    var ehNova = !campanha;
    var html =
      '<h2 class="gaveta-titulo">' + (ehNova ? "Adicionar campanha" : "Editar campanha") + "</h2>" +
      '<form id="formCp" novalidate>' +
        '<label class="campo"><span>Campanha</span><input type="text" id="cpNomeCampanha" required value="' + A.esc(campanha ? campanha.campanha : "") + '"></label>' +
        '<label class="campo"><span>Cliente</span><input type="text" id="cpCliente" value="' + A.esc(campanha ? campanha.cliente : "") + '"></label>' +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Tipo</span><select id="cpTipo">' +
            TIPO_ORDEM.map(function (t) { return '<option value="' + t + '"' + (campanha && campanha.tipo === t ? " selected" : "") + ">" + t + "</option>"; }).join("") +
          "</select></label>" +
          '<label class="campo"><span>Status</span><select id="cpStatus">' +
            STATUS_FUNIL.map(function (s) { return '<option value="' + s + '"' + (campanha && campanha.status === s ? " selected" : "") + ">" + s + "</option>"; }).join("") +
          "</select></label>" +
        "</div>" +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Quantidade</span><input type="number" id="cpQtd" min="1" step="1" value="' + A.esc(campanha ? campanha.qtd : 1) + '"></label>' +
          '<label class="campo"><span>Valor (R$)</span><input type="number" id="cpValor" min="0" step="0.01" value="' + A.esc(campanha ? campanha.valor : 0) + '"></label>' +
        "</div>" +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Prazo</span><input type="date" id="cpPrazo" value="' + A.esc(campanha && campanha.prazo ? String(campanha.prazo).slice(0, 10) : "") + '"></label>' +
          '<label class="campo"><span>Pagamento</span><select id="cpPagamento">' +
            PAGAMENTO_ORDEM.map(function (p) { return '<option value="' + p + '"' + (campanha && campanha.pagamento === p ? " selected" : "") + ">" + PAGAMENTO_ROTULO[p] + "</option>"; }).join("") +
          "</select></label>" +
        "</div>" +
        '<label class="campo-check"><input type="checkbox" id="cpAtiva"' + (!campanha || campanha.ativa ? " checked" : "") + "> Campanha ativa</label>" +
        '<label class="campo-check"><input type="checkbox" id="cpFavorita"' + (campanha && campanha.favorita ? " checked" : "") + "> Destacar com estrela</label>" +
        '<p class="erro-campo" id="cpErro" hidden></p>' +
        '<div class="gaveta-acoes">' +
          (ehNova ? "" : '<button type="button" class="botao botao--perigo" id="cpApagar">' + A.icone("lixeira") + "Apagar</button>") +
          '<button type="submit" class="botao">' + (ehNova ? "Adicionar" : "Salvar") + "</button>" +
        "</div>" +
      "</form>";

    A.abrirModal({
      lateral: true,
      titulo: ehNova ? "Adicionar campanha" : "Editar campanha",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.querySelector("#formCp").addEventListener("submit", function (e) {
          e.preventDefault();
          var nome = document.getElementById("cpNomeCampanha").value.trim();
          var erro = document.getElementById("cpErro");
          if (!nome) { erro.hidden = false; erro.textContent = "Escreva o nome da campanha."; return; }
          var valores = {
            campanha: nome,
            cliente: document.getElementById("cpCliente").value.trim(),
            tipo: document.getElementById("cpTipo").value,
            status: document.getElementById("cpStatus").value,
            qtd: Math.max(1, parseInt(document.getElementById("cpQtd").value, 10) || 1),
            valor: Math.max(0, parseFloat(document.getElementById("cpValor").value) || 0),
            prazo: document.getElementById("cpPrazo").value || null,
            pagamento: document.getElementById("cpPagamento").value,
            ativa: document.getElementById("cpAtiva").checked,
            favorita: document.getElementById("cpFavorita").checked
          };
          if (ehNova) {
            valores.exemplo = false;
            A.gravar("campanhas", "insert", { valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal(); A.toast("Campanha adicionada.", "ok"); carregar();
            });
          } else {
            valores.exemplo = false;
            A.gravar("campanhas", "update", { id: campanha.id, valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal(); A.toast("Campanha salva.", "ok"); carregar();
            });
          }
        });
        if (!ehNova) {
          caixa.querySelector("#cpApagar").addEventListener("click", function () {
            if (!A.confirmarExclusao('Apagar a campanha "' + campanha.campanha + '"?')) return;
            A.gravar("campanhas", "delete", { id: campanha.id }).then(function (r) {
              if (!r.ok) { A.toast("Não consegui apagar. Tenta de novo.", "erro"); return; }
              A.fecharModal(); A.toast("Campanha apagada.", "ok"); carregar();
            });
          });
        }
      }
    });
  }

  window.Admin.registrarSecao({
    id: "campanhas",
    grupo: "minha rotina",
    nome: "Campanhas",
    legenda: "O funil de trabalhos com marcas, do briefing até a entrega.",
    icone: "campanhas",
    montar: montar
  });
})();
