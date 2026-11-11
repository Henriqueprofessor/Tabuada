/**
 * maratona/maratona.js
 * Copa da Tabuada CEIB 2026 · Módulo "Maratona com Barreiras"
 * Versão do módulo: 1.0.0
 */

// ▼▼▼ [M.01] Núcleo: constantes, helpers, validação ─────────────── INÍCIO ───

const MODULO_NOME = "Maratona com Barreiras";
const MODULO_VERSAO = "1.0.0";

const BLOCO_FATORES = [2, 3, 4, 5];
const MULTIPLICADORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TOTAL_BLOCOS = 4;
const PERGUNTAS_POR_BLOCO = 10;
const TOTAL_PERGUNTAS = TOTAL_BLOCOS * PERGUNTAS_POR_BLOCO; // 40

const DISTRATORES_MIN = 1;
const DISTRATORES_MAX = 50;

const _cssPromise = { p: null };

function _escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function _formatarTempo(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "0.00s";
    return (ms / 1000).toFixed(2) + "s";
}

function _garantirCssCarregado() {
    if (_cssPromise.p) return _cssPromise.p;
    _cssPromise.p = new Promise((resolve) => {
        const existente = document.querySelector('link[data-maratona-css="1"]');
        if (existente) {
            if (existente.sheet) return resolve();
            existente.addEventListener("load", () => resolve(), { once: true });
            existente.addEventListener("error", () => resolve(), { once: true });
            return;
        }
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = new URL("./maratona.css", import.meta.url).href;
        link.dataset.maratonaCss = "1";
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => {
            console.warn("[Maratona] Falha ao carregar maratona.css — continuando sem estilos.");
            resolve();
        }, { once: true });
        document.head.appendChild(link);
    });
    return _cssPromise.p;
}

function _esperarCopaApp(timeoutMs = 5000) {
    if (window.copaApp) return Promise.resolve(window.copaApp);
    return new Promise((resolve) => {
        const inicio = Date.now();
        const tick = () => {
            if (window.copaApp) return resolve(window.copaApp);
            if (Date.now() - inicio >= timeoutMs) return resolve(null);
            setTimeout(tick, 100);
        };
        tick();
    });
}

function _validarOpts(opts) {
    if (!opts || typeof opts !== "object") {
        throw new Error("render() exige um objeto opts com a propriedade eventoId.");
    }
    if (typeof opts.eventoId !== "string" || !opts.eventoId.trim()) {
        throw new Error("opts.eventoId é obrigatório (string não vazia).");
    }
    return {
        eventoId: opts.eventoId.trim(),
        onSair: typeof opts.onSair === "function" ? opts.onSair : null,
        onFinalizar: typeof opts.onFinalizar === "function" ? opts.onFinalizar : null
    };
}

function _criarTimerRegistry() {
    const ids = new Set();
    return {
        setTimeout(fn, ms) {
            const id = setTimeout(() => { ids.delete(id); try { fn(); } catch (e) {} }, ms);
            ids.add(id);
            return id;
        },
        clearAll() {
            ids.forEach(id => clearTimeout(id));
            ids.clear();
        }
    };
}

// ▲▲▲ FIM [M.01]

// ▼▼▼ [M.02] Gerador de deck sequencial (2x1 → 5x10) ────────────── INÍCIO ───

function _gerarDeckSequencial() {
    const deck = [];
    for (let b = 0; b < TOTAL_BLOCOS; b++) {
        const fA = BLOCO_FATORES[b];
        for (let i = 0; i < PERGUNTAS_POR_BLOCO; i++) {
            const fB = MULTIPLICADORES[i];
            deck.push({
                bloco: b,
                indiceNoBloco: i,
                fA: fA,
                fB: fB,
                resposta: fA * fB
            });
        }
    }
    return deck;
}

// ▲▲▲ FIM [M.02]

// ▼▼▼ [M.03] Distratores inteligentes (P1/P2/P3) ────────────────── INÍCIO ───

