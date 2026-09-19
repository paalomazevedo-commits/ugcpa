/* ============================================================
   ABA 2 - MARCAS
   A base de contatos de empresa, em formato de planilha. Busca,
   filtro por situação, adicionar, editar (clicando na linha),
   baixar CSV, e atalhos pra WhatsApp e Instagram.
   ============================================================ */
(function () {
  var A = window.Admin;
  var todas = [];
  var termoBusca = "";
  var situacaoAtiva = "todas";

  var SITUACOES = {
    lead: { rotulo: "Lead", pilula: "pilula--azul", ponto: "situacao-ponto--lead" },
    conversando: { rotulo: "Conversando", pilula: "pilula--ambar", ponto: "situacao-ponto--conversando" },
    cliente: { rotulo: "Cliente", pilula: "pilula--verde", ponto: "situacao-ponto--cliente" },
    parada: { rotulo: "Parada", pilula: "pilula--cinza", ponto: "situacao-ponto--parada" }
  };
  var ORDEM_SITUACOES = ["lead", "conversando", "cliente", "parada"];

  function montar(raiz) {
    todas = []; termoBusca = ""; situacaoAtiva = "todas";
    raiz.innerHTML =
      '<div class="ferramentas">' +
        '<div class="busca">' + A.icone("busca") + '<input type="text" id="mcBusca" placeholder="Buscar por nome, @ ou e-mail"></div>' +
        '<div class="chips-filtro" id="mcChips"></div>' +
        '<div class="ferramentas-espaco"></div>' +
        '<button type="button" class="botao botao--linha" id="mcBaixar">' + A.icone("baixar") + "Baixar CSV</button>" +
        '<button type="button" class="botao" id="mcNova">' + A.icone("mais") + "Adicionar marca</button>" +
      "</div>" +
      '<div class="tabela-scroll"><table class="tabela"><thead><tr>' +
        "<th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th>" +
      '</tr></thead><tbody id="mcTabela"><tr class="tabela-vazia"><td colspan="7">Carregando…</td></tr></tbody></table></div>';

    var chips = ['<button type="button" class="chip-filtro" data-situacao="todas" aria-pressed="true">Todas</button>'];
    ORDEM_SITUACOES.forEach(function (s) {
      chips.push('<button type="button" class="chip-filtro" data-situacao="' + s + '" aria-pressed="false">' + SITUACOES[s].rotulo + "</button>");
    });
    document.getElementById("mcChips").innerHTML = chips.join("");
    document.querySelectorAll("#mcChips .chip-filtro").forEach(function (c) {
      c.addEventListener("click", function () {
        situacaoAtiva = c.dataset.situacao;
        document.querySelectorAll("#mcChips .chip-filtro").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        renderTabela();
      });
    });

    document.getElementById("mcBusca").addEventListener("input", A.debounce(function (e) {
      termoBusca = e.target.value.trim().toLowerCase();
      renderTabela();
    }, 200));

    document.getElementById("mcNova").addEventListener("click", function () { abrirFormulario(null); });
    document.getElementById("mcBaixar").addEventListener("click", baixarCSV);

    carregar();
  }

  function carregar() {
    A.buscar("marcas", function (q) { return q.order("criado_em", { ascending: false }); }).then(function (r) {
      todas = r.dados;
      renderTabela();
    });
  }

  function filtradas() {
    return todas.filter(function (m) {
      if (situacaoAtiva !== "todas" && m.situacao !== situacaoAtiva) return false;
      if (!termoBusca) return true;
      var alvo = ((m.nome || "") + " " + (m.instagram || "") + " " + (m.email || "")).toLowerCase();
      return alvo.indexOf(termoBusca) !== -1;
    });
  }

  function linkWhatsapp(tel) {
    var d = A.somenteDigitos(tel);
    if (!d) return null;
    if (d.length <= 11) d = "55" + d;
    return "https://wa.me/" + d;
  }
  function linkInstagram(handle) {
    if (!handle) return null;
    var limpo = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
    if (!limpo) return null;
    return "https://www.instagram.com/" + limpo;
  }

  function renderTabela() {
    var corpo = document.getElementById("mcTabela");
    var lista = filtradas();
    if (!lista.length) {
      corpo.innerHTML = '<tr class="tabela-vazia"><td colspan="7">' +
        (todas.length ? "Nenhuma marca encontrada com esse filtro." : 'Nenhuma marca cadastrada ainda. Clique em "Adicionar marca" pra começar.') +
        "</td></tr>";
      return;
    }
    corpo.innerHTML = lista.map(function (m) {
      var sit = SITUACOES[m.situacao] || SITUACOES.lead;
      var linkInsta = linkInstagram(m.instagram);
      var linkZap = linkWhatsapp(m.telefone);
      return '<tr class="linha-clicavel' + (m.exemplo ? " linha-exemplo" : "") + '" data-id="' + A.esc(m.id) + '">' +
        "<td>" + A.esc(m.nome) + (m.exemplo ? '<span class="etiqueta-exemplo">exemplo</span>' : "") + "</td>" +
        "<td>" + (linkInsta ? '<a class="link-contato" href="' + A.esc(linkInsta) + '" target="_blank" rel="noopener" data-parar>' + A.icone("instagram") + A.esc(m.instagram) + "</a>" : "-") + "</td>" +
        "<td>" + (m.email ? '<a class="link-contato" href="mailto:' + A.esc(m.email) + '" data-parar>' + A.esc(m.email) + "</a>" : "-") + "</td>" +
        "<td>" + (linkZap ? '<a class="link-contato" href="' + A.esc(linkZap) + '" target="_blank" rel="noopener" data-parar>' + A.icone("whatsapp") + A.esc(m.telefone) + "</a>" : (m.telefone || "-")) + "</td>" +
        '<td><span class="pilula ' + sit.pilula + '"><span class="situacao-ponto ' + sit.ponto + '"></span>' + sit.rotulo + "</span></td>" +
        '<td class="celula-truncada" title="' + A.esc(m.obs || "") + '">' + A.esc(m.obs || "-") + "</td>" +
        "<td>" + (A.formatarData(m.ultimo_contato) || "-") + "</td></tr>";
    }).join("");

    corpo.querySelectorAll("tr[data-id]").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var m = todas.filter(function (x) { return x.id === tr.dataset.id; })[0];
        if (m) abrirFormulario(m);
      });
    });
    corpo.querySelectorAll("[data-parar]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.stopPropagation(); });
    });
  }

  function baixarCSV() {
    var lista = filtradas();
    var linhas = lista.map(function (m) {
      var sit = SITUACOES[m.situacao] || SITUACOES.lead;
      return [m.nome || "", m.instagram || "", m.email || "", m.telefone || "", sit.rotulo, m.obs || "", A.formatarData(m.ultimo_contato) || ""];
    });
    A.baixarCSV("minhas-marcas.csv", ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"], linhas);
  }

  function abrirFormulario(marca) {
    var ehNova = !marca;
    var html =
      '<h2 class="gaveta-titulo">' + (ehNova ? "Adicionar marca" : "Editar marca") + "</h2>" +
      '<form id="formMarca" novalidate>' +
        '<label class="campo"><span>Nome da marca</span><input type="text" id="fmNome" required value="' + A.esc(marca ? marca.nome : "") + '"></label>' +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Instagram</span><input type="text" id="fmInstagram" placeholder="@marca" value="' + A.esc(marca ? marca.instagram : "") + '"></label>' +
          '<label class="campo"><span>Telefone</span><input type="text" id="fmTelefone" placeholder="(00) 00000-0000" value="' + A.esc(marca ? marca.telefone : "") + '"></label>' +
        "</div>" +
        '<label class="campo"><span>E-mail</span><input type="email" id="fmEmail" value="' + A.esc(marca ? marca.email : "") + '"></label>' +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Situação</span><select id="fmSituacao">' +
            ORDEM_SITUACOES.map(function (s) { return '<option value="' + s + '"' + (marca && marca.situacao === s ? " selected" : "") + ">" + SITUACOES[s].rotulo + "</option>"; }).join("") +
          "</select></label>" +
          '<label class="campo"><span>Último contato</span><input type="date" id="fmUltimoContato" value="' + A.esc(marca && marca.ultimo_contato ? String(marca.ultimo_contato).slice(0, 10) : "") + '"></label>' +
        "</div>" +
        '<label class="campo"><span>Observação</span><textarea id="fmObs">' + A.esc(marca ? marca.obs : "") + "</textarea></label>" +
        '<p class="erro-campo" id="fmErro" hidden></p>' +
        '<div class="gaveta-acoes">' +
          (ehNova ? "" : '<button type="button" class="botao botao--perigo" id="fmApagar">' + A.icone("lixeira") + "Apagar</button>") +
          '<button type="submit" class="botao">' + (ehNova ? "Adicionar" : "Salvar") + "</button>" +
        "</div>" +
      "</form>";

    A.abrirModal({
      lateral: true,
      titulo: ehNova ? "Adicionar marca" : "Editar marca",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.querySelector("#formMarca").addEventListener("submit", function (e) {
          e.preventDefault();
          var nome = document.getElementById("fmNome").value.trim();
          var erro = document.getElementById("fmErro");
          if (!nome) { erro.hidden = false; erro.textContent = "Escreva o nome da marca."; return; }
          var valores = {
            nome: nome,
            instagram: document.getElementById("fmInstagram").value.trim(),
            email: document.getElementById("fmEmail").value.trim(),
            telefone: document.getElementById("fmTelefone").value.trim(),
            situacao: document.getElementById("fmSituacao").value,
            ultimo_contato: document.getElementById("fmUltimoContato").value || null,
            obs: document.getElementById("fmObs").value.trim()
          };
          if (ehNova) {
            valores.exemplo = false;
            A.gravar("marcas", "insert", { valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal(); A.toast("Marca adicionada.", "ok"); carregar();
            });
          } else {
            valores.exemplo = false;
            A.gravar("marcas", "update", { id: marca.id, valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal(); A.toast("Marca salva.", "ok"); carregar();
            });
          }
        });
        if (!ehNova) {
          caixa.querySelector("#fmApagar").addEventListener("click", function () {
            if (!A.confirmarExclusao('Apagar a marca "' + marca.nome + '"?')) return;
            A.gravar("marcas", "delete", { id: marca.id }).then(function (r) {
              if (!r.ok) { A.toast("Não consegui apagar. Tenta de novo.", "erro"); return; }
              A.fecharModal(); A.toast("Marca apagada.", "ok"); carregar();
            });
          });
        }
      }
    });
  }

  window.Admin.registrarSecao({
    id: "marcas",
    grupo: "meu site",
    nome: "Marcas",
    legenda: "A sua base de contatos de empresa.",
    icone: "marcas",
    montar: montar
  });
})();
