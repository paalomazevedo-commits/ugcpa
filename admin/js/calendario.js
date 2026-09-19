/* ============================================================
   ABA 3 - CALENDÁRIO
   Visão do mês inteiro (segunda a domingo). Os prazos das
   campanhas aparecem sozinhos, puxados da tabela campanhas.
   Bloco "Ficou pra trás" com o que passou do dia e não foi feito.
   ============================================================ */
(function () {
  var A = window.Admin;
  var itens = [];       // linhas da tabela calendario
  var campanhas = [];   // linhas da tabela campanhas (só as com prazo)
  var tipoFiltro = "todos";
  var mesAtual, anoAtual;

  var TIPOS = {
    gravar: { rotulo: "Gravar", classe: "evento-chip--gravar", pilula: "pilula--azul" },
    editar: { rotulo: "Editar", classe: "evento-chip--editar", pilula: "pilula--ambar" },
    postar: { rotulo: "Postar", classe: "evento-chip--postar", pilula: "pilula--verde" }
  };
  var MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  function montar(raiz) {
    var hoje = new Date();
    anoAtual = hoje.getFullYear();
    mesAtual = hoje.getMonth();
    tipoFiltro = "todos";

    raiz.innerHTML =
      '<div class="calendario-cabecalho">' +
        '<div class="calendario-nav">' +
          '<button type="button" class="botao-icone" id="calAnterior" aria-label="Mês anterior">' + A.icone("setaEsq") + "</button>" +
          '<span class="calendario-mes-nome" id="calMesNome"></span>' +
          '<button type="button" class="botao-icone" id="calProximo" aria-label="Próximo mês">' + A.icone("setaDir") + "</button>" +
          '<button type="button" class="botao botao--fantasma" id="calHoje">Este mês</button>' +
        "</div>" +
        '<div class="chips-filtro" id="calChips"></div>' +
        '<div class="ferramentas-espaco"></div>' +
        '<button type="button" class="botao" id="calNovo">' + A.icone("mais") + "Adicionar tarefa</button>" +
      "</div>" +
      '<div class="calendario-semana"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>' +
      '<div class="calendario-grade" id="calGrade"></div>' +
      '<div class="bloco-atrasados"><p class="bloco-titulo">Ficou pra trás</p><div class="cartao" id="calAtrasados"></div></div>';

    var chips = ['<button type="button" class="chip-filtro" data-tipo="todos" aria-pressed="true">Todos</button>'];
    Object.keys(TIPOS).forEach(function (t) {
      chips.push('<button type="button" class="chip-filtro" data-tipo="' + t + '" aria-pressed="false">' + TIPOS[t].rotulo + "</button>");
    });
    document.getElementById("calChips").innerHTML = chips.join("");
    document.querySelectorAll("#calChips .chip-filtro").forEach(function (c) {
      c.addEventListener("click", function () {
        tipoFiltro = c.dataset.tipo;
        document.querySelectorAll("#calChips .chip-filtro").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        renderGrade();
      });
    });

    document.getElementById("calAnterior").addEventListener("click", function () { mudarMes(-1); });
    document.getElementById("calProximo").addEventListener("click", function () { mudarMes(1); });
    document.getElementById("calHoje").addEventListener("click", function () {
      var h = new Date(); anoAtual = h.getFullYear(); mesAtual = h.getMonth(); renderGrade();
    });
    document.getElementById("calNovo").addEventListener("click", function () { abrirFormulario(null, A.hojeISO()); });

    carregar();
  }

  function mudarMes(delta) {
    mesAtual += delta;
    if (mesAtual < 0) { mesAtual = 11; anoAtual--; }
    if (mesAtual > 11) { mesAtual = 0; anoAtual++; }
    renderGrade();
  }

  function carregar() {
    Promise.all([
      A.buscar("calendario", function (q) { return q.order("data", { ascending: true }); }),
      A.buscar("campanhas", function (q) { return q.not("prazo", "is", null); })
    ]).then(function (r) {
      itens = r[0].dados;
      campanhas = r[1].dados;
      renderGrade();
      renderAtrasados();
    });
  }

  /* ---------- utilidades de data ---------- */
  function chaveLocal(d) {
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }
  function primeiroDiaGrade(ano, mes) {
    var d = new Date(ano, mes, 1);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  function ultimoDiaGrade(ano, mes) {
    var d = new Date(ano, mes + 1, 0);
    d.setDate(d.getDate() + (6 - ((d.getDay() + 6) % 7)));
    return d;
  }

  /* eventos de um dia específico, já respeitando o filtro de tipo */
  function eventosDoDia(iso) {
    var lista = [];
    itens.forEach(function (i) {
      if (String(i.data).slice(0, 10) !== iso) return;
      if (tipoFiltro !== "todos" && i.tipo !== tipoFiltro) return;
      lista.push({ tipoEvento: "calendario", dado: i });
    });
    campanhas.forEach(function (c) {
      if (!c.prazo || String(c.prazo).slice(0, 10) !== iso) return;
      if (c.status === "Entregue") return;
      lista.push({ tipoEvento: "prazo", dado: c });
    });
    return lista;
  }

  function chipHTML(ev) {
    if (ev.tipoEvento === "prazo") {
      var c = ev.dado;
      return '<button type="button" class="evento-chip evento-chip--prazo" data-prazo="' + A.esc(c.id) + '" title="Prazo de campanha: ' + A.esc(c.campanha) + '">Prazo: ' + A.esc(c.campanha) + "</button>";
    }
    var i = ev.dado;
    var t = TIPOS[i.tipo] || TIPOS.gravar;
    return '<button type="button" class="evento-chip ' + t.classe + (i.status === "feito" ? " evento-chip--feito" : "") + '" data-item="' + A.esc(i.id) + '" title="' + A.esc(t.rotulo + ": " + i.titulo) + '">' + A.esc(i.titulo) + "</button>";
  }

  function renderGrade() {
    document.getElementById("calMesNome").textContent = MESES[mesAtual] + " de " + anoAtual;
    var inicio = primeiroDiaGrade(anoAtual, mesAtual);
    var fim = ultimoDiaGrade(anoAtual, mesAtual);
    var hojeChave = chaveLocal(new Date());
    var celulas = [];
    var cursor = new Date(inicio);
    while (cursor <= fim) {
      var iso = chaveLocal(cursor);
      var foraDoMes = cursor.getMonth() !== mesAtual;
      var ehHoje = iso === hojeChave;
      var eventos = eventosDoDia(iso);
      var visiveis = eventos.slice(0, 3);
      var resto = eventos.length - visiveis.length;
      celulas.push(
        '<div class="dia-mes' + (foraDoMes ? " dia-mes--fora" : "") + (ehHoje ? " dia-mes--hoje" : "") + '" data-data="' + iso + '">' +
          '<span class="dia-numero">' + cursor.getDate() + "</span>" +
          '<div class="dia-itens">' + visiveis.map(chipHTML).join("") +
            (resto > 0 ? '<button type="button" class="dia-mais" data-data="' + iso + '">+' + resto + " mais</button>" : "") +
          "</div>" +
          '<button type="button" class="dia-add" data-data="' + iso + '" aria-label="Adicionar tarefa em ' + iso + '">' + A.icone("mais") + "</button>" +
        "</div>"
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    var grade = document.getElementById("calGrade");
    grade.innerHTML = celulas.join("");

    grade.querySelectorAll(".dia-mes").forEach(function (cel) {
      cel.addEventListener("click", function () { abrirFormulario(null, cel.dataset.data); });
    });
    grade.querySelectorAll(".dia-add").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); abrirFormulario(null, b.dataset.data); });
    });
    grade.querySelectorAll(".dia-mais").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); abrirDia(b.dataset.data); });
    });
    grade.querySelectorAll("[data-item]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var i = itens.filter(function (x) { return x.id === b.dataset.item; })[0];
        if (i) abrirFormulario(i, null);
      });
    });
    grade.querySelectorAll("[data-prazo]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); A.irPara("campanhas"); });
    });
  }

  function abrirDia(iso) {
    var eventos = eventosDoDia(iso);
    var d = new Date(iso + "T00:00:00");
    var html =
      '<h2 class="gaveta-titulo" style="padding-right:10px">' + d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) + "</h2>" +
      '<div style="display:grid;gap:8px;margin-bottom:16px">' +
      (eventos.length ? eventos.map(function (ev) { return '<div style="display:block">' + chipHTML(ev) + "</div>"; }).join("") : '<p class="estado-vazio">Nada marcado pra esse dia.</p>') +
      "</div>" +
      '<button type="button" class="botao" id="diaAdicionar" style="width:100%;justify-content:center">' + A.icone("mais") + "Adicionar tarefa nesse dia</button>";

    A.abrirModal({
      titulo: "Tarefas do dia",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.querySelectorAll("[data-item]").forEach(function (b) {
          b.addEventListener("click", function () {
            var i = itens.filter(function (x) { return x.id === b.dataset.item; })[0];
            A.fecharModal();
            if (i) setTimeout(function () { abrirFormulario(i, null); }, 10);
          });
        });
        caixa.querySelectorAll("[data-prazo]").forEach(function (b) {
          b.addEventListener("click", function () { A.fecharModal(); A.irPara("campanhas"); });
        });
        caixa.querySelector("#diaAdicionar").addEventListener("click", function () {
          A.fecharModal();
          setTimeout(function () { abrirFormulario(null, iso); }, 10);
        });
      }
    });
  }

  /* ---------- ficou pra trás ---------- */
  function renderAtrasados() {
    var alvo = document.getElementById("calAtrasados");
    var hoje = A.hojeISO();
    var atrasados = itens.filter(function (i) { return i.status !== "feito" && String(i.data).slice(0, 10) < hoje; });
    atrasados.sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (!atrasados.length) {
      alvo.innerHTML = '<p class="estado-vazio" style="border:0">Nada atrasado. Tudo em dia por aqui.</p>';
      return;
    }
    alvo.innerHTML = atrasados.map(function (i) {
      var dias = A.diasEntre(String(i.data).slice(0, 10), hoje);
      var t = TIPOS[i.tipo] || TIPOS.gravar;
      return '<div class="atrasado-linha">' +
        '<span class="pilula ' + t.pilula + '" style="flex:0 0 auto">' + t.rotulo + "</span>" +
        '<span style="flex:1">' + A.esc(i.titulo) + (i.marca ? ' <span style="color:var(--tinta-media)">· ' + A.esc(i.marca) + "</span>" : "") + "</span>" +
        '<span class="atrasado-dias">' + dias + (dias === 1 ? " dia atrasado" : " dias atrasado") + "</span>" +
        '<button type="button" class="botao botao--fantasma" data-feito="' + A.esc(i.id) + '" style="padding:5px 10px;font-size:.76rem">Marcar feito</button>' +
        "</div>";
    }).join("");
    alvo.querySelectorAll("[data-feito]").forEach(function (b) {
      b.addEventListener("click", function () {
        A.gravar("calendario", "update", { id: b.dataset.feito, valores: { status: "feito" } }).then(function (r) {
          if (!r.ok) { A.toast("Não consegui salvar. Tenta de novo.", "erro"); return; }
          var i = itens.filter(function (x) { return x.id === b.dataset.feito; })[0];
          if (i) i.status = "feito";
          renderAtrasados(); renderGrade();
          A.toast("Marcado como feito.", "ok");
        });
      });
    });
  }

  /* ---------- formulário ---------- */
  function abrirFormulario(item, dataPreenchida) {
    var ehNovo = !item;
    var html =
      '<h2 class="gaveta-titulo">' + (ehNovo ? "Adicionar tarefa" : "Editar tarefa") + "</h2>" +
      '<form id="formCal" novalidate>' +
        '<label class="campo"><span>Título</span><input type="text" id="fcTitulo" required value="' + A.esc(item ? item.titulo : "") + '"></label>' +
        '<label class="campo"><span>Marca</span><input type="text" id="fcMarca" value="' + A.esc(item ? item.marca : "") + '"></label>' +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Tipo</span><select id="fcTipo">' +
            Object.keys(TIPOS).map(function (t) { return '<option value="' + t + '"' + (item && item.tipo === t ? " selected" : "") + ">" + TIPOS[t].rotulo + "</option>"; }).join("") +
          "</select></label>" +
          '<label class="campo"><span>Data</span><input type="date" id="fcData" required value="' + A.esc(item ? String(item.data).slice(0, 10) : (dataPreenchida || A.hojeISO())) + '"></label>' +
        "</div>" +
        '<label class="campo-check"><input type="checkbox" id="fcFeito"' + (item && item.status === "feito" ? " checked" : "") + "> Já foi feito</label>" +
        '<p class="erro-campo" id="fcErro" hidden></p>' +
        '<div class="gaveta-acoes">' +
          (ehNovo ? "" : '<button type="button" class="botao botao--perigo" id="fcApagar">' + A.icone("lixeira") + "Apagar</button>") +
          '<button type="submit" class="botao">' + (ehNovo ? "Adicionar" : "Salvar") + "</button>" +
        "</div>" +
      "</form>";

    A.abrirModal({
      lateral: true,
      titulo: ehNovo ? "Adicionar tarefa" : "Editar tarefa",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.querySelector("#formCal").addEventListener("submit", function (e) {
          e.preventDefault();
          var titulo = document.getElementById("fcTitulo").value.trim();
          var data = document.getElementById("fcData").value;
          var erro = document.getElementById("fcErro");
          if (!titulo || !data) { erro.hidden = false; erro.textContent = "Preencha ao menos o título e a data."; return; }
          var valores = {
            titulo: titulo,
            marca: document.getElementById("fcMarca").value.trim(),
            tipo: document.getElementById("fcTipo").value,
            data: data,
            status: document.getElementById("fcFeito").checked ? "feito" : "a_fazer"
          };
          if (ehNovo) {
            valores.exemplo = false;
            A.gravar("calendario", "insert", { valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal(); A.toast("Tarefa adicionada.", "ok"); carregar();
            });
          } else {
            valores.exemplo = false;
            A.gravar("calendario", "update", { id: item.id, valores: valores }).then(function (r) {
              if (!r.ok) { erro.hidden = false; erro.textContent = "Não consegui salvar. Tenta de novo."; return; }
              A.fecharModal(); A.toast("Tarefa salva.", "ok"); carregar();
            });
          }
        });
        if (!ehNovo) {
          caixa.querySelector("#fcApagar").addEventListener("click", function () {
            if (!A.confirmarExclusao('Apagar a tarefa "' + item.titulo + '"?')) return;
            A.gravar("calendario", "delete", { id: item.id }).then(function (r) {
              if (!r.ok) { A.toast("Não consegui apagar. Tenta de novo.", "erro"); return; }
              A.fecharModal(); A.toast("Tarefa apagada.", "ok"); carregar();
            });
          });
        }
      }
    });
  }

  window.Admin.registrarSecao({
    id: "calendario",
    grupo: "minha rotina",
    nome: "Calendário",
    legenda: "Sua agenda de gravar, editar e postar.",
    icone: "calendario",
    montar: montar
  });
})();