function _gerarDistratores(fA, fB, resposta, quantidade = 3) {
    const candidatos = [];
    const push = (valor, prioridade) => {
        const v = Math.round(valor);
        if (!Number.isFinite(v)) return;
        if (v < DISTRATORES_MIN || v > DISTRATORES_MAX) return;
        if (v === resposta) return;
        if (candidatos.some(c => c.valor === v)) return;
        candidatos.push({ valor: v, prioridade });
    };

    [fB - 1, fB + 1, fB - 2, fB + 2].forEach((b, i) => {
        if (b >= 1 && b <= 10) push(fA * b, i < 2 ? 1 : 2);
    });
    [fA - 1, fA + 1, fA - 2, fA + 2].forEach((a, i) => {
        if (a >= 1 && a <= 10) push(a * fB, i < 2 ? 1 : 2);
    });

    push(resposta + 1, 1);
    push(resposta - 1, 1);
    push(resposta + fA, 1);
    push(resposta - fA, 1);
    push(resposta + fB, 2);
    push(resposta - fB, 2);

    push(fA + fB, 3);
    push(resposta + 2, 3);
    push(resposta - 2, 3);
    push(resposta + 10, 3);
    push(resposta - 10, 3);
    push(Math.floor(resposta / 2), 3);
    push(resposta * 2, 3);

    candidatos.sort((x, y) => x.prioridade - y.prioridade);

    const menores = candidatos.filter(c => c.valor < resposta);
    const maiores = candidatos.filter(c => c.valor > resposta);
    const escolhidos = [];
    const adicionar = (c) => {
        if (!c) return false;
        if (escolhidos.some(e => e.valor === c.valor)) return false;
        escolhidos.push(c);
        return true;
    };

    adicionar(menores[0]);
    adicionar(maiores[0]);
    for (const c of candidatos) {
        if (escolhidos.length >= quantidade) break;
        adicionar(c);
    }

    let tentativas = 0;
    while (escolhidos.length < quantidade && tentativas < 100) {
        tentativas++;
        const delta = Math.floor(Math.random() * 20) - 10;
        const v = Math.max(DISTRATORES_MIN, Math.min(DISTRATORES_MAX, resposta + delta));
        if (v !== resposta && !escolhidos.some(e => e.valor === v)) {
            escolhidos.push({ valor: v, prioridade: 99 });
        }
    }

    return escolhidos.slice(0, quantidade).map(c => c.valor);
}

// ▲▲▲ FIM [M.03]

// ▼▼▼ [M.04] render() + controller + esqueleto + erro ───────────── INÍCIO ───

export function render(hostElement, opts) {
    if (!hostElement || !(hostElement instanceof Element)) {
        throw new Error("render() exige um Element DOM como host.");
    }

    let optsValidos;
    try {
        optsValidos = _validarOpts(opts);
    } catch (e) {
        _renderizarErro(hostElement, e.message);
        return {
            destroy: () => { /* nada a limpar */ },
            obterEstado: () => ({ vivo: false, erro: e.message })
        };
    }

    try { hostElement.innerHTML = ""; } catch (e) {}

    const S = {
        vivo: true,
        host: hostElement,
        opts: optsValidos,
        copaApp: null,
        tela: "selecao",
        deck: _gerarDeckSequencial(),
        blocoAtual: 0,
        indiceNoBloco: 0,
        temposBlocos: [],
        inicioBlocoPerf: 0,
        tempoPausadoMs: 0,
        pausadoEmPerf: null,
        pausado: false,
        cronoInterval: null,
        errosTropecos: [],
        bonecoX: 20,
        saindo: false,
        recordePessoalNovo: {},
        timers: _criarTimerRegistry()
    };

    const controller = {
        destroy: function () {
            if (!S.vivo) return;
            S.vivo = false;
            try { _pararCronometro(S); } catch (e) {}
            try { S.timers.clearAll(); } catch (e) {}
            try { hostElement.innerHTML = ""; } catch (e) {}
        },
        obterEstado: function () {
            return {
                vivo: S.vivo,
                tela: S.tela,
                eventoId: S.opts.eventoId,
                blocoAtual: S.blocoAtual,
                indiceNoBloco: S.indiceNoBloco,
                indiceGlobal: S.blocoAtual * PERGUNTAS_POR_BLOCO + S.indiceNoBloco,
                temposBlocos: S.temposBlocos.slice(),
                errosTropecos: S.errosTropecos.slice()
            };
        }
    };
    S.controller = controller;

    _renderizarEsqueleto(S);
    _garantirCssCarregado().catch(e => console.warn("[Maratona] CSS:", e));
    _esperarCopaApp(5000).then(app => {
        if (!S.vivo) return;
        if (app) {
            S.copaApp = app;
            console.info("[Maratona] window.copaApp disponível. Versão:", app.versao);
        } else {
            console.warn("[Maratona] window.copaApp NÃO ficou disponível em 5s.");
        }
    });

    _inicializarTelaSelecao(S);

    return controller;
}

