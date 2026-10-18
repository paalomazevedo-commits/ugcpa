/* ============================================================
   ABA ROTEIROS
   Cola o link de um reel (Instagram, TikTok ou YouTube), a
   Supadata transcreve e o texto fica guardado na biblioteca,
   com etiqueta "Meu" ou "De outra" pra separar.

   A transcrição é pedida direto do navegador pra API da
   Supadata. A chave NÃO fica em nenhum arquivo: a Paloma cola
   ela no campo "Chave da Supadata" e ela vai pra tabela
   configuracoes do banco (só quem está logada lê).

   Tabelas usadas: roteiros e configuracoes (sql-roteiros.sql).
   ============================================================ */
(function () {
  var A = window.Admin;

  var API = "https://api.supadata.ai/v1";
  var CHAVE_CONFIG = "supadata_api_key";
  var ESPERA_JOB_MS = 5000;          // de quanto em quanto tempo pergunta se o vídeo longo ficou pronto
  var LIMITE_MS = 6 * 60 * 1000;     // desiste depois de 6 minutos

  var MSG_VAZIO = "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela.";
  var MSG_PRONTO = "✅ Pronto. Revisa, dá um nome e salva.";

  var FONTES = {
    instagram: { nome: "Instagram", emoji: "📸" },
    tiktok: { nome: "TikTok", emoji: "🎵" },
    youtube: { nome: "YouTube", emoji: "▶️" },
    manual: { nome: "Escrito na mão", emoji: "✍️" }
  };

  /* estado que sobrevive à troca de aba (a transcrição continua
     rodando mesmo se a Paloma for pra outra aba e voltar) */
  var todos = [];
  var filtro = "todos";
  var termo = "";
  var chave = null;
  var chaveCarregando = null;
  var tarefa = null;                 // { id, inicio, relogio }
  var avisoAtual = null;             // { tipo, html }
  var videosAbertos = {};

  /* ============================================================
     LINKS: limpar, descobrir a fonte, o perfil e o embed
     ============================================================ */
  var PALAVRAS_INSTAGRAM = ["reel", "reels", "p", "tv", "stories", "explore", "accounts"];

  function limparLink(texto) {
    var t = String(texto || "").trim().replace(/^<|>$/g, "");
    if (!t) return { ok: false, motivo: "vazio" };
    if (!/^https?:\/\//i.test(t)) {
      if (/^(www\.|m\.|vm\.|vt\.)?(instagram\.com|tiktok\.com|youtube\.com|youtu\.be)\//i.test(t)) t = "https://" + t;
      else return { ok: false, motivo: "invalido" };
    }
    var u;
    try { u = new URL(t); } catch (e) { return { ok: false, motivo: "invalido" }; }

    var host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
    var fonte = null;
    if (/(^|\.)instagram\.com$/.test(host)) fonte = "instagram";
    else if (/(^|\.)tiktok\.com$/.test(host)) fonte = "tiktok";
    else if (/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)) fonte = "youtube";
    if (!fonte) return { ok: false, motivo: "fonte" };

    /* o mesmo vídeo com e sem "www" vira um link só (pra achar repetido) */
    if (/^(instagram\.com|tiktok\.com|youtube\.com)$/.test(host)) u.hostname = "www." + host;
    if (fonte === "instagram") u.pathname = u.pathname.replace(/\/reels\//, "/reel/");

    var tirar = [];
    u.searchParams.forEach(function (valor, nome) {
      if (/^utm_/i.test(nome) || nome === "igsh" || nome === "igshid") tirar.push(nome);
      if (fonte === "tiktok" && /^(is_from_webapp|sender_device|_r|_t|web_id)$/.test(nome)) tirar.push(nome);
      if (fonte === "youtube" && nome === "si") tirar.push(nome);
    });
    tirar.forEach(function (n) { u.searchParams.delete(n); });
    u.hash = "";

    var url = u.toString().replace(/\?$/, "");
    return { ok: true, url: url, fonte: fonte, perfil: perfilDoLink(url, fonte) };
  }

  function perfilDoLink(url, fonte) {
    try {
      var partes = new URL(url).pathname.split("/").filter(Boolean);
      if (fonte === "instagram" && partes.length >= 3 && /^(reel|p|tv)$/.test(partes[1]) &&
          PALAVRAS_INSTAGRAM.indexOf(partes[0].toLowerCase()) === -1) return partes[0];
      if (fonte === "tiktok" && partes[0] && partes[0].charAt(0) === "@") return partes[0].slice(1);
    } catch (e) {}
    return "";
  }

  function embedDoLink(url, fonte) {
    if (!url) return null;
    var m;
    if (fonte === "instagram") {
      m = url.match(/instagram\.com\/(?:[^\/?#]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
      if (m) return "https://www.instagram.com/" + (m[1].toLowerCase() === "p" ? "p" : "reel") + "/" + m[2] + "/embed";
    }
    if (fonte === "youtube") {
      m = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i) ||
          url.match(/[?&]v=([A-Za-z0-9_-]{6,})/i) ||
          url.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/i);
      if (m) return "https://www.youtube.com/embed/" + m[1];
    }
    if (fonte === "tiktok") {
      m = url.match(/\/video\/(\d+)/);
      if (m) return "https://www.tiktok.com/embed/v2/" + m[1];
    }
    return null;
  }

  /* ============================================================
     BANCO
     ============================================================ */
  function mensagemBanco(erro) {
    var codigo = erro && erro.code;
    var texto = (erro && erro.message) || "";
    if (codigo === "42P01" || codigo === "PGRST205" || /does not exist|could not find the table/i.test(texto)) {
      return "As tabelas de roteiros ainda não existem no banco. Cole o arquivo sql-roteiros.sql no Supabase (SQL Editor, depois Run) e recarregue a página.";
    }
    if (codigo === "42501" || codigo === "PGRST301" || /row-level security|permission denied/i.test(texto)) {
      return "O banco recusou o acesso. Confira se você está logada e se o sql-roteiros.sql rodou inteiro.";
    }
    return "Não consegui falar com o banco agora. Confira a internet e recarregue a página.";
  }

  function carregar() {
    if (!window.banco) { mostrarAviso("erro", A.esc(mensagemBanco(null))); return Promise.resolve(); }
    return window.banco.from("roteiros").select("*").order("created_at", { ascending: false }).then(function (resp) {
      if (resp.error) throw resp.error;
      todos = resp.data || [];
      renderTudo();
    }).catch(function (erro) {
      console.error("Roteiros: erro ao carregar", erro);
      todos = [];
      renderTudo();
      mostrarAviso("erro", A.esc(mensagemBanco(erro)));
    });
  }

  function atualizarLinha(id, valores) {
    return A.gravar("roteiros", "update", { id: id, valores: valores });
  }

  function carregarChave() {
    if (!window.banco) return Promise.resolve(null);
    chaveCarregando = window.banco.from("configuracoes").select("valor").eq("chave", CHAVE_CONFIG).maybeSingle()
      .then(function (resp) {
        if (resp.error) throw resp.error;
        chave = resp.data && resp.data.valor ? String(resp.data.valor) : null;
        return chave;
      }).catch(function (erro) {
        console.error("Roteiros: erro ao ler a chave", erro);
        chave = null;
        return null;
      });
    return chaveCarregando;
  }

  function salvarChave(valor) {
    return window.banco.from("configuracoes").upsert({ chave: CHAVE_CONFIG, valor: valor }, { onConflict: "chave" })
      .then(function (resp) {
        if (resp.error) throw resp.error;
        chave = valor;
        return { ok: true };
      }).catch(function (erro) {
        console.error("Roteiros: erro ao salvar a chave", erro);
        return { ok: false, erro: erro };
      });
  }

  /* ============================================================
     SUPADATA
     ============================================================ */
  function chamarSupadata(caminho, sinal) {
    return fetch(API + caminho, { headers: { "x-api-key": chave }, signal: sinal }).then(function (resp) {
      return resp.text().then(function (texto) {
        var json = {};
        try { json = texto ? JSON.parse(texto) : {}; } catch (e) {}
        return { status: resp.status, json: json || {} };
      });
    });
  }

  function lerConteudo(json) {
    var c = json.content;
    var segmentos = null;
    var texto = "";
    if (Array.isArray(c)) {
      segmentos = c;
      texto = c.map(function (s) { return (s && s.text) || ""; }).join(" ");
    } else if (typeof c === "string") {
      texto = c;
    }
    texto = texto.replace(/[ \t]+/g, " ").trim();
    if (!texto || json.lang === "none") return { tipo: "vazio" };
    return { tipo: "texto", texto: texto, segmentos: segmentos };
  }

  /* traduz o erro da Supadata pra uma frase sem termo técnico */
  function lerErro(status, json) {
    var e = json.error;
    var codigo = typeof e === "string" ? e : (e && (e.code || e.error)) || "";
    var detalhes = [json.details, json.message, e && e.details, e && e.message].filter(Boolean).join(" ");

    if (status === 206 || codigo === "transcript-unavailable") return { tipo: "vazio" };
    if (codigo === "limit-exceeded" || status === 429) {
      if (/plan usage/i.test(detalhes)) return { tipo: "erro", mensagem: "Acabaram os créditos do mês na Supadata. Eles voltam quando o seu plano renovar no mês que vem." };
      if (/request rate/i.test(detalhes) || status === 429) return { tipo: "erro", mensagem: "Foram muitos pedidos seguidos. É só esperar 1 minutinho e tentar de novo." };
      return { tipo: "erro", mensagem: "A Supadata disse que passou do limite. Se você transcreveu vários seguidos, espera 1 minuto. Se não, podem ter acabado os créditos do mês." };
    }
    if (status === 401 || /unauthori[sz]ed|invalid-api-key|api.?key/i.test(codigo)) {
      return { tipo: "erro", mensagem: "A Supadata não aceitou a sua chave. Confira se você copiou ela inteira e salve de novo no campo Chave da Supadata." };
    }
    if (status === 403 || codigo === "upgrade-required") {
      return { tipo: "erro", mensagem: "A Supadata pediu um plano pago pra esse vídeo. Tenta outro link ou escreve o texto na mão." };
    }
    if (status === 404 || codigo === "not-found") {
      return { tipo: "erro", mensagem: "Não achei esse vídeo. Confira se o link abre no navegador e se o perfil é público." };
    }
    if (status === 400 || codigo === "invalid-request") {
      return { tipo: "erro", mensagem: "A Supadata não conseguiu abrir esse link. Confira se ele abre no navegador e se o perfil é público." };
    }
    return { tipo: "erro", mensagem: "A transcrição não deu certo dessa vez. Tenta de novo daqui a pouco." };
  }

  function interpretar(r) {
    if (r.status === 200 && r.json && r.json.content !== undefined) return lerConteudo(r.json);
    return lerErro(r.status, r.json || {});
  }

  /* devolve { tipo: "texto", texto, segmentos } ou { tipo: "vazio" } ou { tipo: "erro", mensagem } */
  function transcrever(url) {
    var inicio = Date.now();
    var controle = typeof AbortController === "function" ? new AbortController() : null;
    var sinal = controle ? controle.signal : undefined;
    var cronometro = setTimeout(function () { if (controle) controle.abort(); }, LIMITE_MS);
    var MSG_DEMOROU = { tipo: "erro", mensagem: "Passou de 6 minutos e eu parei de esperar. Tenta de novo daqui a pouco." };

    function esperarJob(jobId) {
      return new Promise(function (ok) { setTimeout(ok, ESPERA_JOB_MS); }).then(function () {
        if (Date.now() - inicio > LIMITE_MS) return MSG_DEMOROU;
        return chamarSupadata("/transcript/" + encodeURIComponent(jobId), sinal).then(function (r) {
          var s = r.json && r.json.status;
          if (s === "completed") return lerConteudo(r.json);
          if (s === "failed") return lerErro(r.status, r.json && r.json.error ? r.json : { error: "failed" });
          if (r.status >= 400) return lerErro(r.status, r.json || {});
          return esperarJob(jobId);
        });
      });
    }

    var qs = "?url=" + encodeURIComponent(url) + "&mode=auto&text=true&lang=pt";
    return chamarSupadata("/transcript" + qs, sinal).then(function (r) {
      if (r.json && r.json.jobId && (r.status === 202 || r.json.content === undefined)) return esperarJob(r.json.jobId);
      return interpretar(r);
    }).catch(function (erro) {
      console.error("Roteiros: erro ao chamar a Supadata", erro);
      if (erro && erro.name === "AbortError") return MSG_DEMOROU;
      return { tipo: "erro", mensagem: "Não consegui falar com o serviço de transcrição. Confira a internet e tenta de novo." };
    }).then(function (res) {
      clearTimeout(cronometro);
      return res;
    });
  }

  function carregarSaldo() {
    var alvo = document.getElementById("rtSaldo");
    if (!alvo) return;
    if (!chave) { alvo.innerHTML = '<span class="rt-saldo-sem">Nenhuma chave salva ainda.</span>'; return; }
    alvo.textContent = "Vendo o saldo…";
    chamarSupadata("/me").then(function (r) {
      var el = document.getElementById("rtSaldo");
      if (!el) return;
      if (r.status === 401 || r.status === 403) { el.innerHTML = '<span class="rt-saldo-ruim">A Supadata não aceitou essa chave.</span>'; return; }
      var j = r.json || {};
      if (j.maxCredits == null) { el.textContent = "Não consegui ver o saldo agora."; return; }
      var usados = Number(j.usedCredits) || 0;
      var max = Number(j.maxCredits) || 0;
      var acabou = max > 0 && usados >= max;
      el.innerHTML = '<span class="' + (acabou ? "rt-saldo-ruim" : "rt-saldo-ok") + '">📊 ' + usados + " de " + max + " créditos usados</span>" +
        (j.plan ? ' <span class="rt-saldo-plano">plano ' + A.esc(j.plan) + "</span>" : "");
    }).catch(function () {
      var el = document.getElementById("rtSaldo");
      if (el) el.textContent = "Não consegui ver o saldo agora.";
    });
  }

  /* ============================================================
     AVISO (andamento e erros, logo abaixo da linha do link)
     ============================================================ */
  function mostrarAviso(tipo, html) {
    avisoAtual = tipo ? { tipo: tipo, html: html } : null;
    renderAviso();
  }

  function renderAviso() {
    var alvo = document.getElementById("rtAviso");
    if (!alvo) return;
    if (!avisoAtual) { alvo.hidden = true; alvo.innerHTML = ""; return; }
    alvo.hidden = false;
    alvo.className = "rt-aviso rt-aviso--" + avisoAtual.tipo;
    alvo.innerHTML = avisoAtual.html;
  }

  function avisoSemChave() {
    mostrarAviso("ambar",
      "<p><b>🔑 Pra transcrever eu preciso da sua chave da Supadata.</b> É grátis e leva 2 minutos:</p>" +
      '<ol class="rt-passos">' +
        '<li>Crie uma conta grátis em <a href="https://supadata.ai" target="_blank" rel="noopener">supadata.ai</a> (100 créditos por mês, sem cartão).</li>' +
        "<li>No painel deles, copie a sua API key.</li>" +
        "<li>Cole no campo <b>Chave da Supadata</b> aqui embaixo e clique em Salvar.</li>" +
      "</ol>");
    var campo = document.getElementById("rtChave");
    if (campo) campo.focus();
  }

  function formatarTempo(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    if (s < 60) return s + "s";
    return Math.floor(s / 60) + "min " + String(s % 60).padStart(2, "0") + "s";
  }

  function avisoOuvindo() {
    if (!tarefa) return;
    mostrarAviso("info",
      '<p class="rt-ouvindo"><span class="rt-relogio" aria-hidden="true"></span>' +
      "<span><b>🎧 Ouvindo o vídeo… " + formatarTempo(Date.now() - tarefa.inicio) + ".</b> " +
      "Costuma levar de 3 a 4 minutos, pode deixar a aba aberta.</span></p>" +
      '<div class="rt-barra-andando" aria-hidden="true"><span></span></div>');
  }

  /* ============================================================
     FLUXO DO "TRANSCREVER"
     ============================================================ */
  function aoTranscrever() {
    if (tarefa) { mostrarAviso("ambar", "<p>⏳ Já tem um vídeo sendo ouvido. Espera ele terminar e cola o próximo.</p>"); return; }
    var campo = document.getElementById("rtLink");
    var deQuem = document.getElementById("rtDeQuem").value;
    var link = limparLink(campo.value);

    if (!link.ok) {
      if (link.motivo === "vazio") mostrarAviso("erro", "<p>👆 Cole o link do vídeo no campo lá em cima primeiro.</p>");
      else if (link.motivo === "fonte") mostrarAviso("erro", "<p>🤔 Por enquanto eu só sei ler vídeos do Instagram, do TikTok e do YouTube.</p>");
      else mostrarAviso("erro", "<p>🤔 Esse link não parece certo. Ele precisa começar com http e ser de um vídeo do Instagram, TikTok ou YouTube. Exemplo: https://www.instagram.com/reel/ABC123/</p>");
      campo.focus();
      return;
    }
    campo.value = link.url;

    (chaveCarregando || Promise.resolve(chave)).then(function () {
      if (!chave) { avisoSemChave(); return; }
      if (!window.banco) { mostrarAviso("erro", A.esc(mensagemBanco(null))); return; }

      window.banco.from("roteiros").select("id,titulo").eq("url", link.url).limit(1).then(function (resp) {
        if (resp.error) throw resp.error;
        var existente = resp.data && resp.data[0];
        if (existente) {
          var nome = existente.titulo ? '"' + existente.titulo + '"' : "sem título";
          var sim = window.confirm("Esse link já está na sua biblioteca (" + nome + ").\n\nQuer transcrever de novo? Isso gasta 1 crédito da Supadata e cria um card novo. O antigo continua lá.");
          if (!sim) {
            mostrarAviso("info", "<p>👍 Tudo bem, não transcrevi de novo. O card desse link já está na biblioteca aqui embaixo.</p>");
            destacarCard(existente.id);
            return;
          }
        }
        return A.gravar("roteiros", "insert", {
          valores: { fonte: link.fonte, url: link.url, perfil: link.perfil || null, de_quem: deQuem, status: "processando" }
        }).then(function (r) {
          if (!r.ok) { mostrarAviso("erro", "<p>" + A.esc(mensagemBanco(r.erro)) + "</p>"); return; }
          var linha = r.dados && r.dados[0];
          if (!linha) { mostrarAviso("erro", "<p>Não consegui criar o card. Recarregue a página e tenta de novo.</p>"); return; }
          campo.value = "";
          todos.unshift(linha);
          executarTranscricao(linha);
        });
      }).catch(function (erro) {
        mostrarAviso("erro", "<p>" + A.esc(mensagemBanco(erro)) + "</p>");
      });
    });
  }

  function executarTranscricao(linha) {
    tarefa = { id: linha.id, inicio: Date.now(), relogio: null };
    tarefa.relogio = setInterval(avisoOuvindo, 1000);
    avisoOuvindo();
    atualizarBotaoTranscrever();
    renderLista();

    transcrever(linha.url).then(function (res) {
      clearInterval(tarefa.relogio);
      tarefa = null;
      atualizarBotaoTranscrever();

      var valores;
      if (res.tipo === "texto") valores = { transcricao: res.texto, segmentos: res.segmentos, status: "pronto", erro: null };
      else if (res.tipo === "vazio") valores = { status: "falhou", erro: MSG_VAZIO };
      else valores = { status: "falhou", erro: res.mensagem };

      return atualizarLinha(linha.id, valores).then(function (r) {
        if (!r.ok && !acharLocal(linha.id)) return; /* card apagado enquanto ouvia */
        var atualizada = (r.ok && r.dados && r.dados[0]) || Object.assign({}, linha, valores);
        substituirLocal(atualizada);
        renderTudo();
        carregarSaldo();

        if (res.tipo === "texto") {
          mostrarAviso("ok", "<p><b>" + MSG_PRONTO + "</b></p>");
          if (document.getElementById("rtRaiz") && !document.querySelector(".sobreposicao")) {
            abrirEditor(atualizada, { avisoTopo: MSG_PRONTO });
          } else {
            A.toast("Roteiro pronto ✓ Ele está na aba Roteiros.", "ok");
          }
        } else if (res.tipo === "vazio") {
          mostrarAviso("ambar",
            "<p><b>🔇 " + A.esc(MSG_VAZIO) + "</b> Se quiser, guarda assim mesmo e escreve o texto na mão.</p>" +
            '<div class="rt-aviso-acoes"><button type="button" class="botao botao--mini" data-acao="abrir" data-id="' + A.esc(linha.id) + '">📝 Guardar assim mesmo</button></div>');
        } else {
          mostrarAviso("erro",
            "<p><b>⚠️ " + A.esc(res.mensagem) + "</b></p>" +
            '<div class="rt-aviso-acoes"><button type="button" class="botao botao--mini botao--linha" data-acao="tentar" data-id="' + A.esc(linha.id) + '">🔁 Tentar de novo</button></div>');
        }
        if (!document.getElementById("rtRaiz") && res.tipo !== "texto") A.toast("A transcrição não deu certo. Veja na aba Roteiros.", "erro");
      });
    });
  }

  function tentarDeNovo(id) {
    var linha = acharLocal(id);
    if (!linha) return;
    if (tarefa) { mostrarAviso("ambar", "<p>⏳ Já tem um vídeo sendo ouvido. Espera ele terminar.</p>"); return; }
    if (!linha.url) { abrirEditor(linha); return; }
    (chaveCarregando || Promise.resolve(chave)).then(function () {
      if (!chave) { avisoSemChave(); return; }
      atualizarLinha(id, { status: "processando", erro: null }).then(function (r) {
        if (!r.ok) { mostrarAviso("erro", "<p>" + A.esc(mensagemBanco(r.erro)) + "</p>"); return; }
        linha.status = "processando";
        linha.erro = null;
        executarTranscricao(linha);
      });
    });
  }

  /* ============================================================
     LISTA EM MEMÓRIA
     ============================================================ */
  function acharLocal(id) {
    return todos.filter(function (r) { return r.id === id; })[0] || null;
  }

  function substituirLocal(linha) {
    var achou = false;
    todos = todos.map(function (r) { if (r.id === linha.id) { achou = true; return linha; } return r; });
    if (!achou) todos.unshift(linha);
  }

  function semAcento(t) {
    return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function todasAsTags() {
    var vistas = {};
    todos.forEach(function (r) { (r.tags || []).forEach(function (t) { if (t) vistas[t] = true; }); });
    return Object.keys(vistas).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
  }

  function filtrados() {
    var busca = semAcento(termo);
    return todos.filter(function (r) {
      if (filtro === "minha" && r.de_quem !== "minha") return false;
      if (filtro === "outra" && r.de_quem !== "outra") return false;
      if (filtro.indexOf("tag:") === 0 && (r.tags || []).indexOf(filtro.slice(4)) === -1) return false;
      if (!busca) return true;
      var alvo = semAcento([r.transcricao, r.perfil, r.titulo, r.obs, r.legenda, (r.tags || []).join(" ")].join(" "));
      return alvo.indexOf(busca) !== -1;
    });
  }

  /* ============================================================
     DESENHO DA TELA
     ============================================================ */
  function montar(raiz) {
    termo = "";
    filtro = "todos";
    videosAbertos = {};
    if (!tarefa) avisoAtual = null;

    raiz.innerHTML =
      '<div class="rt" id="rtRaiz">' +
        '<section class="cartao rt-topo" aria-label="Transcrever um vídeo">' +
          '<div class="rt-linha">' +
            '<input type="url" class="rt-link" id="rtLink" inputmode="url" autocomplete="off" placeholder="Cole aqui: instagram.com/reel/... · tiktok.com/... · youtube.com/..." aria-label="Link do vídeo">' +
            '<select class="select-filtro rt-dequem" id="rtDeQuem" aria-label="De quem é o vídeo">' +
              '<option value="outra">👀 De outra pessoa</option>' +
              '<option value="minha">⭐ Meu</option>' +
            "</select>" +
            '<button type="button" class="botao" id="rtTranscrever">🎙️ Transcrever</button>' +
            '<button type="button" class="botao botao--linha" id="rtManual">✍️ + Escrever na mão</button>' +
          "</div>" +
          '<div class="rt-aviso" id="rtAviso" role="status" aria-live="polite" hidden></div>' +
        "</section>" +

        '<section class="cartao rt-config" aria-label="Chave da Supadata">' +
          '<label class="rt-config-rotulo" for="rtChave">🔑 Chave da Supadata</label>' +
          '<div class="rt-config-linha">' +
            '<input type="password" id="rtChave" class="rt-chave" autocomplete="off" spellcheck="false" placeholder="Carregando…">' +
            '<button type="button" class="botao botao--linha" id="rtSalvarChave">💾 Salvar</button>' +
            '<span class="rt-saldo" id="rtSaldo"></span>' +
          "</div>" +
        "</section>" +

        '<div class="rt-biblio-cab">' +
          '<h2 class="rt-h2">📚 Biblioteca <span class="rt-contagem" id="rtContagem"></span></h2>' +
          '<button type="button" class="botao" id="rtEstudar">🧠 Estudar com o Claude</button>' +
        "</div>" +
        '<div class="ferramentas">' +
          '<div class="busca">' + A.icone("busca") + '<input type="text" id="rtBusca" placeholder="Buscar na transcrição, perfil, título ou notas"></div>' +
          '<div class="chips-filtro" id="rtChips"></div>' +
        "</div>" +
        '<div class="rt-lista" id="rtLista"><p class="estado-vazio">Carregando…</p></div>' +
      "</div>";

    document.getElementById("rtTranscrever").addEventListener("click", aoTranscrever);
    document.getElementById("rtLink").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); aoTranscrever(); }
    });
    document.getElementById("rtManual").addEventListener("click", function () {
      var link = limparLink(document.getElementById("rtLink").value);
      abrirEditor({
        de_quem: document.getElementById("rtDeQuem").value,
        url: link.ok ? link.url : "",
        perfil: link.ok ? link.perfil : "",
        fonte: link.ok ? link.fonte : "manual",
        tags: []
      }, { novo: true });
    });
    document.getElementById("rtSalvarChave").addEventListener("click", aoSalvarChave);
    document.getElementById("rtChave").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); aoSalvarChave(); }
    });
    document.getElementById("rtEstudar").addEventListener("click", estudarComClaude);
    document.getElementById("rtBusca").addEventListener("input", A.debounce(function (e) {
      termo = e.target.value.trim();
      renderLista();
    }, 200));
    document.getElementById("rtChips").addEventListener("click", function (e) {
      var chip = e.target.closest(".chip-filtro");
      if (!chip) return;
      filtro = chip.dataset.filtro;
      renderChips();
      renderLista();
    });
    document.getElementById("rtAviso").addEventListener("click", aoClicarAcao);
    document.getElementById("rtLista").addEventListener("click", aoClicarAcao);

    renderAviso();
    atualizarBotaoTranscrever();

    (chave !== null ? Promise.resolve(chave) : carregarChave()).then(function () {
      mostrarChave();
      carregarSaldo();
    });
    carregar();
  }

  function atualizarBotaoTranscrever() {
    var b = document.getElementById("rtTranscrever");
    if (!b) return;
    b.disabled = !!tarefa;
    b.textContent = tarefa ? "⏳ Ouvindo…" : "🎙️ Transcrever";
  }

  function mostrarChave() {
    var campo = document.getElementById("rtChave");
    if (!campo) return;
    campo.value = "";
    campo.placeholder = chave ? "Chave salva: ••••" + chave.slice(-4) + " (cole outra pra trocar)" : "Cole aqui a sua API key da Supadata";
  }

  function aoSalvarChave() {
    var campo = document.getElementById("rtChave");
    var valor = campo.value.trim();
    if (!valor) { A.toast("Cole a chave no campo antes de salvar.", "erro"); campo.focus(); return; }
    if (!window.banco) { A.toast(mensagemBanco(null), "erro"); return; }
    var botao = document.getElementById("rtSalvarChave");
    botao.disabled = true;
    salvarChave(valor).then(function (r) {
      botao.disabled = false;
      if (!r.ok) { mostrarAviso("erro", "<p>" + A.esc(mensagemBanco(r.erro)) + "</p>"); return; }
      mostrarChave();
      carregarSaldo();
      A.toast("Chave salva ✓", "ok");
      if (avisoAtual && avisoAtual.tipo === "ambar" && /Supadata/.test(avisoAtual.html)) {
        mostrarAviso("ok", "<p>🔑 Chave salva. Agora é só colar o link e clicar em Transcrever.</p>");
      }
    });
  }

  function renderTudo() {
    renderChips();
    renderLista();
  }

  function renderChips() {
    var alvo = document.getElementById("rtChips");
    if (!alvo) return;
    var tags = todasAsTags();
    if (filtro.indexOf("tag:") === 0 && tags.indexOf(filtro.slice(4)) === -1) filtro = "todos";
    var chips = [
      { id: "todos", rotulo: "Todos" },
      { id: "minha", rotulo: "⭐ Meus" },
      { id: "outra", rotulo: "👀 De outras" }
    ].concat(tags.map(function (t) { return { id: "tag:" + t, rotulo: "#" + t }; }));
    alvo.innerHTML = chips.map(function (c) {
      return '<button type="button" class="chip-filtro" data-filtro="' + A.esc(c.id) + '" aria-pressed="' + (filtro === c.id) + '">' + A.esc(c.rotulo) + "</button>";
    }).join("");
  }

  function renderLista() {
    var alvo = document.getElementById("rtLista");
    if (!alvo) return;
    var contagem = document.getElementById("rtContagem");
    if (contagem) contagem.textContent = todos.length ? "(" + todos.length + ")" : "";

    if (!todos.length) {
      alvo.innerHTML = '<p class="estado-vazio">📭 Sua biblioteca ainda está vazia.<br>Cole o link de um reel lá em cima e clique em Transcrever, ou escreva um roteiro na mão.</p>';
      return;
    }
    var lista = filtrados();
    if (!lista.length) {
      alvo.innerHTML = '<p class="estado-vazio">🔎 Nada encontrado com essa busca ou esse filtro.</p>';
      return;
    }
    alvo.innerHTML = lista.map(cartao).join("");
  }

  function trecho(texto) {
    var linhas = String(texto || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    return linhas.slice(0, 3).join("\n");
  }

  function capa(r) {
    var fonte = FONTES[r.fonte] || FONTES.manual;
    var embed = embedDoLink(r.url, r.fonte);
    if (embed && videosAbertos[r.id]) {
      return '<div class="rt-capa rt-capa--aberta">' +
        '<iframe src="' + A.esc(embed) + '" title="Vídeo ' + A.esc(r.titulo || "sem título") + '" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>' +
        '<button type="button" class="rt-fechar-video" data-acao="fecharVideo" data-id="' + A.esc(r.id) + '">✕ fechar vídeo</button>' +
        "</div>";
    }
    var miolo;
    if (embed) miolo = '<button type="button" class="rt-ver-video" data-acao="verVideo" data-id="' + A.esc(r.id) + '">▶ ver vídeo</button>';
    else if (r.url) miolo = '<a class="rt-ver-video" href="' + A.esc(r.url) + '" target="_blank" rel="noopener">↗ abrir link</a>';
    else miolo = "";
    return '<div class="rt-capa rt-capa--' + A.esc(r.fonte || "manual") + '">' +
      '<span class="rt-capa-emoji" aria-hidden="true">' + fonte.emoji + "</span>" + miolo + "</div>";
  }

  function blocoStatus(r) {
    var id = A.esc(r.id);
    if (r.status === "processando") {
      if (tarefa && tarefa.id === r.id) {
        return '<p class="rt-status rt-status--processando"><span class="rt-relogio" aria-hidden="true"></span>Ouvindo o vídeo…</p>';
      }
      return '<div class="rt-status rt-status--processando"><span class="rt-relogio" aria-hidden="true"></span>' +
        "<span>Ficou pela metade (a aba foi fechada no meio?).</span>" +
        '<button type="button" class="botao botao--mini botao--linha" data-acao="tentar" data-id="' + id + '">🔁 Tentar de novo</button></div>';
    }
    if (r.status === "falhou") {
      return '<div class="rt-status rt-status--falhou"><span>⚠️ ' + A.esc(r.erro || "A transcrição não deu certo.") + "</span>" +
        '<span class="rt-status-acoes">' +
          '<button type="button" class="botao botao--mini" data-acao="abrir" data-id="' + id + '">📝 Abrir mesmo assim</button>' +
          (r.url && r.erro !== MSG_VAZIO ? '<button type="button" class="botao botao--mini botao--linha" data-acao="tentar" data-id="' + id + '">🔁 Tentar de novo</button>' : "") +
        "</span></div>";
    }
    return "";
  }

  function cartao(r) {
    var fonte = FONTES[r.fonte] || FONTES.manual;
    var minha = r.de_quem === "minha";
    var perfil = r.perfil ? "@" + String(r.perfil).replace(/^@/, "") : "";
    var tags = (r.tags || []).filter(Boolean);
    var datas = "🗓️ " + A.formatarData(r.created_at) + (r.postado_em ? " · postado em " + A.formatarData(r.postado_em) : "");
    var resumo = trecho(r.transcricao);

    return '<article class="rt-card' + (videosAbertos[r.id] ? " rt-card--video" : "") + '" data-id="' + A.esc(r.id) + '" data-status="' + A.esc(r.status || "pronto") + '">' +
      capa(r) +
      '<div class="rt-corpo">' +
        '<h3 class="rt-titulo">' + (r.titulo ? A.esc(r.titulo) : '<span class="rt-sem-titulo">Sem título</span>') + "</h3>" +
        '<div class="rt-meta">' +
          '<span class="rt-etiqueta rt-etiqueta--' + (minha ? "minha" : "outra") + '">' + (minha ? "⭐ Meu" : "👀 De outra") + "</span>" +
          (perfil ? (r.url ? '<a class="rt-perfil" href="' + A.esc(r.url) + '" target="_blank" rel="noopener">' + A.esc(perfil) + "</a>" : '<span class="rt-perfil">' + A.esc(perfil) + "</span>") : "") +
          '<span class="rt-fonte">' + fonte.emoji + " " + A.esc(fonte.nome) + "</span>" +
          '<span class="rt-data">' + A.esc(datas) + "</span>" +
        "</div>" +
        blocoStatus(r) +
        (resumo ? '<p class="rt-trecho">' + A.esc(resumo) + "</p>" : (r.status === "pronto" ? '<p class="rt-trecho rt-trecho--vazio">Sem transcrição ainda.</p>' : "")) +
        (tags.length ? '<div class="rt-tags">' + tags.map(function (t) { return '<span class="rt-tag">#' + A.esc(t) + "</span>"; }).join("") + "</div>" : "") +
        '<div class="rt-acoes">' +
          '<button type="button" class="botao botao--mini botao--linha" data-acao="copiar" data-id="' + A.esc(r.id) + '">📋 Copiar transcrição</button>' +
          '<button type="button" class="botao botao--mini botao--linha" data-acao="editar" data-id="' + A.esc(r.id) + '">✏️ Editar</button>' +
          '<button type="button" class="botao botao--mini botao--fantasma rt-apagar" data-acao="apagar" data-id="' + A.esc(r.id) + '">🗑️ Apagar</button>' +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function destacarCard(id) {
    filtro = "todos";
    termo = "";
    var busca = document.getElementById("rtBusca");
    if (busca) busca.value = "";
    renderTudo();
    var el = document.querySelector('.rt-card[data-id="' + id + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("rt-card--destaque");
    setTimeout(function () { el.classList.remove("rt-card--destaque"); }, 2200);
  }

  /* ============================================================
     AÇÕES DOS CARDS E DO AVISO
     ============================================================ */
  function aoClicarAcao(e) {
    var botao = e.target.closest("[data-acao]");
    if (!botao) return;
    var id = botao.dataset.id;
    var acao = botao.dataset.acao;
    var r = acharLocal(id);

    if (acao === "verVideo" || acao === "fecharVideo") {
      if (acao === "verVideo") videosAbertos[id] = true; else delete videosAbertos[id];
      var card = botao.closest(".rt-card");
      if (card && r) {
        var novo = document.createElement("div");
        novo.innerHTML = cartao(r);
        card.replaceWith(novo.firstChild);
      }
      return;
    }
    if (!r) return;
    if (acao === "copiar") copiarTranscricao(r, botao);
    else if (acao === "editar" || acao === "abrir") abrirEditor(r);
    else if (acao === "tentar") tentarDeNovo(id);
    else if (acao === "apagar") apagar(r);
  }

  function copiarTexto(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto);
    return new Promise(function (ok, falha) {
      var area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var deu = false;
      try { deu = document.execCommand("copy"); } catch (e) {}
      area.remove();
      if (deu) ok(); else falha(new Error("não copiou"));
    });
  }

  function copiarTranscricao(r, botao) {
    if (!r.transcricao || !r.transcricao.trim()) { A.toast("Esse roteiro ainda não tem transcrição.", "erro"); return; }
    copiarTexto(r.transcricao).then(function () {
      var original = botao.textContent;
      botao.textContent = "copiado ✓";
      botao.classList.add("rt-copiado");
      setTimeout(function () { botao.textContent = original; botao.classList.remove("rt-copiado"); }, 1800);
    }).catch(function () {
      A.toast("Não consegui copiar. Abra o Editar e copie de lá.", "erro");
    });
  }

  function apagar(r) {
    var nome = r.titulo ? '"' + r.titulo + '"' : "sem título";
    if (!A.confirmarExclusao("Apagar o roteiro " + nome + "? Isso não tem volta.")) return;
    A.gravar("roteiros", "delete", { id: r.id }).then(function (res) {
      if (!res.ok) { A.toast("Não consegui apagar. Tenta de novo.", "erro"); return; }
      todos = todos.filter(function (x) { return x.id !== r.id; });
      delete videosAbertos[r.id];
      renderTudo();
      A.toast("Roteiro apagado.", "ok");
    });
  }

  /* ============================================================
     MODAL DE EDIÇÃO (serve também pro "+ Escrever na mão")
     ============================================================ */
  function abrirEditor(r, opcoes) {
    opcoes = opcoes || {};
    var novo = !!opcoes.novo;
    var tags = (r.tags || []).join(", ");
    var html =
      '<h2 class="gaveta-titulo">' + (novo ? "✍️ Escrever roteiro na mão" : "✏️ Editar roteiro") + "</h2>" +
      (opcoes.avisoTopo ? '<p class="rt-aviso rt-aviso--ok rt-modal-aviso">' + A.esc(opcoes.avisoTopo) + "</p>" : "") +
      '<form id="rtForm" novalidate>' +
        '<label class="campo"><span>Título</span><input type="text" id="rtfTitulo" placeholder="Ex.: gancho da pergunta polêmica" value="' + A.esc(r.titulo || "") + '"></label>' +
        '<div class="campo-linha">' +
          '<label class="campo"><span>De quem</span><select id="rtfDeQuem">' +
            '<option value="outra"' + (r.de_quem !== "minha" ? " selected" : "") + ">👀 De outra</option>" +
            '<option value="minha"' + (r.de_quem === "minha" ? " selected" : "") + ">⭐ Meu</option>" +
          "</select></label>" +
          '<label class="campo"><span>Perfil</span><input type="text" id="rtfPerfil" placeholder="@perfil" value="' + A.esc(r.perfil ? "@" + String(r.perfil).replace(/^@/, "") : "") + '"></label>' +
        "</div>" +
        '<div class="campo-linha">' +
          '<label class="campo"><span>Link</span><input type="url" id="rtfUrl" placeholder="https://..." value="' + A.esc(r.url || "") + '"></label>' +
          '<label class="campo"><span>Data de postagem</span><input type="date" id="rtfPostado" value="' + A.esc(r.postado_em ? String(r.postado_em).slice(0, 10) : "") + '"></label>' +
        "</div>" +
        '<label class="campo"><span>Tags (separadas por vírgula)</span><input type="text" id="rtfTags" placeholder="gancho, skincare, humor" value="' + A.esc(tags) + '"></label>' +
        '<label class="campo"><span>Legenda do post</span><textarea id="rtfLegenda" rows="3">' + A.esc(r.legenda || "") + "</textarea></label>" +
        '<label class="campo"><span>Transcrição</span><textarea id="rtfTranscricao" class="rt-transcricao-campo" rows="12">' + A.esc(r.transcricao || "") + "</textarea></label>" +
        '<label class="campo"><span>Minhas notas</span><textarea id="rtfObs" rows="3" placeholder="O que eu quero lembrar desse vídeo">' + A.esc(r.obs || "") + "</textarea></label>" +
        '<p class="erro-campo" id="rtfErro" hidden></p>' +
        '<div class="gaveta-acoes">' +
          '<button type="button" class="botao botao--fantasma" id="rtfCancelar">Cancelar</button>' +
          '<button type="submit" class="botao">💾 Salvar</button>' +
        "</div>" +
      "</form>";

    A.abrirModal({
      titulo: novo ? "Escrever roteiro na mão" : "Editar roteiro",
      corpoHTML: html,
      onMontar: function (caixa) {
        caixa.classList.add("modal-caixa--largo");
        caixa.querySelector("#rtfCancelar").addEventListener("click", A.fecharModal);
        caixa.querySelector("#rtForm").addEventListener("submit", function (e) {
          e.preventDefault();
          var erro = document.getElementById("rtfErro");
          erro.hidden = true;

          var urlBruta = document.getElementById("rtfUrl").value.trim();
          var link = urlBruta ? limparLink(urlBruta) : null;
          if (link && !link.ok && link.motivo === "invalido") {
            erro.hidden = false;
            erro.textContent = "O link não parece certo. Ele precisa começar com http. Se não tiver link, deixe o campo vazio.";
            return;
          }
          var perfil = document.getElementById("rtfPerfil").value.trim().replace(/^@+/, "");
          var vistas = {};
          var listaTags = document.getElementById("rtfTags").value.split(",").map(function (t) {
            return t.trim().replace(/^#+/, "");
          }).filter(function (t) {
            if (!t || vistas[t.toLowerCase()]) return false;
            vistas[t.toLowerCase()] = true;
            return true;
          });

          var valores = {
            titulo: document.getElementById("rtfTitulo").value.trim() || null,
            de_quem: document.getElementById("rtfDeQuem").value,
            perfil: perfil || (link && link.ok ? link.perfil : "") || null,
            url: link ? (link.ok ? link.url : urlBruta) : null,
            fonte: link && link.ok ? link.fonte : "manual",
            postado_em: document.getElementById("rtfPostado").value || null,
            tags: listaTags,
            legenda: document.getElementById("rtfLegenda").value.trim() || null,
            transcricao: document.getElementById("rtfTranscricao").value.trim() || null,
            obs: document.getElementById("rtfObs").value.trim() || null
          };
          /* salvar pelo modal sempre deixa o card pronto, a não ser
             que ele ainda esteja sendo ouvido agora nesta aba */
          if (!(tarefa && tarefa.id === r.id)) { valores.status = "pronto"; valores.erro = null; }

          var chamada = novo ? A.gravar("roteiros", "insert", { valores: valores }) : A.gravar("roteiros", "update", { id: r.id, valores: valores });
          chamada.then(function (res) {
            if (!res.ok) { erro.hidden = false; erro.textContent = mensagemBanco(res.erro); return; }
            var salva = (res.dados && res.dados[0]) || Object.assign({}, r, valores);
            substituirLocal(salva);
            A.fecharModal();
            renderTudo();
            A.toast(novo ? "Roteiro guardado ✓" : "Roteiro salvo ✓", "ok");
            if (avisoAtual && (avisoAtual.tipo === "ok" || avisoAtual.tipo === "ambar") && !tarefa) mostrarAviso(null);
          });
        });
      }
    });
  }

  /* ============================================================
     ESTUDAR COM O CLAUDE (monta o prompt e copia)
     ============================================================ */
  function montarPrompt(lista) {
    var videos = lista.map(function (r, i) {
      var fonte = (FONTES[r.fonte] || FONTES.manual).nome;
      var perfil = r.perfil ? "@" + String(r.perfil).replace(/^@/, "") : "perfil não informado";
      return "Vídeo " + (i + 1) + " · " + perfil + " · " + fonte + (r.titulo ? " · " + r.titulo : "") + "\n" +
        (r.url ? "Link: " + r.url + "\n" : "") +
        "Transcrição:\n" + r.transcricao.trim();
    }).join("\n\n");

    return [
      "Oi, Claude. Eu sou a Paloma Ribeiro, creator de UGC. Abaixo estão as transcrições dos últimos " + lista.length + " vídeos de outras creators que eu guardei pra estudar.",
      "",
      "Quero que você analise tudo e me entregue, nesta ordem:",
      "",
      "1. Assuntos em alta: quais temas aparecem mais e por que você acha que estão funcionando.",
      "2. Expressões que estão prendendo: frases, bordões e jeitos de falar que se repetem ou chamam atenção.",
      "3. Padrões de gancho: os tipos de abertura usados nos primeiros segundos. Pra cada padrão, mostre um exemplo real tirado das transcrições abaixo e diga de qual perfil ele veio.",
      "4. Cinco roteiros novos no MEU assunto, reaproveitando a estrutura desses vídeos (a estrutura, não o conteúdo). Pra cada roteiro: gancho, desenvolvimento e fechamento com chamada pra ação, e diga qual estrutura de cima ele usou.",
      "",
      "Meu assunto: [escreva aqui o seu nicho ou o produto, por exemplo: skincare, cabelo, moda]",
      "",
      "Regras pros roteiros: linguagem falada e natural, do jeito que eu conversaria com uma amiga. Nada robotizado, nada de frase de propaganda e nada de copiar frase das outras creators.",
      "",
      "===== VÍDEOS =====",
      "",
      videos
    ].join("\n");
  }

  function estudarComClaude() {
    var lista = todos.filter(function (r) {
      return r.de_quem === "outra" && r.transcricao && r.transcricao.trim();
    }).slice(0, 10);
    if (!lista.length) {
      mostrarAviso("ambar", "<p>🧠 Ainda não tem nenhum roteiro marcado como <b>De outra</b> com transcrição. Transcreve alguns reels de outras creators primeiro.</p>");
      return;
    }
    var prompt = montarPrompt(lista);
    copiarTexto(prompt).then(function () {
      A.toast("Prompt copiado ✓", "ok");
      mostrarAviso("ok",
        "<p><b>🧠 Prompt copiado ✓</b> Ele leva os últimos " + lista.length + " roteiros de outras creators. " +
        'Agora abra o <a href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>, cole (Ctrl+V) e troque a linha do "Meu assunto" pelo seu nicho.</p>');
    }).catch(function () {
      A.abrirModal({
        titulo: "Prompt pro Claude",
        corpoHTML:
          '<h2 class="gaveta-titulo">🧠 Prompt pro Claude</h2>' +
          '<p class="texto-apoio">Não consegui copiar sozinha. Selecione o texto abaixo (Ctrl+A), copie (Ctrl+C) e cole no Claude.</p>' +
          '<textarea class="rt-transcricao-campo" id="rtPromptTexto" rows="16" readonly>' + A.esc(prompt) + "</textarea>",
        onMontar: function (caixa) {
          caixa.classList.add("modal-caixa--largo");
          var t = caixa.querySelector("#rtPromptTexto");
          setTimeout(function () { t.focus(); t.select(); }, 30);
        }
      });
    });
  }

  window.Admin.registrarSecao({
    id: "roteiros",
    grupo: "minha rotina",
    nome: "📜 Roteiros",
    legenda: "Cole o link de um reel e eu transcrevo. Serve pros seus e pros das outras, com etiqueta pra você separar.",
    icone: "",
    montar: montar
  });
})();
