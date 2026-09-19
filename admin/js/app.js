/* ============================================================
   PAINEL DA PALOMA - armação (shell)
   Sidebar, troca de aba, acesso ao banco com aviso quando algo
   falta, modal/gaveta reutilizável, toast e funções de apoio
   usadas pelas 5 abas (portfolio.js, marcas.js, calendario.js,
   campanhas.js, checklist.js).

   Cada arquivo de aba chama Admin.registrarSecao({...}) quando
   carrega. Depois que a sessão é confirmada, admin/index.html
   chama Admin.iniciar(usuario).
   ============================================================ */
window.Admin = (function () {
  "use strict";

  /* ============================================================
     ÍCONES - todos de traço (stroke), nenhum emoji
     ============================================================ */
  var ICONES = {
    portfolio: '<svg class="icone" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    marcas: '<svg class="icone" viewBox="0 0 24 24"><path d="M11 3H4v7l10 10 7-7L11 3z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>',
    calendario: '<svg class="icone" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    campanhas: '<svg class="icone" viewBox="0 0 24 24"><path d="M4 20V10M11 20V4M18 20v-6"/></svg>',
    checklist: '<svg class="icone" viewBox="0 0 24 24"><path d="M9 6h12M9 12h12M9 18h8"/><path d="M4.5 5.5l1 1L7.5 4.5M4.5 11.5l1 1 2-2"/></svg>',
    menu: '<svg class="icone" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    fechar: '<svg class="icone" viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    sair: '<svg class="icone" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
    aviso: '<svg class="icone" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    mais: '<svg class="icone" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    lapis: '<svg class="icone" viewBox="0 0 24 24"><path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z"/></svg>',
    lixeira: '<svg class="icone" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    olho: '<svg class="icone" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
    olhoFechado: '<svg class="icone" viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a17.3 17.3 0 0 1-3.2 3.9M6.6 6.6C4 8.3 2 12 2 12s4 7 10 7c1.4 0 2.7-.3 3.9-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    arrasto: '<svg class="icone" viewBox="0 0 24 24"><circle cx="8" cy="6" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="8" cy="18" r="1.2"/><circle cx="16" cy="6" r="1.2"/><circle cx="16" cy="12" r="1.2"/><circle cx="16" cy="18" r="1.2"/></svg>',
    estrela: '<svg class="icone" viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6L12 3z"/></svg>',
    busca: '<svg class="icone" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    baixar: '<svg class="icone" viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5"/><path d="M4 20h16"/></svg>',
    whatsapp: '<svg class="icone" viewBox="0 0 24 24"><path d="M21 11.6a8.4 8.4 0 0 1-12.2 7.5L4 20l1-4.6a8.4 8.4 0 1 1 16-3.8z"/><path d="M8.6 8.6c.2-.5.9-1.5 1.5-.8.4.5.9 1.3.6 1.8-.3.5-.6.6-.3 1.1a5 5 0 0 0 2.9 2.3c.5.2.6-.2 1-.5.5-.4 1.3.4 1.7.7.5.4-.1 1.3-.6 1.6-1 .6-2.4.3-4-.6a8 8 0 0 1-3-3.4c-.3-.9-.2-1.5.2-2.2z"/></svg>',
    instagram: '<svg class="icone" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6" fill="currentColor" stroke="none"/></svg>',
    setaEsq: '<svg class="icone" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    setaDir: '<svg class="icone" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    externo: '<svg class="icone" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4L10 14M6 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1"/></svg>',
    seta: '<svg class="icone" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    ordemNeutra: '<svg class="icone seta-ordem" viewBox="0 0 24 24"><path d="M7 9l5-5 5 5M7 15l5 5 5-5"/></svg>',
    ordemAsc: '<svg class="icone seta-ordem" viewBox="0 0 24 24"><path d="M7 14l5 5 5-5"/></svg>',
    ordemDesc: '<svg class="icone seta-ordem" viewBox="0 0 24 24"><path d="M7 10l5-5 5 5"/></svg>'
  };

  function icone(nome) { return ICONES[nome] || ""; }

  /* ============================================================
     ESCAPE / FORMATAÇÃO
     ============================================================ */
  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function hojeISO() {
    var d = new Date();
    var mes = String(d.getMonth() + 1).padStart(2, "0");
    var dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mes + "-" + dia;
  }

  function formatarData(iso) {
    if (!iso) return "";
    var partes = String(iso).slice(0, 10).split("-");
    if (partes.length !== 3) return iso;
    return partes[2] + "/" + partes[1] + "/" + partes[0];
  }

  function formatarDataHora(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatarMoeda(valor) {
    var n = Number(valor) || 0;
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function diasEntre(deISO, ateISO) {
    var de = new Date(deISO + "T00:00:00");
    var ate = new Date(ateISO + "T00:00:00");
    return Math.round((ate.getTime() - de.getTime()) / 86400000);
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function somenteDigitos(t) { return String(t || "").replace(/\D/g, ""); }

  /* ============================================================
     ACESSO AO BANCO, COM AVISO QUANDO ALGO FALTA
     ============================================================
     Se uma tabela ou coluna não existir (por exemplo, o SQL ainda
     não foi rodado), isso NUNCA derruba o admin inteiro: a seção
     mostra um aviso claro no topo e segue funcionando no resto. */
  var avisosAtivos = {};

  function limparAvisos() {
    avisosAtivos = {};
    renderizarAvisos();
  }

  function avisar(chave, erro) {
    console.error("Admin: problema com \"" + chave + "\":", erro);
    var msg = "Não consegui falar com \"" + chave + "\".";
    if (!window.banco) {
      msg = "Não consegui me conectar ao banco agora. Confira sua internet e recarregue a página.";
    } else if (erro && erro.code === "42P01") {
      msg = "A tabela \"" + chave + "\" ainda não existe no banco. Você já colou o arquivo banco.sql no Supabase?";
    } else if (erro && erro.code === "42703") {
      msg = "Falta uma coluna que \"" + chave + "\" espera. Confira se rodou o banco.sql inteiro, sem pular nenhuma parte.";
    } else if (erro && (erro.code === "PGRST301" || erro.code === "42501" || /row-level security/i.test(erro.message || ""))) {
      msg = "O banco recusou o acesso a \"" + chave + "\" (tranca de segurança). Confira se você está logada e se o SQL de permissões rodou certinho.";
    } else if (erro && erro.message) {
      msg = "Não consegui falar com \"" + chave + "\": " + erro.message;
    }
    avisosAtivos[chave] = msg;
    renderizarAvisos();
  }

  function renderizarAvisos() {
    var alvo = document.getElementById("avisosPainel");
    if (!alvo) return;
    var chaves = Object.keys(avisosAtivos);
    if (!chaves.length) { alvo.innerHTML = ""; return; }
    alvo.innerHTML = chaves.map(function (k) {
      return '<p class="aviso">' + icone("aviso") + '<span>' + esc(avisosAtivos[k]) + "</span></p>";
    }).join("");
  }

  /* leitura genérica de uma tabela, sempre protegida */
  function buscar(tabela, montar) {
    if (!window.banco) {
      avisar(tabela, null);
      return Promise.resolve({ ok: false, dados: [] });
    }
    var consulta = window.banco.from(tabela).select("*");
    if (typeof montar === "function") {
      var ajustada = montar(consulta);
      if (ajustada) consulta = ajustada;
    }
    return consulta.then(function (resp) {
      if (resp.error) throw resp.error;
      return { ok: true, dados: resp.data || [] };
    }).catch(function (erro) {
      avisar(tabela, erro);
      return { ok: false, dados: [] };
    });
  }

  /* escrita genérica (inserir, editar, apagar), sempre protegida */
  function gravar(tabela, operacao, args) {
    if (!window.banco) {
      return Promise.resolve({ ok: false, erro: new Error("sem conexão com o banco") });
    }
    var base = window.banco.from(tabela);
    var chamada;
    if (operacao === "insert") chamada = base.insert(args.valores).select();
    else if (operacao === "update") chamada = base.update(args.valores).eq("id", args.id).select();
    else if (operacao === "delete") chamada = base.delete().eq("id", args.id);
    else return Promise.resolve({ ok: false, erro: new Error("operação desconhecida") });

    return chamada.then(function (resp) {
      if (resp.error) throw resp.error;
      return { ok: true, dados: resp.data };
    }).catch(function (erro) {
      console.error("Admin.gravar", tabela, operacao, erro);
      return { ok: false, erro: erro };
    });
  }

  /* ============================================================
     TOAST (confirmação rápida no rodapé da tela)
     ============================================================ */
  function toast(msg, tipo) {
    var area = document.getElementById("toastArea");
    if (!area) return;
    var el = document.createElement("p");
    el.className = "toast" + (tipo === "erro" ? " toast--erro" : tipo === "ok" ? " toast--ok" : "");
    el.textContent = msg;
    area.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .3s ease";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 320);
    }, 2600);
  }

  function confirmarExclusao(msg) {
    return window.confirm(msg);
  }

  /* ============================================================
     MODAL / GAVETA reutilizável
     ============================================================ */
  var modalAtual = null;

  function fecharModal() {
    if (!modalAtual) return;
    document.removeEventListener("keydown", modalAtual.tecla);
    modalAtual.overlay.remove();
    document.body.style.overflow = "";
    if (modalAtual.focoAnterior && modalAtual.focoAnterior.focus) {
      try { modalAtual.focoAnterior.focus(); } catch (e) {}
    }
    modalAtual = null;
  }

  /* opcoes: { lateral: bool, titulo, corpoHTML, onMontar(caixaEl) } */
  function abrirModal(opcoes) {
    fecharModal();
    var overlay = document.createElement("div");
    overlay.className = "sobreposicao " + (opcoes.lateral ? "sobreposicao--lateral" : "sobreposicao--centro");
    var caixa = document.createElement("div");
    caixa.className = opcoes.lateral ? "gaveta" : "modal-caixa";
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-modal", "true");
    if (opcoes.titulo) caixa.setAttribute("aria-label", opcoes.titulo);

    var fechar = document.createElement("button");
    fechar.type = "button";
    fechar.className = opcoes.lateral ? "gaveta-fechar" : "modal-fechar";
    fechar.innerHTML = icone("fechar");
    fechar.setAttribute("aria-label", "Fechar");
    fechar.addEventListener("click", fecharModal);

    var corpo = document.createElement("div");
    corpo.innerHTML = opcoes.corpoHTML || "";

    caixa.appendChild(fechar);
    caixa.appendChild(corpo);
    overlay.appendChild(caixa);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) fecharModal(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    function tecla(e) { if (e.key === "Escape") fecharModal(); }
    document.addEventListener("keydown", tecla);
    modalAtual = { overlay: overlay, tecla: tecla, focoAnterior: document.activeElement };

    if (typeof opcoes.onMontar === "function") opcoes.onMontar(caixa);

    var focavel = caixa.querySelector("input,select,textarea,button:not(.gaveta-fechar):not(.modal-fechar)");
    (focavel || fechar).focus();
    return caixa;
  }

  /* ============================================================
     CSV (com acento, abre certinho no Excel)
     ============================================================ */
  function baixarCSV(nomeArquivo, cabecalhos, linhas) {
    function campo(v) {
      var t = v == null ? "" : String(v);
      if (/[;"\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      return t;
    }
    var texto = cabecalhos.map(campo).join(";") + "\r\n" +
      linhas.map(function (l) { return l.map(campo).join(";"); }).join("\r\n");
    var blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ============================================================
     SEÇÕES (abas) - cada arquivo da pasta admin/js se registra
     ============================================================ */
  var secoesRegistradas = [];
  var secaoAtivaId = null;

  function registrarSecao(def) {
    secoesRegistradas.push(def);
  }

  function montarLateral() {
    var grupos = {};
    var ordemGrupos = [];
    secoesRegistradas.forEach(function (s) {
      if (!grupos[s.grupo]) { grupos[s.grupo] = []; ordemGrupos.push(s.grupo); }
      grupos[s.grupo].push(s);
    });
    var html = ordemGrupos.map(function (nomeGrupo) {
      var itens = grupos[nomeGrupo].map(function (s) {
        return '<button type="button" class="lateral-item" data-secao="' + esc(s.id) + '">' +
          icone(s.icone) + "<span>" + esc(s.nome) + "</span></button>";
      }).join("");
      return '<div class="lateral-grupo"><p class="lateral-grupo-titulo">' + esc(nomeGrupo) + "</p>" + itens + "</div>";
    }).join("");
    document.getElementById("lateralNav").innerHTML = html;

    document.querySelectorAll(".lateral-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        irPara(btn.dataset.secao);
        fecharGavetaLateral();
      });
    });
  }

  function irPara(id) {
    var secao = secoesRegistradas.filter(function (s) { return s.id === id; })[0];
    if (!secao) return;
    secaoAtivaId = id;

    document.querySelectorAll(".lateral-item").forEach(function (btn) {
      if (btn.dataset.secao === id) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    document.getElementById("tituloTopoMobile").textContent = secao.nome;
    document.getElementById("conteudoTitulo").textContent = secao.nome;
    document.getElementById("conteudoLegenda").textContent = secao.legenda || "";

    limparAvisos();
    var raiz = document.getElementById("conteudoSecao");
    raiz.innerHTML = '<p class="estado-vazio">Carregando…</p>';
    try {
      secao.montar(raiz);
    } catch (erro) {
      console.error("Erro ao abrir a seção " + id + ":", erro);
      raiz.innerHTML = '<p class="estado-vazio">Essa aba encontrou um problema pra abrir. O resto do painel continua funcionando; tenta trocar de aba e voltar aqui de novo.</p>';
    }
  }

  /* ---------- gaveta do menu no celular ---------- */
  function abrirGavetaLateral() {
    document.querySelector(".lateral").classList.add("aberta");
    document.getElementById("cortinaLateral").classList.add("aberta");
  }
  function fecharGavetaLateral() {
    document.querySelector(".lateral").classList.remove("aberta");
    document.getElementById("cortinaLateral").classList.remove("aberta");
  }

  /* ============================================================
     INÍCIO
     ============================================================ */
  function iniciar(usuario) {
    document.getElementById("lateralEmail").textContent = (usuario && usuario.email) || "";
    document.getElementById("botaoHamb").innerHTML = icone("menu");
    document.getElementById("botaoSair").innerHTML = icone("sair") + "<span>Sair</span>";
    montarLateral();

    document.getElementById("botaoHamb").addEventListener("click", abrirGavetaLateral);
    document.getElementById("cortinaLateral").addEventListener("click", fecharGavetaLateral);

    document.getElementById("botaoSair").addEventListener("click", function () {
      if (!window.banco) { window.location.replace("../login/"); return; }
      window.banco.auth.signOut().then(function () {
        window.location.replace("../login/");
      }).catch(function () {
        window.location.replace("../login/");
      });
    });

    var primeira = secoesRegistradas[0];
    if (primeira) irPara(primeira.id);
  }

  return {
    icone: icone,
    esc: esc,
    hojeISO: hojeISO,
    formatarData: formatarData,
    formatarDataHora: formatarDataHora,
    formatarMoeda: formatarMoeda,
    diasEntre: diasEntre,
    debounce: debounce,
    somenteDigitos: somenteDigitos,
    buscar: buscar,
    gravar: gravar,
    avisar: avisar,
    toast: toast,
    confirmarExclusao: confirmarExclusao,
    abrirModal: abrirModal,
    fecharModal: fecharModal,
    baixarCSV: baixarCSV,
    registrarSecao: registrarSecao,
    irPara: irPara,
    iniciar: iniciar
  };
})();