function _renderizarEsqueleto(S) {
    const host = S.host;
    if (!host) return;
    host.innerHTML = `
        <div class="maratona-app" data-estado="selecao">
            <div class="maratona-tela maratona-tela-selecao" data-tela="selecao"></div>
            <div class="maratona-tela maratona-tela-jogo hidden" data-tela="jogo"></div>
            <div class="maratona-tela maratona-tela-checkpoint hidden" data-tela="checkpoint"></div>
            <div class="maratona-tela maratona-tela-resultado hidden" data-tela="resultado"></div>
        </div>
    `;
}

function _renderizarErro(host, mensagem) {
    if (!host) return;
    host.innerHTML = `
        <div class="maratona-app" data-estado="erro">
            <div class="maratona-card maratona-card-erro">
                <div class="maratona-erro-icone" aria-hidden="true">⚠️</div>
                <h2 class="maratona-titulo">Não foi possível iniciar a Maratona</h2>
                <p class="maratona-sub">${_escapeHtml(mensagem)}</p>
            </div>
        </div>
    `;
}

// ▲▲▲ FIM [M.04]

// ▼▼▼ [M.05] Motor do jogo (fluxo, cronômetro, punição, DNF) ─ INÍCIO ───

function _mostrarTela(S, tela) {
    if (!S.vivo) return;
    S.tela = tela;
    S.host.querySelectorAll("[data-tela]").forEach(el => {
        el.classList.toggle("hidden", el.dataset.tela !== tela);
    });
    const app = S.host.querySelector(".maratona-app");
    if (app) app.dataset.estado = tela;
}

function _inicializarTelaSelecao(S) {
    const container = S.host.querySelector('[data-tela="selecao"]');
    if (!container) return;
    container.innerHTML = `
        <div class="maratona-card maratona-card-boas-vindas">
            <div class="maratona-kicker">🏁 MÓDULO MARATONA</div>
            <h2 class="maratona-titulo">Maratona com Barreiras</h2>
            <p class="maratona-sub">
                <strong>4 blocos · 40 perguntas</strong> em ordem sequencial.<br>
                Fatores fixos por bloco: <strong>2, 3, 4 e 5</strong> · multiplicadores de 1 a 10.
            </p>
            <div class="maratona-regras">
                <div class="maratona-regra"><span class="maratona-regra-icone">✅</span><span>Acertou → avança para a próxima pergunta.</span></div>
                <div class="maratona-regra"><span class="maratona-regra-icone">❌</span><span>Errou → volta uma pergunta (a 1ª do bloco não volta).</span></div>
                <div class="maratona-regra"><span class="maratona-regra-icone">⏱️</span><span>O cronômetro conta o tempo real. Pausa a cada bloco concluído.</span></div>
                <div class="maratona-regra"><span class="maratona-regra-icone">🏁</span><span>Vence quem somar o menor tempo nos 4 blocos.</span></div>
            </div>
            <p class="maratona-nota">Evento: <code data-evento-id>${_escapeHtml(S.opts.eventoId)}</code></p>
            <button type="button" class="maratona-btn-comecar" data-btn-comecar>▶ Começar corrida</button>
        </div>
    `;
    const btn = container.querySelector("[data-btn-comecar]");
    if (btn) btn.addEventListener("click", () => _iniciarJogo(S));
}

function _iniciarJogo(S) {
    if (!S.vivo) return;
    S.blocoAtual = 0;
    S.indiceNoBloco = 0;
    S.temposBlocos = [];
    S.errosTropecos = [];
    S.bonecoX = 20;
    S.saindo = false;
    _mostrarTela(S, "jogo");
    _renderizarTelaJogo(S);
    _iniciarBloco(S);
}

function _iniciarBloco(S) {
    if (!S.vivo) return;
    S.inicioBlocoPerf = performance.now();
    S.tempoPausadoMs = 0;
    S.pausadoEmPerf = null;
    S.pausado = false;
    _iniciarCronometro(S);
    _atualizarPerguntaNaTela(S);
    _atualizarPista(S);
}

function _iniciarCronometro(S) {
    _pararCronometro(S);
    if (!S.vivo) return;
    S.cronoInterval = setInterval(() => {
        if (!S.vivo || S.pausado) return;
        _atualizarDisplayCronometro(S);
    }, 50);
    _atualizarDisplayCronometro(S);
}

function _pararCronometro(S) {
    if (S.cronoInterval) {
        clearInterval(S.cronoInterval);
        S.cronoInterval = null;
    }
}

