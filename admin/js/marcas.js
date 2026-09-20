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
        '<button type="button" class="botao botao--linha" id="mcImportar">' + A.icone("subir") + "Importar planilha</button>" +
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
    document.getElementById("mcImportar").addEventListener("click", abrirImportador);

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

  /* ============================================================
     IMPORTAR PLANILHA (CSV)
     Sobe uma planilha de leads e cria uma marca pra cada linha.
     Tudo acontece aqui no navegador: o arquivo é só lido, nada é
     enviado pra fora, e nada entra no banco antes de você conferir
     e confirmar a importação.
     ============================================================ */
  var CAMPOS_IMPORTACAO = [
    { id: "", rotulo: "Ignorar esta coluna" },
    { id: "nome", rotulo: "Nome da marca" },
    { id: "instagram", rotulo: "Instagram" },
    { id: "email", rotulo: "E-mail" },
    { id: "telefone", rotulo: "Telefone" },
    { id: "situacao", rotulo: "Situação" },
    { id: "obs", rotulo: "Observação" },
    { id: "ultimo_contato", rotulo: "Último contato" }
  ];

  function semAcento(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  /* tenta adivinhar o que cada coluna da planilha é, pelo nome do cabeçalho */
  function adivinharColuna(cabecalho) {
    var h = semAcento(cabecalho);
    if (!h) return "";
    if (/email|e-mail|mail/.test(h)) return "email";
    if (/instagram|insta/.test(h)) return "instagram";
    if (/ultimo|último|data/.test(h)) return "ultimo_contato";
    if (/whatsapp|zap|celular|telefone|fone|contato/.test(h)) return "telefone";
    if (/situacao|situação|status|etapa|estagio|estágio|funil/.test(h)) return "situacao";
    if (/^obs|observacao|observação|nota|comentario|comentário/.test(h)) return "obs";
    if (/nome|marca|empresa|company|cliente|razao|razão/.test(h)) return "nome";
    return "";
  }

  /* tenta encaixar o texto livre da planilha numa das 4 situações que o banco aceita */
  function adivinharSituacao(t) {
    var h = semAcento(t);
    if (!h) return "lead";
    if (/cliente|fech|ganh|convert/.test(h)) return "cliente";
    if (/convers|negocia|proposta|andamento/.test(h)) return "conversando";
    if (/parad|perdid|frio|sem resposta|nao respond/.test(h)) return "parada";
    return "lead";
  }

  /* aceita dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd; qualquer outro formato vira "sem data" */
  function adivinharData(t) {
    var s = String(t || "").trim();
    if (!s) return null;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + "-" + m[2] + "-" + m[3];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      var dia = m[1].padStart(2, "0"), mes = m[2].padStart(2, "0"), ano = m[3];
      if (ano.length === 2) ano = "20" + ano;
      return ano + "-" + mes + "-" + dia;
    }
    return null;
  }

  /* lê um texto CSV (vírgula ou ponto e vírgula, com ou sem aspas) e
     devolve uma lista de linhas, cada uma sendo uma lista de colunas */
  function analisarCSV(texto) {
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);
    var primeiraLinha = texto.split(/\r\n|\n|\r/)[0] || "";
    var separador = primeiraLinha.split(";").length >= primeiraLinha.split(",").length ? ";" : ",";

    var linhas = [], linhaAtual = [], campo = "", dentroAspas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i];
      if (dentroAspas) {
        if (c === '"') {
          if (texto[i + 1] === '"') { campo += '"'; i++; }
          else dentroAspas = false;
        } else campo += c;
      } else if (c === '"') {
        dentroAspas = true;
      } else if (c === separador) {
        linhaAtual.push(campo); campo = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linhaAtual.push(campo); campo = "";
        linhas.push(linhaAtual); linhaAtual = [];
      } else {
        campo += c;
      }
    }
    if (campo !== "" || linhaAtual.length) { linhaAtual.push(campo); linhas.push(linhaAtual); }
    return linhas.filter(function (l) { return l.some(function (c) { return c.trim() !== ""; }); });
  }

  function linhaComoObjeto(mapa, linha) {
    var obj = {};
    mapa.forEach(function (campoId, i) {
      if (campoId) obj[campoId] = (linha[i] || "").trim();
    });
    return obj;
  }

  function abrirImportador() {
    A.abrirModal({
      titulo: "Importar marcas de uma planilha",
      corpoHTML:
        '<div id="ivEstado">' +
          '<h2 class="gaveta-titulo">Importar marcas de uma planilha</h2>' +
          '<p class="texto-apoio">Exporte a sua planilha como CSV (no Excel: Arquivo → Salvar como → CSV; no Google Planilhas: Arquivo → Fazer download → Valores separados por vírgula) e escolha o arquivo abaixo. Depois você confere cada coluna antes de importar de verdade: nada entra no seu banco sem você confirmar.</p>' +
          '<label class="campo-arquivo" id="ivEscolher">' + A.icone("subir") +
            "<span>Clique para escolher o arquivo CSV</span>" +
            '<input type="file" accept=".csv,text/csv" id="ivArquivo">' +
          "</label>" +
          '<p class="erro-campo" id="ivErro" hidden></p>' +
        "</div>",
      onMontar: function (caixa) {
        caixa.classList.add("modal-caixa--largo");
        document.getElementById("ivArquivo").addEventListener("change", function (e) {
          var arquivo = e.target.files && e.target.files[0];
          if (!arquivo) return;
          var leitor = new FileReader();
          leitor.onload = function () {
            var linhas = analisarCSV(String(leitor.result || ""));
            if (linhas.length < 2) {
              var erro = document.getElementById("ivErro");
              erro.hidden = false;
              erro.textContent = "Não encontrei nenhuma linha de dados nesse arquivo. Confira se ele tem uma linha de cabeçalho e pelo menos uma marca.";
              return;
            }
            mostrarMapeamento(linhas[0], linhas.slice(1));
          };
          leitor.onerror = function () {
            var erro = document.getElementById("ivErro");
            erro.hidden = false;
            erro.textContent = "Não consegui ler esse arquivo. Tenta exportar de novo como CSV.";
          };
          leitor.readAsText(arquivo, "utf-8");
        });
      }
    });
  }

  function mostrarMapeamento(cabecalhos, linhasDados) {
    var mapa = cabecalhos.map(adivinharColuna);
    var estado = document.getElementById("ivEstado");

    function repinta() {
      var temNome = mapa.indexOf("nome") !== -1;
      var camposUsados = CAMPOS_IMPORTACAO.filter(function (c) { return c.id && mapa.indexOf(c.id) !== -1; });

      document.getElementById("ivPreviaCabecalho").innerHTML =
        camposUsados.map(function (c) { return "<th>" + A.esc(c.rotulo) + "</th>"; }).join("") || "<th>-</th>";

      document.getElementById("ivPreviaCorpo").innerHTML = linhasDados.slice(0, 5).map(function (linha) {
        var obj = linhaComoObjeto(mapa, linha);
        return "<tr>" + (camposUsados.map(function (c) { return "<td>" + A.esc(obj[c.id] || "-") + "</td>"; }).join("") || "<td>-</td>") + "</tr>";
      }).join("");

      document.getElementById("ivResumo").textContent =
        linhasDados.length + (linhasDados.length === 1 ? " linha encontrada na planilha (mostrando as 5 primeiras acima)." : " linhas encontradas na planilha (mostrando as 5 primeiras acima).") +
        (temNome ? "" : " Escolha qual coluna é o \"Nome da marca\" pra poder importar.");

      document.getElementById("ivConfirmar").disabled = !temNome;
    }

    estado.innerHTML =
      '<h2 class="gaveta-titulo">Confira as colunas antes de importar</h2>' +
      '<p class="texto-apoio">A primeira linha da planilha foi usada como o nome de cada coluna. Pra cada uma, escolha o que ela é (já adivinhei o que deu pra adivinhar). O nome da marca é obrigatório, o resto é opcional.</p>' +
      '<div class="mapa-colunas" id="ivMapa"></div>' +
      '<div class="tabela-scroll"><table class="tabela"><thead><tr id="ivPreviaCabecalho"></tr></thead><tbody id="ivPreviaCorpo"></tbody></table></div>' +
      '<p class="texto-apoio" id="ivResumo"></p>' +
      '<p class="erro-campo" id="ivErroImportar" hidden></p>' +
      '<div class="gaveta-acoes">' +
        '<button type="button" class="botao botao--fantasma" id="ivVoltar">Trocar arquivo</button>' +
        '<button type="button" class="botao" id="ivConfirmar">Importar</button>' +
      "</div>";

    document.getElementById("ivMapa").innerHTML = cabecalhos.map(function (cab, i) {
      var exemplo = (linhasDados[0] && linhasDados[0][i]) ? linhasDados[0][i].trim() : "";
      return '<div class="mapa-linha">' +
        "<div><p class=\"mapa-coluna-nome\">" + A.esc(cab || "(sem nome)") + "</p>" +
          (exemplo ? '<p class="mapa-coluna-exemplo">ex.: ' + A.esc(exemplo) + "</p>" : "") +
        "</div>" +
        '<select data-indice="' + i + '">' +
          CAMPOS_IMPORTACAO.map(function (c) { return '<option value="' + c.id + '"' + (c.id === mapa[i] ? " selected" : "") + ">" + A.esc(c.rotulo) + "</option>"; }).join("") +
        "</select>" +
      "</div>";
    }).join("");

    document.querySelectorAll("#ivMapa select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        mapa[Number(sel.dataset.indice)] = sel.value;
        repinta();
      });
    });

    document.getElementById("ivVoltar").addEventListener("click", abrirImportador);
    document.getElementById("ivConfirmar").addEventListener("click", function () { importar(mapa, linhasDados); });

    repinta();
  }

  function importar(mapa, linhasDados) {
    var prontas = [], puladas = 0;
    linhasDados.forEach(function (linha) {
      var obj = linhaComoObjeto(mapa, linha);
      if (!obj.nome) { puladas++; return; }
      prontas.push({
        nome: obj.nome,
        instagram: obj.instagram || "",
        email: obj.email || "",
        telefone: obj.telefone || "",
        situacao: obj.situacao ? adivinharSituacao(obj.situacao) : "lead",
        obs: obj.obs || "",
        ultimo_contato: obj.ultimo_contato ? adivinharData(obj.ultimo_contato) : null,
        exemplo: false
      });
    });

    if (!prontas.length) {
      var erro = document.getElementById("ivErroImportar");
      erro.hidden = false;
      erro.textContent = "Nenhuma linha tem o nome preenchido, não tenho o que importar.";
      return;
    }

    var botao = document.getElementById("ivConfirmar");
    botao.disabled = true;
    document.getElementById("ivVoltar").disabled = true;

    var TAMANHO_LOTE = 40;
    var lotes = [];
    for (var i = 0; i < prontas.length; i += TAMANHO_LOTE) lotes.push(prontas.slice(i, i + TAMANHO_LOTE));

    var importadas = 0, comErro = 0;
    function proximoLote(indice) {
      if (indice >= lotes.length) {
        A.fecharModal();
        var msg = importadas + (importadas === 1 ? " marca importada." : " marcas importadas.");
        if (puladas) msg += " " + puladas + (puladas === 1 ? " linha pulada (sem nome)." : " linhas puladas (sem nome).");
        if (comErro) msg += " " + comErro + " não entraram por causa de um erro no banco.";
        A.toast(msg, comErro ? "erro" : "ok");
        carregar();
        return;
      }
      botao.textContent = "Importando… (" + Math.min(indice * TAMANHO_LOTE, prontas.length) + " de " + prontas.length + ")";
      A.gravar("marcas", "insert", { valores: lotes[indice] }).then(function (r) {
        if (r.ok) importadas += lotes[indice].length;
        else comErro += lotes[indice].length;
        proximoLote(indice + 1);
      });
    }
    proximoLote(0);
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
