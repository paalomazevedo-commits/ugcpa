/* ============================================================
   ABA ABORDAGENS E BIOS
   As bases de referência da Paloma num lugar só:
   - Abordagens: um texto modelo pra cada canal (Gmail, e-mail
     pela plataforma, DM do Instagram, WhatsApp, plataformas de
     UGC). O que muda de marca pra marca fica grifado de amarelo
     e se preenche pelo formulário do lado ou clicando no texto.
     Cada canal pode ter várias versões, e tudo é editável.
   - Bios: a bio de cada rede, com contador de caracteres.

   Os textos padrão (PADRAO_CANAIS e PADRAO_BIOS) entram no banco
   sozinhos na primeira vez que a aba abre. Depois disso, o que
   vale é o que está no banco.

   Tabelas usadas: abordagens_canais, abordagens_modelos, bios e
   configuracoes (sql-abordagens.sql).
   ============================================================ */
(function () {
  var A = window.Admin;

  var CHAVE_RESPOSTAS = "abordagens_respostas";

  /* campos que podem aparecer nos textos como {{chave}}.
     grupo "voce" vale pra todos os canais; grupo "marca" muda a
     cada abordagem e tem o botão de limpar. */
  var CAMPOS = [
    { k: "nome", g: "voce", rotulo: "seu nome", label: "Nome" },
    { k: "arroba", g: "voce", rotulo: "seu @", label: "@", dica: "Sem o @ na frente." },
    { k: "portfolio", g: "voce", rotulo: "portfólio", label: "Portfólio" },
    { k: "cidade", g: "voce", rotulo: "cidade", label: "Cidade" },
    { k: "whatsapp", g: "voce", rotulo: "seu WhatsApp", label: "WhatsApp" },
    { k: "diferenciais", g: "voce", rotulo: "seus diferenciais", label: "Seus diferenciais", longo: true, dica: "O que te faz diferente." },
    { k: "marca", g: "marca", rotulo: "pessoa ou nome da marca", label: "Pessoa ou marca" },
    { k: "produto", g: "marca", rotulo: "produto", label: "Produto" },
    { k: "link", g: "marca", rotulo: "link do produto", label: "Link do produto" },
    { k: "viu", g: "marca", rotulo: "o que você viu", label: "O que você viu no site ou perfil deles", longo: true, dica: "Uma coisa específica. É o que prova que você pesquisou." },
    { k: "conexao", g: "marca", rotulo: "por que vocês dão match", label: "A conexão", longo: true, dica: "Por que essa marca faz sentido pra você agora." },
    { k: "ideia", g: "marca", rotulo: "a ideia", label: "A ideia", longo: true, dica: "O conteúdo que você já pensou pra eles." }
  ];
  var CAMPO = {};
  CAMPOS.forEach(function (c) { CAMPO[c.k] = c; });

  var PADRAO_VOCE = {
    nome: "Paloma Ribeiro",
    arroba: "paalomaribeiro",
    portfolio: "palomaribeiro.com.br",
    cidade: "Praia Grande",
    whatsapp: "",
    diferenciais: "Sou criadora de conteúdo UGC há quase 2 anos. Tenho compartilhado a minha jornada antes dos 30."
  };

  var PADRAO_CANAIS = [
    {
      padrao: "gmail", nome: "E-mail (Gmail)",
      dica: "Quatro parágrafos curtos. Assunto direto, com o nome do produto.",
      estrutura: [
        ["Quem você é", "E como você chegou nessa marca."],
        ["A conexão", "Por que vocês dão match agora."],
        ["A ideia", "O conteúdo que você já pensou."],
        ["O convite", "A pergunta e o seu portfólio."]
      ],
      versoes: [
        {
          padrao: "gmail-direta", nome: "A proposta direta",
          assunto: "Proposta de conteúdo pro {{produto}} de vocês",
          corpo: "Oieee {{marca}}, tudo bem?\n\nAqui é a {{nome}}, criadora de conteúdo UGC de {{cidade}} (@{{arroba}}). Cheguei em vocês pesquisando {{produto}} e acabei ficando um tempão no site, principalmente {{viu}}\n\n{{conexao}} É esse aqui ó: {{link}}.\n\nA ideia: {{ideia}} Isso vira vídeo vertical e fotos pra vocês usarem, inclusive em ads, e eu documento no meu perfil com @ e link.\n\n{{diferenciais}}\n\nSe fizer sentido, vai ser incrível ter vocês nesse projeto :)\nPortfólio: {{portfolio}}"
        },
        {
          padrao: "gmail-curta", nome: "Curta e objetiva",
          assunto: "{{nome}} x {{marca}}: ideia de conteúdo",
          corpo: "Oi, {{marca}}! Tudo bem?\n\nSou a {{nome}} (@{{arroba}}), criadora de conteúdo UGC. {{conexao}}\n\nPensei num conteúdo assim: {{ideia}}\n\nTopam conversar? Meu portfólio tá aqui: {{portfolio}}"
        },
        {
          padrao: "gmail-follow", nome: "Segundo e-mail (follow-up)",
          assunto: "Re: Proposta de conteúdo pro {{produto}} de vocês",
          corpo: "Oi de novo, {{marca}}!\n\nPassando só pra saber se vocês conseguiram ver a minha ideia pro {{produto}}.\n\nResumindo: {{ideia}}\n\nSe não for o momento, sem problemas! Fico de olho nas próximas campanhas.\nPortfólio: {{portfolio}}"
        }
      ]
    },
    {
      padrao: "plataforma", nome: "E-mail pela plataforma",
      dica: "Pra formulários de contato do site da marca e e-mails mandados por plataforma. Mais formal e sem anexo.",
      estrutura: [
        ["Apresentação", "Nome, o que você faz e o seu @."],
        ["A conexão", "Por que essa marca."],
        ["A ideia", "Um resumo do conteúdo."],
        ["O próximo passo", "Pedir o contato de parcerias."]
      ],
      versoes: [
        {
          padrao: "plataforma-form", nome: "Mensagem pelo formulário",
          assunto: "Parceria de conteúdo UGC | {{nome}}",
          corpo: "Olá, equipe {{marca}}! Meu nome é {{nome}}, sou criadora de conteúdo UGC (@{{arroba}}).\n\n{{conexao}}\n\nTenho uma ideia de conteúdo pro {{produto}}: {{ideia}}\n\nGostaria de saber quem é a pessoa responsável por parcerias pra eu enviar a proposta completa.\nMeu portfólio: {{portfolio}}"
        }
      ]
    },
    {
      padrao: "dm", nome: "DM do Instagram",
      dica: "Curta, leve e sem link na primeira mensagem. O objetivo é abrir a conversa.",
      estrutura: [
        ["Abre a conversa", "Um oi de verdade."],
        ["A conexão", "O que você viu e gostou."],
        ["O convite", "Pergunta onde mandar a proposta."]
      ],
      versoes: [
        {
          padrao: "dm-primeira", nome: "Primeira DM", assunto: "",
          corpo: "Oiee, tudo bem? 💛\n\nSou a {{nome}}, crio conteúdo UGC aqui de {{cidade}}. {{conexao}}\n\nTive uma ideia de conteúdo pro {{produto}} de vocês: {{ideia}}\n\nPosso mandar a proposta por aqui ou tem um e-mail melhor?"
        },
        {
          padrao: "dm-stories", nome: "Respondendo um story", assunto: "",
          corpo: "Oi! Amei {{viu}} 😍\n\nInclusive, sou criadora de conteúdo UGC e tô com uma ideia pro {{produto}}: {{ideia}}\n\nSe fizer sentido, te mando meu portfólio: {{portfolio}}"
        }
      ]
    },
    {
      padrao: "whatsapp", nome: "WhatsApp",
      dica: "Primeiro descubra com quem falar. A proposta vai na segunda mensagem.",
      estrutura: [
        ["Quem você é", "Nome e @."],
        ["A conexão", "Por que você chamou."],
        ["A pergunta", "Com quem falar sobre parcerias."]
      ],
      versoes: [
        {
          padrao: "whats-primeiro", nome: "Primeiro contato", assunto: "",
          corpo: "Oi, {{marca}}! Tudo bem? Aqui é a {{nome}}, criadora de conteúdo UGC (@{{arroba}}).\n\n{{conexao}}\n\nTenho uma ideia de conteúdo pro {{produto}} de vocês e queria saber com quem posso falar sobre parcerias. Pode ser por aqui mesmo?"
        },
        {
          padrao: "whats-proposta", nome: "Mandando a proposta", assunto: "",
          corpo: "Perfeito, obrigada! 🙏\n\nA ideia: {{ideia}}\n\nEntrego vídeo vertical e fotos pra vocês usarem nas redes e em ads.\n\nMeu portfólio: {{portfolio}}\n\nFico no aguardo!"
        }
      ]
    },
    {
      padrao: "plataformas-ugc", nome: "Plataformas de UGC",
      dica: "Pra candidaturas em campanhas de plataformas de UGC. Responda ao briefing, não fale só de você.",
      estrutura: [
        ["Apresentação", "Quem você é, em uma linha."],
        ["Por que você", "Seus diferenciais."],
        ["A ideia", "Como você faria o briefing."],
        ["A entrega", "Formato, prazo e portfólio."]
      ],
      versoes: [
        {
          padrao: "ugc-candidatura", nome: "Candidatura a campanha", assunto: "",
          corpo: "Oi, time {{marca}}! Sou a {{nome}}, criadora de conteúdo UGC de {{cidade}}.\n\n{{diferenciais}}\n\nPra essa campanha, pensei em: {{ideia}}\n\nEntrego no prazo combinado, com vídeo vertical pronto pra ads e direitos de uso conforme o briefing.\nPortfólio: {{portfolio}}"
        }
      ]
    }
  ];

  var PADRAO_BIOS = [
    { plataforma: "Instagram", limite: 150, texto: "Criadora de conteúdo UGC 🎥 | Praia Grande 🌊\nMinha jornada antes dos 30\nParcerias: palomaribeiro.com.br" },
    { plataforma: "TikTok", limite: 80, texto: "Criadora UGC 🎥 Minha jornada antes dos 30" },
    { plataforma: "Plataformas de UGC", limite: 0, texto: "Sou a Paloma, criadora de conteúdo UGC de Praia Grande há quase 2 anos. Crio vídeos verticais e fotos para marcas usarem nas redes e em anúncios." }
  ];

  /* ---------- estado (sobrevive à troca de aba) ---------- */
  var canais = [];
  var modelos = [];
  var bios = [];
  var respostas = { voce: Object.assign({}, PADRAO_VOCE), marca: {}, semeado: false };
  var carregado = false;
  var subAtiva = "abordagens";
  var canalAtualId = null;
  var versaoPorCanal = {};

  /* ============================================================
     APOIO
     ============================================================ */
  var esc = A.esc;

  function valor(k) {
    var c = CAMPO[k];
    return c ? String(respostas[c.g][k] || "") : "";
  }

  function versoesDe(canalId) {
    return modelos.filter(function (m) { return m.canal_id === canalId; })
      .sort(function (a, b) { return a.ordem - b.ordem; });
  }

  function canalAtual() {
    var c = canais.filter(function (x) { return x.id === canalAtualId; })[0];
    if (!c && canais.length) { c = canais[0]; canalAtualId = c.id; }
    return c || null;
  }

  function versaoAtual() {
    var c = canalAtual();
    if (!c) return null;
    var lista = versoesDe(c.id);
    var i = versaoPorCanal[c.id] || 0;
    if (i >= lista.length) i = versaoPorCanal[c.id] = 0;
    return lista[i] || null;
  }

  function padraoDaVersao(padrao) {
    if (!padrao) return null;
    for (var i = 0; i < PADRAO_CANAIS.length; i++) {
      var v = PADRAO_CANAIS[i].versoes.filter(function (x) { return x.padrao === padrao; })[0];
      if (v) return v;
    }
    return null;
  }

  function proximaOrdem(lista) {
    return lista.reduce(function (max, x) { return Math.max(max, x.ordem || 0); }, -1) + 1;
  }

  /* troca {{chave}} pelo valor; o que está vazio vira "(rótulo)" */
  function preencher(tpl, faltando) {
    return String(tpl || "").replace(/\{\{(\w+)\}\}/g, function (m, k) {
      var c = CAMPO[k];
      if (!c) return m;
      var v = valor(k).trim();
      if (!v) {
        if (faltando && faltando.indexOf(c.rotulo) === -1) faltando.push(c.rotulo);
        return "(" + c.rotulo + ")";
      }
      return v;
    });
  }

  function campoHTML(k) {
    var c = CAMPO[k];
    return '<span class="ab-campo ab-campo--' + c.g + '" contenteditable="plaintext-only" spellcheck="true" role="textbox"' +
      ' data-k="' + k + '" data-rotulo="(' + esc(c.rotulo) + ')" aria-label="' + esc(c.label) + '">' + esc(valor(k)) + "</span>";
  }

  function trechoHTML(texto) {
    return esc(texto).replace(/\{\{(\w+)\}\}/g, function (m, k) { return CAMPO[k] ? campoHTML(k) : m; });
  }

  function copiar(texto, msg) {
    function reserva() {
      var ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      A.toast(ok ? msg : "Não deu pra copiar. Selecione o texto e copie na mão.", ok ? "ok" : "erro");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { A.toast(msg, "ok"); }, reserva);
    } else reserva();
  }

  /* ============================================================
     BANCO
     ============================================================ */
  function mensagemBanco(erro) {
    var codigo = erro && erro.code;
    var texto = (erro && erro.message) || "";
    if (codigo === "42P01" || codigo === "PGRST205" || /does not exist|could not find the table/i.test(texto)) {
      return "As tabelas de abordagens ainda não existem no banco. Cole o arquivo sql-abordagens.sql no Supabase (SQL Editor, depois Run) e recarregue a página.";
    }
    if (codigo === "42501" || codigo === "PGRST301" || /row-level security|permission denied/i.test(texto)) {
      return "O banco recusou o acesso. Confira se você está logada e se o sql-abordagens.sql rodou inteiro.";
    }
    return "Não consegui falar com o banco agora. Confira a internet e recarregue a página.";
  }

  function lerTabela(tabela) {
    return window.banco.from(tabela).select("*").order("ordem").then(function (resp) {
      if (resp.error) throw resp.error;
      return resp.data || [];
    });
  }

  function carregar() {
    if (!window.banco) return Promise.reject(null);
    return Promise.all([
      lerTabela("abordagens_canais"),
      lerTabela("abordagens_modelos"),
      lerTabela("bios"),
      window.banco.from("configuracoes").select("valor").eq("chave", CHAVE_RESPOSTAS).maybeSingle().then(function (resp) {
        if (resp.error) throw resp.error;
        return resp.data && resp.data.valor;
      })
    ]).then(function (r) {
      canais = r[0];
      modelos = r[1];
      bios = r[2];
      if (r[3]) {
        try {
          var salvo = JSON.parse(r[3]);
          Object.assign(respostas.voce, salvo.voce || {});
          respostas.marca = salvo.marca || {};
          respostas.semeado = !!salvo.semeado;
        } catch (e) { /* valor estragado: fica com o padrão */ }
      }
      if (!respostas.semeado) return semear();
    }).then(function () { carregado = true; });
  }

  /* primeira vez: coloca os textos padrão no banco (só nas tabelas que estão vazias) */
  function semear() {
    var passos = Promise.resolve();
    if (!canais.length) {
      passos = window.banco.from("abordagens_canais").insert(PADRAO_CANAIS.map(function (c, i) {
        return { padrao: c.padrao, nome: c.nome, dica: c.dica, estrutura: c.estrutura, ordem: i };
      })).select().then(function (resp) {
        if (resp.error) throw resp.error;
        canais = resp.data.sort(function (a, b) { return a.ordem - b.ordem; });
        var linhas = [];
        PADRAO_CANAIS.forEach(function (c) {
          var id = canais.filter(function (x) { return x.padrao === c.padrao; })[0].id;
          c.versoes.forEach(function (v, i) {
            linhas.push({ canal_id: id, padrao: v.padrao, nome: v.nome, assunto: v.assunto, corpo: v.corpo, ordem: i });
          });
        });
        return window.banco.from("abordagens_modelos").insert(linhas).select();
      }).then(function (resp) {
        if (resp.error) throw resp.error;
        modelos = resp.data;
      });
    }
    if (!bios.length) {
      passos = passos.then(function () {
        return window.banco.from("bios").insert(PADRAO_BIOS.map(function (b, i) {
          return { plataforma: b.plataforma, texto: b.texto, limite: b.limite, ordem: i };
        })).select();
      }).then(function (resp) {
        if (resp.error) throw resp.error;
        bios = resp.data.sort(function (a, b) { return a.ordem - b.ordem; });
      });
    }
    return passos.then(function () {
      respostas.semeado = true;
      return gravarRespostas();
    });
  }

  function gravarRespostas() {
    if (!window.banco) return Promise.resolve();
    return window.banco.from("configuracoes")
      .upsert({ chave: CHAVE_RESPOSTAS, valor: JSON.stringify(respostas) }, { onConflict: "chave" })
      .then(function (resp) {
        if (resp.error) throw resp.error;
        marcarSalvo("Salvo");
      }).catch(function (erro) {
        console.error("Abordagens: erro ao salvar as respostas", erro);
        marcarSalvo("Não salvou. Confira a internet.", true);
      });
  }
  var gravarRespostasDepois = A.debounce(gravarRespostas, 700);

  function marcarSalvo(texto, erro) {
    var el = document.getElementById("abSalvo");
    if (!el) return;
    el.textContent = texto;
    el.classList.toggle("ab-salvo--erro", !!erro);
  }

  /* ============================================================
     DESENHO: ABORDAGENS
     ============================================================ */
  function desenharAbordagens(alvo) {
    var c = canalAtual();
    if (!c) {
      alvo.innerHTML = '<p class="estado-vazio">Nenhum canal ainda. <button type="button" class="botao botao--linha botao--mini" id="abNovoCanal">' + A.icone("mais") + "Criar o primeiro canal</button></p>";
      return;
    }
    var chips = canais.map(function (x) {
      return '<button type="button" class="chip-filtro" data-canal="' + esc(x.id) + '" aria-pressed="' + (x.id === c.id) + '">' + esc(x.nome) + "</button>";
    }).join("");
    var passos = Array.isArray(c.estrutura) ? c.estrutura : [];

    alvo.innerHTML =
      '<div class="ferramentas"><div class="chips-filtro" id="abCanais">' + chips + "</div>" +
        '<button type="button" class="botao botao--fantasma botao--mini" id="abNovoCanal">' + A.icone("mais") + "Novo canal</button></div>" +
      (passos.length ? '<div class="ab-passos">' + passos.map(function (p, i) {
        return '<div class="ab-passo"><span class="ab-passo-num">Parte ' + (i + 1) + "</span><strong>" + esc(p[0]) + "</strong><span>" + esc(p[1]) + "</span></div>";
      }).join("") + "</div>" : "") +
      '<p class="ab-legenda"><span class="ab-amostra ab-campo--marca">grifado</span> muda de marca pra marca · ' +
        '<span class="ab-amostra ab-campo--voce">sublinhado</span> é sobre você e vale pra todos os canais. Clica em cima e escreve.</p>' +
      '<div class="ab-grade">' +
        '<section class="cartao ab-rascunho" aria-label="Mensagem">' +
          '<div class="ab-rascunho-topo">' +
            '<span class="ab-versao-info" id="abInfo"></span>' +
            '<div class="ab-acoes">' +
              '<button type="button" class="botao" id="abCopiar">' + A.icone("copiar") + "Copiar mensagem</button>" +
              '<button type="button" class="botao botao--linha" id="abOutra">Outra versão</button>' +
              '<button type="button" class="botao botao--fantasma" id="abEditar">' + A.icone("lapis") + "Editar base</button>" +
            "</div>" +
          "</div>" +
          '<div class="ab-texto" id="abTexto"></div>' +
          '<div class="ab-rascunho-base">' +
            '<button type="button" class="botao botao--fantasma botao--mini" id="abCopiarAssunto">Copiar só o assunto</button>' +
            '<button type="button" class="botao botao--fantasma botao--mini" id="abNovaVersao">' + A.icone("mais") + "Nova versão</button>" +
            '<button type="button" class="botao botao--fantasma botao--mini" id="abOriginal">Voltar ao original</button>' +
          "</div>" +
        "</section>" +
        '<aside class="cartao cartao-pad ab-respostas" id="abRespostas" aria-label="Respostas">' +
          '<p class="texto-apoio">Responde do jeito que você falaria. O texto ao lado se monta sozinho.</p>' +
          '<h3 class="ab-grupo-titulo">Sobre você</h3>' + camposForm("voce") +
          '<h3 class="ab-grupo-titulo">Sobre a marca</h3>' + camposForm("marca") +
          '<div class="ab-respostas-base"><button type="button" class="botao botao--fantasma botao--mini" id="abLimpar">Limpar marca</button>' +
            '<span class="ab-salvo" id="abSalvo"></span></div>' +
        "</aside>" +
      "</div>";

    desenharTexto();
  }

  function camposForm(grupo) {
    return CAMPOS.filter(function (c) { return c.g === grupo; }).map(function (c) {
      var id = "abF-" + c.k;
      var entrada = c.longo
        ? '<textarea id="' + id + '" data-k="' + c.k + '">' + esc(valor(c.k)) + "</textarea>"
        : '<input id="' + id + '" data-k="' + c.k + '" value="' + esc(valor(c.k)) + '">';
      return '<label class="campo" for="' + id + '"><span>' + esc(c.label) + "</span>" + entrada +
        (c.dica ? '<small class="ab-dica-campo">' + esc(c.dica) + "</small>" : "") + "</label>";
    }).join("");
  }

  function desenharTexto() {
    var c = canalAtual(), v = versaoAtual();
    var alvo = document.getElementById("abTexto");
    if (!alvo || !c) return;
    var lista = versoesDe(c.id);
    var i = versaoPorCanal[c.id] || 0;

    document.getElementById("abInfo").textContent = v ? "Versão " + (i + 1) + " de " + lista.length + " · " + v.nome : "Sem versão";
    document.getElementById("abOutra").hidden = lista.length < 2;
    document.getElementById("abCopiar").disabled = !v;
    document.getElementById("abEditar").disabled = !v;
    document.getElementById("abCopiarAssunto").hidden = !(v && v.assunto);
    var p = v && padraoDaVersao(v.padrao);
    document.getElementById("abOriginal").hidden = !p || (p.nome === v.nome && p.assunto === (v.assunto || "") && p.corpo === v.corpo);

    if (!v) {
      alvo.innerHTML = '<p class="estado-vazio">Esse canal ainda não tem texto. Clica em "Nova versão" pra escrever o primeiro.</p>';
      return;
    }
    var html = "";
    if (v.assunto) html += '<p class="ab-rotulo">Assunto</p><p class="ab-assunto">' + trechoHTML(v.assunto) + "</p>";
    html += String(v.corpo || "").split(/\n\s*\n/).map(function (par) {
      return "<p>" + trechoHTML(par).replace(/\n/g, "<br>") + "</p>";
    }).join("");
    if (c.dica) html += '<p class="ab-dica">' + esc(c.dica) + "</p>";
    alvo.innerHTML = html;
  }

  /* muda um campo em todos os lugares, menos onde está sendo digitado */
  function mudarCampo(k, v, origem) {
    var c = CAMPO[k];
    if (!c) return;
    respostas[c.g][k] = v;
    document.querySelectorAll('#abRaiz [data-k="' + k + '"]').forEach(function (el) {
      if (el === origem) return;
      if (el.tagName === "SPAN") el.textContent = v; else el.value = v;
    });
    marcarSalvo("Salvando…");
    gravarRespostasDepois();
  }

  /* ============================================================
     EDITAR BASE / NOVA VERSÃO / NOVO CANAL (modal)
     ============================================================ */
  function abrirEditor(modo) {
    var c = canalAtual(), v = versaoAtual();
    var novoCanal = modo === "novo-canal";
    var novaVersao = modo === "nova-versao";
    var base = novoCanal ? { nome: "Primeira versão", assunto: "", corpo: "Oi, {{marca}}! Aqui é a {{nome}} (@{{arroba}}).\n\n" }
      : novaVersao ? { nome: "Nova versão", assunto: v ? v.assunto : "", corpo: v ? v.corpo : "" } : v;
    var titulo = novoCanal ? "Novo canal" : novaVersao ? "Nova versão · " + c.nome : "Editar base · " + c.nome;

    A.abrirModal({
      titulo: titulo,
      corpoHTML:
        '<h2 class="gaveta-titulo">' + esc(titulo) + "</h2>" +
        '<form id="abForm">' +
          '<div class="campo-linha">' +
            '<label class="campo"><span>Nome do canal</span><input id="abEdCanal" required maxlength="40" value="' + esc(novoCanal ? "" : c.nome) + '" placeholder="Ex.: LinkedIn"></label>' +
            '<label class="campo"><span>Nome desta versão</span><input id="abEdNome" required maxlength="60" value="' + esc(base.nome) + '"></label>' +
          "</div>" +
          '<label class="campo"><span>Assunto (deixe vazio em DM e WhatsApp)</span><input id="abEdAssunto" value="' + esc(base.assunto || "") + '"></label>' +
          '<label class="campo"><span>Texto</span><textarea id="abEdCorpo" class="ab-ed-corpo">' + esc(base.corpo || "") + "</textarea></label>" +
          '<p class="texto-apoio">Clique pra colocar um campo onde está o cursor. Uma linha em branco separa os parágrafos.</p>' +
          '<div class="ab-chips" id="abChips">' + CAMPOS.map(function (x) {
            return '<button type="button" data-k="' + x.k + '" title="' + esc(x.label) + '">{{' + x.k + "}}</button>";
          }).join("") + "</div>" +
          '<label class="campo"><span>Dica deste canal</span><input id="abEdDica" maxlength="240" value="' + esc(novoCanal ? "" : c.dica || "") + '"></label>' +
          '<p class="erro-campo" id="abEdErro" hidden></p>' +
          '<div class="gaveta-acoes">' +
            '<button type="submit" class="botao" id="abEdSalvar">Salvar</button>' +
            (modo === "editar" && versoesDe(c.id).length > 1 ? '<button type="button" class="botao botao--fantasma" id="abEdApagarVersao">Apagar versão</button>' : "") +
            (modo === "editar" && canais.length > 1 ? '<button type="button" class="botao botao--fantasma" id="abEdApagarCanal">Apagar canal</button>' : "") +
          "</div>" +
        "</form>",
      onMontar: function (caixa) {
        caixa.classList.add("modal-caixa--largo");
        var alvoChip = caixa.querySelector("#abEdCorpo");
        caixa.querySelector("#abEdAssunto").addEventListener("focus", function (e) { alvoChip = e.target; });
        caixa.querySelector("#abEdCorpo").addEventListener("focus", function (e) { alvoChip = e.target; });
        var chips = caixa.querySelector("#abChips");
        chips.addEventListener("mousedown", function (e) { e.preventDefault(); });
        chips.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (!b) return;
          var txt = "{{" + b.dataset.k + "}}";
          var ini = alvoChip.selectionStart, fim = alvoChip.selectionEnd;
          alvoChip.value = alvoChip.value.slice(0, ini) + txt + alvoChip.value.slice(fim);
          alvoChip.focus();
          alvoChip.selectionStart = alvoChip.selectionEnd = ini + txt.length;
        });

        var apagarVersao = caixa.querySelector("#abEdApagarVersao");
        if (apagarVersao) apagarVersao.addEventListener("click", function () {
          if (!A.confirmarExclusao('Apagar a versão "' + v.nome + '"?')) return;
          A.gravar("abordagens_modelos", "delete", { id: v.id }).then(function (r) {
            if (!r.ok) { A.toast(mensagemBanco(r.erro), "erro"); return; }
            modelos = modelos.filter(function (m) { return m.id !== v.id; });
            versaoPorCanal[c.id] = 0;
            A.fecharModal();
            redesenhar();
            A.toast("Versão apagada.");
          });
        });

        var apagarCanal = caixa.querySelector("#abEdApagarCanal");
        if (apagarCanal) apagarCanal.addEventListener("click", function () {
          if (!A.confirmarExclusao('Apagar o canal "' + c.nome + '" e todas as versões dele?')) return;
          A.gravar("abordagens_canais", "delete", { id: c.id }).then(function (r) {
            if (!r.ok) { A.toast(mensagemBanco(r.erro), "erro"); return; }
            canais = canais.filter(function (x) { return x.id !== c.id; });
            modelos = modelos.filter(function (m) { return m.canal_id !== c.id; });
            canalAtualId = null;
            A.fecharModal();
            redesenhar();
            A.toast("Canal apagado.");
          });
        });

        caixa.querySelector("#abForm").addEventListener("submit", function (e) {
          e.preventDefault();
          var botao = caixa.querySelector("#abEdSalvar");
          var erro = caixa.querySelector("#abEdErro");
          var dados = {
            canal: caixa.querySelector("#abEdCanal").value.trim(),
            dica: caixa.querySelector("#abEdDica").value.trim(),
            nome: caixa.querySelector("#abEdNome").value.trim(),
            assunto: caixa.querySelector("#abEdAssunto").value.trim(),
            corpo: caixa.querySelector("#abEdCorpo").value.replace(/\s+$/, "")
          };
          botao.disabled = true;
          botao.textContent = "Salvando…";
          erro.hidden = true;
          salvarEditor(modo, dados).then(function () {
            A.fecharModal();
            redesenhar();
            A.toast("Base salva!", "ok");
          }).catch(function (falha) {
            console.error("Abordagens: erro ao salvar a base", falha);
            botao.disabled = false;
            botao.textContent = "Salvar";
            erro.textContent = mensagemBanco(falha);
            erro.hidden = false;
          });
        });
      }
    });
  }

  function falhou(r) { if (!r.ok) throw r.erro; return r.dados; }

  function salvarEditor(modo, d) {
    var c = canalAtual(), v = versaoAtual();
    var versao = { nome: d.nome, assunto: d.assunto, corpo: d.corpo };

    if (modo === "novo-canal") {
      return A.gravar("abordagens_canais", "insert", { valores: { nome: d.canal, dica: d.dica, estrutura: [], ordem: proximaOrdem(canais) } })
        .then(falhou).then(function (linhas) {
          var novo = linhas[0];
          canais.push(novo);
          canalAtualId = novo.id;
          versaoPorCanal[novo.id] = 0;
          return A.gravar("abordagens_modelos", "insert", { valores: Object.assign({ canal_id: novo.id, ordem: 0 }, versao) });
        }).then(falhou).then(function (linhas) { modelos.push(linhas[0]); });
    }

    var canalMudou = d.canal !== c.nome || d.dica !== (c.dica || "");
    var passo = canalMudou
      ? A.gravar("abordagens_canais", "update", { id: c.id, valores: { nome: d.canal || c.nome, dica: d.dica } }).then(falhou).then(function (linhas) {
          Object.assign(c, linhas[0]);
        })
      : Promise.resolve();

    if (modo === "nova-versao") {
      return passo.then(function () {
        return A.gravar("abordagens_modelos", "insert", { valores: Object.assign({ canal_id: c.id, ordem: proximaOrdem(versoesDe(c.id)) }, versao) });
      }).then(falhou).then(function (linhas) {
        modelos.push(linhas[0]);
        versaoPorCanal[c.id] = versoesDe(c.id).length - 1;
      });
    }

    return passo.then(function () {
      return A.gravar("abordagens_modelos", "update", { id: v.id, valores: versao });
    }).then(falhou).then(function (linhas) { Object.assign(v, linhas[0]); });
  }

  /* ============================================================
     DESENHO: BIOS
     ============================================================ */
  function contador(b) {
    var n = Array.from(b.texto || "").length;
    var limite = Number(b.limite) || 0;
    var passou = limite > 0 && n > limite;
    return {
      texto: limite > 0 ? n + " / " + limite + (passou ? " · passou " + (n - limite) : "") : n + " caracteres",
      passou: passou
    };
  }

  function desenharBios(alvo) {
    alvo.innerHTML =
      '<p class="texto-apoio">A bio de cada rede e plataforma. Tudo o que você digita é salvo sozinho, e o contador fica vermelho quando passa do limite.</p>' +
      '<div class="ab-bios" id="abBios">' +
        bios.map(function (b) {
          var ct = contador(b);
          return '<article class="cartao ab-bio" data-id="' + esc(b.id) + '">' +
            '<div class="ab-bio-topo">' +
              '<input class="ab-bio-nome" data-campo="plataforma" value="' + esc(b.plataforma) + '" maxlength="40" aria-label="Plataforma">' +
              '<label class="ab-bio-limite">limite <input type="number" min="0" max="5000" data-campo="limite" value="' + (b.limite || "") + '" placeholder="—" aria-label="Limite de caracteres"></label>' +
            "</div>" +
            '<textarea class="ab-bio-texto" data-campo="texto" aria-label="Bio de ' + esc(b.plataforma) + '">' + esc(b.texto) + "</textarea>" +
            '<div class="ab-bio-base">' +
              '<span class="ab-contador' + (ct.passou ? " ab-contador--passou" : "") + '">' + ct.texto + "</span>" +
              '<div class="ab-acoes">' +
                '<button type="button" class="botao botao--mini" data-acao="copiar">' + A.icone("copiar") + "Copiar</button>" +
                '<button type="button" class="botao-icone" data-acao="apagar" aria-label="Apagar a bio de ' + esc(b.plataforma) + '">' + A.icone("lixeira") + "</button>" +
              "</div>" +
            "</div>" +
          "</article>";
        }).join("") +
        '<button type="button" class="ab-bio-nova" id="abNovaBio">' + A.icone("mais") + "Nova bio</button>" +
      "</div>";
  }

  var salvarBioDepois = {};
  function salvarBio(b) {
    if (!salvarBioDepois[b.id]) {
      salvarBioDepois[b.id] = A.debounce(function () {
        A.gravar("bios", "update", { id: b.id, valores: { plataforma: b.plataforma, texto: b.texto, limite: Number(b.limite) || 0 } }).then(function (r) {
          if (!r.ok) A.toast("A bio de " + b.plataforma + " não salvou. Confira a internet.", "erro");
        });
      }, 700);
    }
    salvarBioDepois[b.id]();
  }

  function bioDe(el) {
    var cartao = el.closest(".ab-bio");
    return cartao && bios.filter(function (b) { return b.id === cartao.dataset.id; })[0];
  }

  /* ============================================================
     MONTAGEM E EVENTOS
     ============================================================ */
  function redesenhar() {
    var corpo = document.getElementById("abCorpo");
    if (!corpo) return;
    document.querySelectorAll("#abSubAbas .sub-aba").forEach(function (b) {
      b.setAttribute("aria-selected", String(b.dataset.sub === subAtiva));
    });
    if (subAtiva === "bios") desenharBios(corpo); else desenharAbordagens(corpo);
  }

  function ligarEventos(raiz) {
    raiz.addEventListener("click", function (e) {
      var alvo = e.target.closest("button");
      if (!alvo) return;

      if (alvo.classList.contains("sub-aba")) { subAtiva = alvo.dataset.sub; redesenhar(); return; }
      if (alvo.dataset.canal) { canalAtualId = alvo.dataset.canal; redesenhar(); return; }

      switch (alvo.id) {
        case "abNovoCanal": abrirEditor("novo-canal"); return;
        case "abNovaVersao": abrirEditor("nova-versao"); return;
        case "abEditar": abrirEditor("editar"); return;
        case "abOutra":
          var c = canalAtual();
          versaoPorCanal[c.id] = ((versaoPorCanal[c.id] || 0) + 1) % versoesDe(c.id).length;
          desenharTexto();
          return;
        case "abCopiar":
          var v = versaoAtual(), faltando = [];
          var texto = preencher(v.corpo, faltando);
          if (v.assunto) texto = "Assunto: " + preencher(v.assunto, faltando) + "\n\n" + texto;
          copiar(texto, faltando.length ? "Copiado! Ainda falta: " + faltando.join(", ") + "." : "Copiado! É só colar e enviar.");
          return;
        case "abCopiarAssunto":
          copiar(preencher(versaoAtual().assunto), "Assunto copiado!");
          return;
        case "abOriginal":
          restaurarOriginal();
          return;
        case "abLimpar":
          if (!A.confirmarExclusao("Limpar os campos da marca pra começar outra abordagem?")) return;
          respostas.marca = {};
          gravarRespostas();
          redesenhar();
          return;
        case "abNovaBio":
          novaBio();
          return;
      }

      var b = bioDe(alvo);
      if (b && alvo.dataset.acao === "copiar") copiar(b.texto, "Bio de " + b.plataforma + " copiada!");
      if (b && alvo.dataset.acao === "apagar") apagarBio(b);
    });

    raiz.addEventListener("input", function (e) {
      var el = e.target;
      if (el.classList.contains("ab-campo")) { mudarCampo(el.dataset.k, el.innerText.replace(/\n$/, ""), el); return; }
      if (el.dataset.k && el.closest("#abRespostas")) { mudarCampo(el.dataset.k, el.value, el); return; }

      var b = bioDe(el), campo = el.dataset.campo;
      if (!b || !campo) return;
      b[campo] = campo === "limite" ? Math.max(0, parseInt(el.value, 10) || 0) : el.value;
      var ct = contador(b), cont = el.closest(".ab-bio").querySelector(".ab-contador");
      cont.textContent = ct.texto;
      cont.classList.toggle("ab-contador--passou", ct.passou);
      salvarBio(b);
    });

    /* colar no texto grifado entra sem formatação */
    raiz.addEventListener("paste", function (e) {
      if (!e.target.closest || !e.target.closest(".ab-campo")) return;
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text"));
    });
  }

  function restaurarOriginal() {
    var v = versaoAtual(), p = v && padraoDaVersao(v.padrao);
    if (!p || !A.confirmarExclusao("Voltar esta versão ao texto original? As suas mudanças nela vão se perder.")) return;
    A.gravar("abordagens_modelos", "update", { id: v.id, valores: { nome: p.nome, assunto: p.assunto, corpo: p.corpo } }).then(function (r) {
      if (!r.ok) { A.toast(mensagemBanco(r.erro), "erro"); return; }
      Object.assign(v, r.dados[0]);
      desenharTexto();
      A.toast("Voltou ao original.");
    });
  }

  function novaBio() {
    A.gravar("bios", "insert", { valores: { plataforma: "Nova plataforma", texto: "", limite: 0, ordem: proximaOrdem(bios) } }).then(function (r) {
      if (!r.ok) { A.toast(mensagemBanco(r.erro), "erro"); return; }
      bios.push(r.dados[0]);
      redesenhar();
      var nomes = document.querySelectorAll(".ab-bio-nome");
      if (nomes.length) nomes[nomes.length - 1].select();
    });
  }

  function apagarBio(b) {
    if (!A.confirmarExclusao("Apagar a bio de " + b.plataforma + "?")) return;
    A.gravar("bios", "delete", { id: b.id }).then(function (r) {
      if (!r.ok) { A.toast(mensagemBanco(r.erro), "erro"); return; }
      bios = bios.filter(function (x) { return x.id !== b.id; });
      redesenhar();
    });
  }

  function montar(raiz) {
    raiz.innerHTML =
      '<div id="abRaiz">' +
        '<div class="sub-abas" id="abSubAbas" role="tablist">' +
          '<button type="button" class="sub-aba" role="tab" data-sub="abordagens">Abordagens</button>' +
          '<button type="button" class="sub-aba" role="tab" data-sub="bios">Bios</button>' +
        "</div>" +
        '<div id="abCorpo"><p class="estado-vazio">Carregando…</p></div>' +
      "</div>";
    ligarEventos(document.getElementById("abRaiz"));

    (carregado ? Promise.resolve() : carregar()).then(redesenhar).catch(function (erro) {
      console.error("Abordagens: erro ao carregar", erro);
      var corpo = document.getElementById("abCorpo");
      if (corpo) corpo.innerHTML = '<p class="aviso">' + A.icone("aviso") + "<span>" + esc(mensagemBanco(erro)) + "</span></p>";
    });
  }

  A.registrarSecao({
    id: "abordagens",
    grupo: "minha rotina",
    nome: "Abordagens e bios",
    legenda: "Suas bases de abordagem pra cada canal e as bios de cada plataforma, prontas pra copiar.",
    icone: "copiar",
    montar: montar
  });
})();