function _tempoBlocoAtual(S) {
    if (!S.inicioBlocoPerf) return 0;
    if (S.pausado && S.pausadoEmPerf) {
        return Math.max(0, S.pausadoEmPerf - S.inicioBlocoPerf - S.tempoPausadoMs);
    }
    return Math.max(0, performance.now() - S.inicioBlocoPerf - S.tempoPausadoMs);
}

function _pausarCronometro(S) {
    if (S.pausado) return;
    S.pausado = true;
    S.pausadoEmPerf = performance.now();
    _pararCronometro(S);
    _atualizarDisplayCronometro(S);
}

function _atualizarDisplayCronometro(S) {
    if (!S.vivo) return;
    const el = S.host.querySelector("[data-cronometro]");
    if (el) el.textContent = _formatarTempo(_tempoBlocoAtual(S));
}

function _renderizarTelaJogo(S) {
    const container = S.host.querySelector('[data-tela="jogo"]');
    if (!container) return;
    container.innerHTML = `
        <div class="maratona-hud">
            <div class="maratona-hud-bloco" data-hud-bloco></div>
            <div class="maratona-hud-tempo" data-cronometro aria-live="off">0.00s</div>
            <button type="button" class="maratona-hud-sair" data-btn-sair>Sair</button>
        </div>
        <div class="maratona-pista" data-pista></div>
        <div class="maratona-pergunta-card" data-pergunta-card></div>
    `;
    const pista = container.querySelector("[data-pista]");
    if (pista) pista.innerHTML = _renderizarPistaHTML(S);
    const btnSair = container.querySelector("[data-btn-sair]");
    if (btnSair) btnSair.addEventListener("click", () => _abrirModalSair(S));
}

function _atualizarPerguntaNaTela(S) {
    if (!S.vivo) return;
    const idx = S.blocoAtual * PERGUNTAS_POR_BLOCO + S.indiceNoBloco;
    const pergunta = S.deck[idx];
    if (!pergunta) return;

    const hud = S.host.querySelector("[data-hud-bloco]");
    if (hud) {
        hud.innerHTML = `Bloco <strong>${S.blocoAtual + 1}/${TOTAL_BLOCOS}</strong> · Pergunta <strong>${S.indiceNoBloco + 1}/${PERGUNTAS_POR_BLOCO}</strong>`;
    }

    const distratores = _gerarDistratores(pergunta.fA, pergunta.fB, pergunta.resposta, 3);
    const opcoes = [pergunta.resposta, ...distratores];
    for (let i = opcoes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opcoes[i], opcoes[j]] = [opcoes[j], opcoes[i]];
    }

    const card = S.host.querySelector("[data-pergunta-card]");
    if (!card) return;
    card.innerHTML = `
        <div class="maratona-pergunta">${pergunta.fA} × ${pergunta.fB} = ?</div>
        <div class="maratona-opcoes">
            ${opcoes.map(v => `<button type="button" class="maratona-opcao" data-valor="${v}">${v}</button>`).join("")}
        </div>
    `;
    card.querySelectorAll(".maratona-opcao").forEach(btn => {
        btn.addEventListener("click", () => {
            const valor = Number(btn.dataset.valor);
            _responder(S, valor, btn);
        });
    });
}

function _desabilitarOpcoes(S) {
    S.host.querySelectorAll(".maratona-opcao").forEach(b => { b.disabled = true; });
}

function _responder(S, valor, btn) {
    if (!S.vivo || S.tela !== "jogo" || S.saindo) return;
    const idx = S.blocoAtual * PERGUNTAS_POR_BLOCO + S.indiceNoBloco;
    const pergunta = S.deck[idx];
    if (!pergunta) return;

    _desabilitarOpcoes(S);
    const acertou = valor === pergunta.resposta;

    if (acertou) {
        if (btn) btn.classList.add("certo");
        _tocarSomCopaApp(S, "somAcerto");
        _animarBonecoAvancar(S);
        S.indiceNoBloco++;

        if (S.indiceNoBloco >= PERGUNTAS_POR_BLOCO) {
            _completarBloco(S);
            return;
        }
        S.timers.setTimeout(() => {
            if (!S.vivo) return;
            _atualizarPerguntaNaTela(S);
        }, 350);
    } else {
        if (btn) btn.classList.add("errado");
        _tocarSomCopaApp(S, "somErro");
        S.errosTropecos.push({
            bloco: S.blocoAtual,
            fA: pergunta.fA,
            fB: pergunta.fB,
            resposta: pergunta.resposta,
            respostaDada: valor
        });
        if (S.indiceNoBloco > 0) S.indiceNoBloco--;
        _animarBonecoTropecar(S);
        S.timers.setTimeout(() => {
            if (!S.vivo) return;
            _atualizarPerguntaNaTela(S);
        }, 750);
    }
}

function _completarBloco(S) {
    if (!S.vivo) return;
    _pausarCronometro(S);
    const tempo = _tempoBlocoAtual(S);
    S.temposBlocos[S.blocoAtual] = tempo;
    _animarBonecoPulo(S);
    S.timers.setTimeout(() => {
        if (!S.vivo) return;
        _mostrarTela(S, "checkpoint");
        _renderizarCheckpoint(S, tempo);
    }, 700);
}

function _continuarProximoBloco(S) {
    if (!S.vivo) return;
    if (S.blocoAtual >= TOTAL_BLOCOS - 1) {
        _renderizarResultado(S);
        return;
    }
    S.blocoAtual++;
    S.indiceNoBloco = 0;
    _mostrarTela(S, "jogo");
    _iniciarBloco(S);
}

function _abrirModalSair(S) {
    if (S.saindo) return;
    const confirmou = window.confirm(
        "Sair da maratona?\n\n" +
        "O progresso atual NÃO será salvo como partida completa.\n" +
        "Você aparecerá como DNF no ranking geral."
    );
    if (!confirmou) return;

    S.saindo = true;
    _pausarCronometro(S);
    S.host.querySelectorAll("button").forEach(b => { b.disabled = true; });

    let tempoAtualBloco = 0;
    if (S.inicioBlocoPerf) tempoAtualBloco = _tempoBlocoAtual(S);
    const temposBlocos = [...S.temposBlocos];
    temposBlocos[S.blocoAtual] = tempoAtualBloco;
    const tempoTotal = temposBlocos.reduce((s, t) => s + (Number(t) || 0), 0);

    _salvarResultadoFirebase(S, temposBlocos, tempoTotal, "dnf", "saiu").finally(() => {
        if (S.opts.onSair) {
            try { S.opts.onSair(); } catch (e) { console.warn("[Maratona] onSair:", e); }
        }
        try { S.controller.destroy(); } catch (e) {}
    });
}

function _tocarSomCopaApp(S, nome) {
    const app = S.copaApp;
    if (!app || typeof app[nome] !== "function") return;
    try { app[nome](); } catch (e) {}
}

// ▲▲▲ FIM [M.05]

// ▼▼▼ [M.06] Pista visual (SVG + boneco + barreiras) ─────────── INÍCIO ───

const PISTA_X_INICIO = 20;
const PISTA_X_FIM = 380;
const PISTA_LARGURA = PISTA_X_FIM - PISTA_X_INICIO;

function _xParaProgresso(progresso) {
    const p = Math.max(0, Math.min(1, progresso));
    return PISTA_X_INICIO + p * PISTA_LARGURA;
}

function _progressoAtual(S) {
    const idx = S.blocoAtual * PERGUNTAS_POR_BLOCO + Math.min(S.indiceNoBloco, PERGUNTAS_POR_BLOCO);
    return idx / TOTAL_PERGUNTAS;
}

function _renderizarPistaHTML(S) {
    const barreirasX = [
        PISTA_X_INICIO + PISTA_LARGURA * 0.25,
        PISTA_X_INICIO + PISTA_LARGURA * 0.50,
        PISTA_X_INICIO + PISTA_LARGURA * 0.75,
        PISTA_X_FIM
    ];
    const barreiras = barreirasX.map((x, i) =>
        `<rect class="pista-barreira" data-barreira="${i}" x="${(x - 3).toFixed(1)}" y="55" width="6" height="30" rx="1.5"/>`
    ).join("");
    const bonecoX = S.bonecoX != null ? S.bonecoX : PISTA_X_INICIO;
    return `
        <svg viewBox="0 0 400 100" class="maratona-pista-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pista da maratona">
            <line x1="${PISTA_X_INICIO}" y1="70" x2="${PISTA_X_FIM}" y2="70" class="pista-trilha"/>
            <line x1="${PISTA_X_INICIO}" y1="58" x2="${PISTA_X_INICIO}" y2="82" class="pista-linha-inicio"/>
            ${barreiras}
            <text x="${PISTA_X_FIM + 4}" y="52" text-anchor="middle" class="pista-chegada">🏁</text>
            <g class="pista-boneco-posicao" data-boneco transform="translate(${bonecoX.toFixed(1)}, 0)">
                <g class="pista-boneco-animacao">
                    <circle cx="0" cy="55" r="8"/>
                    <line x1="0" y1="63" x2="0" y2="75"/>
                    <line x1="-4" y1="72" x2="4" y2="72"/>
                </g>
            </g>
        </svg>
    `;
}

function _atualizarPista(S) {
    if (!S.vivo) return;
    S.host.querySelectorAll("[data-barreira]").forEach(el => {
        const i = Number(el.dataset.barreira);
        const concluida = S.temposBlocos[i] != null;
        el.classList.toggle("concluida", concluida);
    });
    const alvoX = _xParaProgresso(_progressoAtual(S));
    if (Math.abs(alvoX - (S.bonecoX || PISTA_X_INICIO)) > 0.5) {
        _animarBonecoPara(S, alvoX, 400);
    }
}

function _animarBonecoPara(S, targetX, duracao) {
    if (!S.vivo) return;
    const boneco = S.host.querySelector("[data-boneco]");
    if (!boneco) { S.bonecoX = targetX; return; }

    const reduzido = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const inicioX = S.bonecoX != null ? S.bonecoX : PISTA_X_INICIO;
    if (reduzido || Math.abs(targetX - inicioX) < 0.5) {
        S.bonecoX = targetX;
        boneco.setAttribute("transform", `translate(${targetX.toFixed(1)}, 0)`);
        return;
    }

    const t0 = performance.now();
    function tick(agora) {
        if (!S.vivo) return;
        const t = Math.min(1, (agora - t0) / duracao);
        const eased = 1 - Math.pow(1 - t, 3);
        const x = inicioX + (targetX - inicioX) * eased;
        boneco.setAttribute("transform", `translate(${x.toFixed(1)}, 0)`);
        if (t < 1) requestAnimationFrame(tick);
        else S.bonecoX = targetX;
    }
    requestAnimationFrame(tick);
}

function _animarClasseTemporaria(S, seletor, classe, duracaoMs) {
    if (!S.vivo) return;
    const el = S.host.querySelector(seletor);
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth;
    el.classList.add(classe);
    S.timers.setTimeout(() => {
        if (!S.vivo) return;
        const el2 = S.host.querySelector(seletor);
        if (el2) el2.classList.remove(classe);
    }, duracaoMs);
}

function _animarBonecoAvancar(S) {
    _atualizarPista(S);
    _animarClasseTemporaria(S, "[data-boneco] .pista-boneco-animacao", "avancando", 420);
}

function _animarBonecoTropecar(S) {
    _atualizarPista(S);
    _animarClasseTemporaria(S, "[data-boneco] .pista-boneco-animacao", "tropecando", 650);
}

function _animarBonecoPulo(S) {
    _animarClasseTemporaria(S, "[data-boneco] .pista-boneco-animacao", "pulando", 750);
}

// ▲▲▲ FIM [M.06]

// ▼▼▼ [M.07] Tela de checkpoint (pulo de barreira) ─────────────── INÍCIO ───

function _renderizarCheckpoint(S, tempo) {
    const container = S.host.querySelector('[data-tela="checkpoint"]');
    if (!container) return;
    const isUltimo = S.blocoAtual >= TOTAL_BLOCOS - 1;
    const rotuloBtn = isUltimo ? "🏁 Finalizar maratona" : "▶ Continuar";
    const blocoId = `b${S.blocoAtual + 1}`;
    
    _tocarSomCopaApp(S, "somConclusao");

    container.innerHTML = `
        <div class="maratona-card maratona-card-checkpoint">
            <div class="maratona-kicker">🚧 BARREIRA ${S.blocoAtual + 1} DE ${TOTAL_BLOCOS}</div>
            <h2 class="maratona-titulo">Bloco ${S.blocoAtual + 1} concluído!</h2>
            
            <div class="maratona-checkpoint-tempo">
                <div class="maratona-checkpoint-tempo-rotulo">Tempo parcial</div>
                <div class="maratona-checkpoint-tempo-valor">${_formatarTempo(tempo)}</div>
            </div>

            <div class="maratona-checkpoint-ranking" data-checkpoint-ranking>
                <div class="maratona-ranking-loading">⏳ Calculando posição...</div>
            </div>

            <button type="button" class="maratona-btn-continuar" data-btn-continuar disabled>${rotuloBtn} (aguarde...)</button>
        </div>
    `;

    const btn = container.querySelector("[data-btn-continuar]");
    if (btn) {
        S.timers.setTimeout(() => {
            if (!S.vivo) return;
            btn.disabled = false;
            btn.textContent = rotuloBtn;
        }, 1200);
        
        btn.addEventListener("click", () => _continuarProximoBloco(S));
    }

    _buscarRankingBloco(S, blocoId, tempo);
}

async function _buscarRankingBloco(S, blocoId, novoTempo) {
    const container = S.host.querySelector("[data-checkpoint-ranking]");
    if (!container) return;

    const app = S.copaApp;
    const nome = app ? app.obterNomeAluno() : null;
    const turma = app ? app.obterTurmaAluno() : null;
    
    if (!app || !app.database || !nome || !turma) {
        container.innerHTML = `<div class="maratona-ranking-erro">Identifique-se para ver seu recorde.</div>`;
        return;
    }

    const chaveAluno = app.chaveAluno(nome, turma);

    try {
        const snap = await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/marcos/${blocoId}/${chaveAluno}`).once('value');
        if (!S.vivo) return;

        const dadosAtuais = snap.val();
        const recordeAntigo = dadosAtuais ? dadosAtuais.tempo : null;

        if (recordeAntigo === null || novoTempo < recordeAntigo) {
            container.innerHTML = `
                <div class="maratona-ranking-posicao destaque" style="background:rgba(16,185,129,0.15); border-color:#10b981; color:#6ee7b7;">
                    <span class="maratona-ranking-icone">🔥</span>
                    <span>Novo Recorde Pessoal!</span>
                </div>
            `;
            S.recordePessoalNovo[blocoId] = novoTempo;
        } else {
            container.innerHTML = `
                <div class="maratona-ranking-posicao" style="color:var(--m-text-muted); border-color: rgba(148,163,184,0.3); background: rgba(10,22,40,0.6);">
                    <span class="maratona-ranking-icone">🏁</span>
                    <span>Seu recorde neste bloco é <strong>${_formatarTempo(recordeAntigo)}</strong></span>
                </div>
            `;
        }
    } catch (e) {
        if (!S.vivo) return;
        container.innerHTML = `<div class="maratona-ranking-erro">Ranking offline.</div>`;
    }
}

// ▲▲▲ FIM [M.07]

// ▼▼▼ [M.08] Tela de resultado final ───────────────────────────── INÍCIO ───

async function _renderizarResultado(S) {
    if (!S.vivo) return;
    _mostrarTela(S, "resultado");
    const container = S.host.querySelector('[data-tela="resultado"]');
    if (!container) return;
    
    _tocarSomCopaApp(S, "somConclusao");
    
    const tempoTotal = S.temposBlocos.reduce((s, t) => s + (Number(t) || 0), 0);
    
    container.innerHTML = `
        <div class="maratona-card maratona-card-resultado">
            <div class="maratona-kicker">🏁 MARATONA CONCLUÍDA</div>
            <h2 class="maratona-titulo">Você cruzou a linha!</h2>
            
            <div class="maratona-resultado-total">
                <div class="maratona-resultado-total-rotulo">Tempo Total</div>
                <div class="maratona-resultado-total-valor">${_formatarTempo(tempoTotal)}</div>
            </div>

            <div class="maratona-resultado-ranking" data-resultado-ranking>
                <div class="maratona-ranking-loading">⏳ Salvando tempo e buscando posição...</div>
            </div>

            <div class="maratona-resultado-bloco">
                <div class="maratona-resultado-subtitulo">Tempos por bloco</div>
                <div class="maratona-resultado-lista">
                    ${S.temposBlocos.map((t, i) => `
                        <div class="maratona-resultado-linha">
                            <span>Bloco ${i + 1} (Fator ${i + 2})</span>
                            <strong>${_formatarTempo(t)}</strong>
                        </div>
                    `).join("")}
                </div>
            </div>

            ${_renderizarTropecos(S.errosTropecos)}

            <button type="button" class="maratona-btn-comecar" data-btn-voltar style="margin-top:20px;">🏠 Voltar ao início</button>
        </div>
    `;

    const btn = container.querySelector("[data-btn-voltar]");
    if (btn) btn.addEventListener("click", () => {
        if (S.opts.onFinalizar) {
            try { S.opts.onFinalizar({ eventoId: S.opts.eventoId, temposBlocos: S.temposBlocos.slice(), tempoTotal }); } catch (e) {}
        }
        if (S.opts.onSair) {
            try { S.opts.onSair(); } catch (e) {}
        }
        try { S.controller.destroy(); } catch (e) {}
    });

    await _salvarResultadoFirebase(S, S.temposBlocos, tempoTotal, "completo");
    _buscarRankingGeral(S, tempoTotal);
}

function _renderizarTropecos(erros) {
    if (!erros || erros.length === 0) {
        return `
            <div class="maratona-resultado-bloco">
                <div class="maratona-resultado-subtitulo">Tropeços na corrida</div>
                <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#6ee7b7; padding:14px; border-radius:10px; font-size:13.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
                    <span>✨</span> Corrida perfeita! Você não cometeu nenhum erro.
                </div>
            </div>
        `;
    }
    const lista = erros.map(e => `
        <div class="maratona-tropeco-item">
            <span class="maratona-tropeco-op">${e.fA} × ${e.fB}</span>
            <span class="maratona-tropeco-sua">${e.respostaDada}</span>
            <span class="maratona-tropeco-certa">${e.resposta}</span>
        </div>
    `).join("");

    return `
        <div class="maratona-resultado-bloco">
            <div class="maratona-resultado-subtitulo">Tropeços na corrida</div>
            <div class="maratona-tropecos-lista">${lista}</div>
        </div>
    `;
}

async function _buscarRankingGeral(S, tempoTotal) {
    const container = S.host.querySelector("[data-resultado-ranking]");
    if (!container) return;

    const app = S.copaApp;
    const nome = app ? app.obterNomeAluno() : null;
    const turma = app ? app.obterTurmaAluno() : null;
    
    if (!app || !app.database || !nome || !turma) {
        container.innerHTML = `<div class="maratona-ranking-erro">⚠️ Aluno não identificado.</div>`;
        return;
    }

    const chaveAluno = app.chaveAluno(nome, turma);

    try {
        const snap = await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/tempos`).once('value');
        if (!S.vivo) return;

        const tempos = snap.val() || {};
        const lista = Object.values(tempos)
            .filter(x => x.status === 'completo' && x.tempoTotal != null)
            .map(x => ({ chave: x.nome + x.turma, ...x }));

        lista.sort((a, b) => a.tempoTotal - b.tempoTotal);
        const index = lista.findIndex(x => x.chave === chaveAluno);
        
        if (index !== -1) {
            container.innerHTML = `
                <div class="maratona-ranking-posicao destaque">
                    <span class="maratona-ranking-icone">🏆</span>
                    <span>Posição geral: <strong>${index + 1}º</strong> lugar de ${lista.length}</span>
                </div>
            `;
        }
    } catch (e) {
        if (!S.vivo) return;
        container.innerHTML = `<div class="maratona-ranking-erro">Ranking offline.</div>`;
    }
}

// ▲▲▲ FIM [M.08]

// ▼▼▼ [M.09] Persistência + rankings do Firebase ─────────────── INÍCIO ───

async function _salvarResultadoFirebase(S, temposBlocos, tempoTotal, status, motivoDnf = null) {
    const app = S.copaApp;
    if (!app || !app.database) return;

    const nome = app.obterNomeAluno();
    const turma = app.obterTurmaAluno();
    if (!nome || !turma) return;

    const chaveAluno = app.chaveAluno(nome, turma);
    if (!chaveAluno) return;

    const registro = {
        nome, turma, temposBlocos,
        tempoTotal,
        data: new Date().toISOString(),
        status: status || "completo"
    };
    if (status === "dnf") registro.motivoDnf = motivoDnf;

    try {
        await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/tempos/${chaveAluno}`).set(registro);

        if (status === "completo" && S.recordePessoalNovo) {
            const promises = [];
            for (const [blocoId, novoTempo] of Object.entries(S.recordePessoalNovo)) {
                const marco = { tempo: novoTempo, data: new Date().toISOString(), nome, turma };
                const refMarco = app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/marcos/${blocoId}/${chaveAluno}`);
                promises.push(refMarco.set(marco));
            }
            await Promise.all(promises);
        }
    } catch (e) {
        if (e && e.message && e.message.includes("permission_denied")) {
            console.info("[Maratona] Sem permissão para salvar no Firebase (permission_denied).");
        } else {
            console.warn("[Maratona] Falha ao salvar no Firebase:", e);
        }
    }
}

// ▲▲▲ FIM [M.09]
