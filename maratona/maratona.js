/**
 * maratona/maratona.js
 * Copa da Tabuada CEIB 2026 · Módulo "Maratona com Barreiras"
 * Versão do módulo: 1.0.0
 *
 * Blocos implementados até esta entrega:
 *   M.01 — Núcleo: constantes, helpers, validação
 *   M.02 — Gerador de deck sequencial (2x1 → 5x10)
 *   M.03 — Distratores inteligentes (P1/P2/P3)
 *   M.04 — render() + controller + _renderizarEsqueleto + _renderizarErro
 *
 * Contrato público:
 *   import { render } from './maratona/maratona.js';
 *   const ctrl = render(hostElement, { eventoId, onSair?, onFinalizar? });
 *   ctrl.destroy(); ctrl.obterEstado();
 */

// ▼▼▼ [M.01] Núcleo: constantes, helpers, validação ─────────────── INÍCIO ───

const MODULO_NOME = "Maratona com Barreiras";
const MODULO_VERSAO = "1.0.0";

// Estrutura fixa do jogo
const BLOCO_FATORES = [2, 3, 4, 5];
const MULTIPLICADORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TOTAL_BLOCOS = 4;
const PERGUNTAS_POR_BLOCO = 10;
const TOTAL_PERGUNTAS = TOTAL_BLOCOS * PERGUNTAS_POR_BLOCO; // 40

// Distratores
const DISTRATORES_MIN = 1;
const DISTRATORES_MAX = 50;

// CSS (uma única vez por sessão do módulo)
const _cssPromise = { p: null };

// ─── Helpers de escape (fallback local, independente do copaApp) ───
function _escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ─── Helpers de tempo ───
function _formatarTempo(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "0.00s";
    return (ms / 1000).toFixed(2) + "s";
}

// ─── Garantia de CSS (com correção do import.meta.url) ───
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
        // ⚠️ Correção obrigatória: caminho relativo ao PRÓPRIO maratona.js
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

// ─── Espera window.copaApp aparecer (não-bloqueante, não rejeita) ───
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

// ─── Validação de opts ───

// ▼▼▼ [M.15.A] _validarOpts com onVerRanking ─────────────── INÍCIO ───

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
        onFinalizar: typeof opts.onFinalizar === "function" ? opts.onFinalizar : null,
        onVerRanking: typeof opts.onVerRanking === "function" ? opts.onVerRanking : null
    };
}

// ▲▲▲ FIM [M.15.A]

// ─── Timer registry (para destroy limpar tudo) ───
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

    // P1 — tabuadas vizinhas (2x6=12, 2x8=16, 3x7=21 para 2x7=14)
    [fB - 1, fB + 1, fB - 2, fB + 2].forEach((b, i) => {
        if (b >= 1 && b <= 10) push(fA * b, i < 2 ? 1 : 2);
    });
    [fA - 1, fA + 1, fA - 2, fA + 2].forEach((a, i) => {
        if (a >= 1 && a <= 10) push(a * fB, i < 2 ? 1 : 2);
    });

    // P2 — resposta ± 1 / ± fator / ± multiplicador
    push(resposta + 1, 1);
    push(resposta - 1, 1);
    push(resposta + fA, 1);
    push(resposta - fA, 1);
    push(resposta + fB, 2);
    push(resposta - fB, 2);

    // P3 — soma, ±2, ±10, metade, dobro
    push(fA + fB, 3);
    push(resposta + 2, 3);
    push(resposta - 2, 3);
    push(resposta + 10, 3);
    push(resposta - 10, 3);
    push(Math.floor(resposta / 2), 3);
    push(resposta * 2, 3);

    // Ordena globalmente por prioridade
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

    // Estratégia: 1 menor + 1 maior + 1 extra (maior prioridade entre os restantes)
    adicionar(menores[0]);
    adicionar(maiores[0]);
    for (const c of candidatos) {
        if (escolhidos.length >= quantidade) break;
        adicionar(c);
    }

    // Fallback de segurança (caso extremos de borda)
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


// ▼▼▼ [M.04] render() + controller + esqueleto + erro (v2 — Fase 1) ─ INÍCIO ───

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

// ▼▼▼ [M.10.A] State S — adiciona recordePessoalNovo ──────────── INÍCIO ───
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
    // Mapa { b1: tempoMs, b2: tempoMs, ... } com os records pessoais
    // detectados NESTA corrida. Usado apenas para UI (ex.: exibir
    // "Novo Recorde Pessoal!" no checkpoint). A gravação real dos
    // marcos é feita em _salvarResultadoFirebase() por transação,
    // independente deste campo.
    recordePessoalNovo: {},
    timers: _criarTimerRegistry()
};
// ▲▲▲ FIM [M.10.A]

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
            console.warn("[Maratona] window.copaApp NÃO ficou disponível em 5s. Verifique o bloco [19.10] no index.html.");
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
        _renderizarCheckpoint(S, tempo); // Chamada Fase 2
    }, 700);
}

function _continuarProximoBloco(S) {
    if (!S.vivo) return;
    if (S.blocoAtual >= TOTAL_BLOCOS - 1) {
        _renderizarResultado(S); // Chamada Fase 3/4
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
// ▼▼▼ [M.15.B] Helpers "Ver ranking completo" ─────────────── INÍCIO ───

// Dispara o callback onVerRanking (se configurado pelo host).
// O callback recebe { escopo, metrica, bloco? } e é responsável por
// navegar para a tela de ranking no index.html.
function _acionarVerRankingCompleto(S, parametros) {
    if (!S.vivo) return;
    if (!S.opts.onVerRanking) {
        console.warn("[Maratona] onVerRanking não configurado pelo host. Não é possível abrir o ranking.");
        return;
    }
    try {
        S.opts.onVerRanking(parametros || { escopo: "geral", metrica: "tempo" });
    } catch(e) {
        console.warn("[Maratona] onVerRanking lançou erro:", e);
    }
}

// Chamado pelo botão "Ver ranking do Bloco X" no checkpoint.
// ⚠️ O usuário vai SAIR da maratona. Os blocos JÁ CONCLUÍDOS são
// preservados (via marcos) — só o bloco atual não conta como completo.
function _sairDoCheckpointParaRanking(S) {
    if (!S.vivo || S.saindo) return;

    const numBloco = S.blocoAtual + 1;
    const blocosConcluidos = S.blocoAtual;

    const ok = window.confirm(
        `Ver o ranking completo do Bloco ${numBloco}?\n\n` +
        `⚠️ Você vai SAIR da maratona agora.\n` +
        `✅ Os ${blocosConcluidos} bloco(s) já concluído(s) foram salvos.\n` +
        `❌ O Bloco ${numBloco} não será completado (a corrida conta como DNF).`
    );
    if (!ok) return;

    _pausarCronometro(S);
    S.saindo = true;
    S.host.querySelectorAll("button").forEach(b => { b.disabled = true; });

    // Usa os tempos já registrados (o bloco atual em checkpoint já está lá)
    const temposBlocos = [...S.temposBlocos];
    const tempoTotal = temposBlocos.reduce((s, t) => s + (Number(t) || 0), 0);

    _salvarResultadoFirebase(S, temposBlocos, tempoTotal, "dnf", "ver_ranking").finally(() => {
        _acionarVerRankingCompleto(S, {
            escopo: "geral",
            metrica: "barreira",
            bloco: `b${numBloco}`
        });
        try { S.controller.destroy(); } catch(e) {}
    });
}

// Chamado pelo botão "Ver ranking completo" no resultado final.
// A corrida JÁ FOI SALVA como COMPLETE em _renderizarResultado.
// Basta navegar para o ranking (geral + tempo).
function _sairDoResultadoParaRanking(S) {
    if (!S.vivo || S.saindo) return;
    S.saindo = true;
    _acionarVerRankingCompleto(S, {
        escopo: "geral",
        metrica: "tempo"
    });
    try { S.controller.destroy(); } catch(e) {}
}

// ▲▲▲ FIM [M.15.B]

// ▲▲▲ FIM [M.05]

// ▼▼▼ [M.06] Pista visual (SVG + boneco + barreiras) ─────────── INÍCIO ───

const PISTA_X_INICIO = 20;
const PISTA_X_FIM = 380;
const PISTA_LARGURA = PISTA_X_FIM - PISTA_X_INICIO; // 360

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
    // Barreiras concluídas
    S.host.querySelectorAll("[data-barreira]").forEach(el => {
        const i = Number(el.dataset.barreira);
        const concluida = S.temposBlocos[i] != null;
        el.classList.toggle("concluida", concluida);
    });
    // Posição do boneco
    const alvoX = _xParaProgresso(_progressoAtual(S));
    if (Math.abs(alvoX - (S.bonecoX || PISTA_X_INICIO)) > 0.5) {
        _animarBonecoPara(S, alvoX, 400);
    }
}

// ─── Animação da posição (RAF, respeita prefers-reduced-motion) ───
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

// ─── Animações curtas (classe CSS por um instante) ───
function _animarClasseTemporaria(S, seletor, classe, duracaoMs) {
    if (!S.vivo) return;
    const el = S.host.querySelector(seletor);
    if (!el) return;
    el.classList.remove(classe);
    // Reflow para reiniciar a animação
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
    const numBloco = S.blocoAtual + 1;
    
    _tocarSomCopaApp(S, "somConclusao");

    // ⚠️ CORREÇÃO: Se for o último bloco, NÃO exibe o botão "Ver ranking do bloco".
    // O botão "Ver ranking completo" já aparece na tela de Resultado Final.
    const btnVerRankingHtml = (S.opts.onVerRanking && !isUltimo)
        ? `<button type="button" class="maratona-btn-ver-ranking" data-btn-ver-ranking disabled>🏆 Ver ranking completo do Bloco ${numBloco}</button>`
        : "";

    container.innerHTML = `
        <div class="maratona-card maratona-card-checkpoint">
            <div class="maratona-kicker">🚧 BARREIRA ${numBloco} DE ${TOTAL_BLOCOS}</div>
            <h2 class="maratona-titulo">Bloco ${numBloco} concluído!</h2>
            
            <div class="maratona-checkpoint-tempo">
                <div class="maratona-checkpoint-tempo-rotulo">Tempo parcial</div>
                <div class="maratona-checkpoint-tempo-valor">${_formatarTempo(tempo)}</div>
            </div>

            <div class="maratona-checkpoint-ranking" data-checkpoint-ranking>
                <div class="maratona-ranking-loading">⏳ Calculando posição...</div>
            </div>

            <button type="button" class="maratona-btn-continuar" data-btn-continuar disabled>${rotuloBtn} (aguarde...)</button>
            ${btnVerRankingHtml}
        </div>
    `;

    const btn = container.querySelector("[data-btn-continuar]");
    const btnVer = container.querySelector("[data-btn-ver-ranking]");
    
    S.timers.setTimeout(() => {
        if (!S.vivo) return;
        if (btn) {
            btn.disabled = false;
            btn.textContent = rotuloBtn;
        }
        if (btnVer) {
            btnVer.disabled = false;
        }
    }, 1200);

    if (btn) {
        btn.addEventListener("click", () => _continuarProximoBloco(S));
    }
    if (btnVer) {
        btnVer.addEventListener("click", () => _sairDoCheckpointParaRanking(S));
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
        container.innerHTML = `<div class="maratona-ranking-erro">Identifique-se para ver o ranking.</div>`;
        return;
    }

    const chaveAluno = app.chaveAluno(nome, turma);

    try {
        const snap = await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/marcos/${blocoId}`).once('value');
        if (!S.vivo) return;

        const marcos = snap.val() || {};
        let lista = Object.values(marcos).filter(x => x.tempo != null);
        
        // Adiciona o tempo atual do jogador à lista (para visualização imediata)
        lista = lista.filter(x => !(x.nome === nome && x.turma === turma));
        lista.push({ nome, turma, tempo: novoTempo });
        
        lista.sort((a, b) => a.tempo - b.tempo);

        const index = lista.findIndex(x => x.nome === nome && x.turma === turma);
        const recordeAntigo = marcos[chaveAluno] ? marcos[chaveAluno].tempo : null;
        const bateuRecorde = (recordeAntigo === null || novoTempo < recordeAntigo);

        if (bateuRecorde) {
            S.recordePessoalNovo[blocoId] = novoTempo;
        }

        // Desenha o Top 5
        let html = `<div class="maratona-ranking-box">
            <div class="maratona-ranking-titulo">🏆 Melhores tempos deste bloco</div>`;
            
        lista.slice(0, 5).forEach((m, i) => {
            const ehVoce = (m.nome === nome && m.turma === turma);
            html += `<div class="maratona-ranking-linha ${ehVoce ? 'voce' : ''}">
                <span class="pos">${i + 1}º</span>
                <span class="nome">${escaparHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small> ${ehVoce ? '← Você' : ''}</span>
                <span class="tempo">${_formatarTempo(m.tempo)}</span>
            </div>`;
        });

        // Se o aluno não estiver no Top 5, mostra a posição dele embaixo
        if (index >= 5) {
            html += `<div class="maratona-ranking-linha voce" style="margin-top:4px; border-top:1px dashed rgba(148,163,184,.3); border-radius:0; padding-top:8px;">
                <span class="pos">${index + 1}º</span>
                <span class="nome">${escaparHtml(nome.split(' ')[0])} <small>(${turma})</small></span>
                <span class="tempo">${_formatarTempo(novoTempo)}</span>
            </div>`;
        }
        
        html += `</div>`;

        if (bateuRecorde) {
            html += `<div class="maratona-ranking-posicao destaque" style="margin-top: 10px; background:rgba(16,185,129,0.15); border-color:#10b981; color:#6ee7b7;">
                <span class="maratona-ranking-icone">🔥</span>
                <span>Novo Recorde Pessoal!</span>
            </div>`;
        }

        container.innerHTML = html;

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
    
    const btnVerRankingHtml = S.opts.onVerRanking
        ? `<button type="button" class="maratona-btn-ver-ranking-destaque" data-btn-ver-ranking>🏆 Ver ranking completo</button>`
        : "";
    const gridStyle = S.opts.onVerRanking ? "" : "grid-template-columns: 1fr;";
    
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
                <div class="maratona-resultado-subtitulo">Tempos e Posições por bloco</div>
                <div class="maratona-resultado-lista" id="maratona-lista-blocos-res" style="display:flex; flex-direction:column; gap:8px;">
                    ${S.temposBlocos.map((t, i) => `
                        <div class="maratona-resultado-linha" id="linha-bloco-${i}">
                            <span style="flex:1;">Bloco ${i + 1} (Fator ${i + 2})</span>
                            <strong style="color:var(--m-gold); margin-right:12px;">${_formatarTempo(t)}</strong>
                            <span class="maratona-posicao-bloco" id="pos-bloco-${i}" style="color:var(--m-cyan); font-weight:800; font-size:12px;">⏳...</span>
                        </div>
                    `).join("")}
                </div>
            </div>

            ${_renderizarTropecos(S.errosTropecos)}

            <div class="maratona-resultado-acoes" style="${gridStyle}">
                ${btnVerRankingHtml}
                <button type="button" class="maratona-btn-voltar-secundario" data-btn-voltar>🏠 Voltar ao início</button>
            </div>
        </div>
    `;

    const btnVoltar = container.querySelector("[data-btn-voltar]");
    if (btnVoltar) btnVoltar.addEventListener("click", () => {
        if (S.opts.onFinalizar) {
            try { S.opts.onFinalizar({ eventoId: S.opts.eventoId, temposBlocos: S.temposBlocos.slice(), tempoTotal }); } catch (e) {}
        }
        if (S.opts.onSair) {
            try { S.opts.onSair(); } catch (e) {}
        }
        try { S.controller.destroy(); } catch (e) {}
    });

    const btnVerRanking = container.querySelector("[data-btn-ver-ranking]");
    if (btnVerRanking) btnVerRanking.addEventListener("click", () => _sairDoResultadoParaRanking(S));

    await _salvarResultadoFirebase(S, S.temposBlocos, tempoTotal, "completo");
    _buscarRankingGeral(S, tempoTotal);
    _buscarPosicoesBlocos(S);
}

async function _buscarPosicoesBlocos(S) {
    const app = S.copaApp;
    const nome = app ? app.obterNomeAluno() : null;
    const turma = app ? app.obterTurmaAluno() : null;
    if (!app || !app.database || !nome || !turma) return;

    try {
        const snap = await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/marcos`).once('value');
        if (!S.vivo) return;
        const todosMarcos = snap.val() || {};

        for (let i = 0; i < 4; i++) {
            const blocoId = `b${i + 1}`;
            const meuTempo = S.temposBlocos[i];
            const marcosBloco = todosMarcos[blocoId] || {};
            
            // Conta quantos alunos têm tempo MENOR que o meu
            let posicao = 1;
            let total = 0;
            Object.values(marcosBloco).forEach(m => {
                if (m.tempo != null) {
                    total++;
                    if (m.tempo < meuTempo) posicao++;
                }
            });
            // Adiciona a mim mesmo ao total
            total++;

            const posEl = document.getElementById(`pos-bloco-${i}`);
            if (posEl) {
                if (posicao === 1) posEl.innerHTML = `🥇 1º lugar`;
                else if (posicao === 2) posEl.innerHTML = `🥈 2º lugar`;
                else if (posicao === 3) posEl.innerHTML = `🥉 3º lugar`;
                else posEl.innerHTML = `${posicao}º lugar`;
            }
        }
    } catch (e) {
        console.warn("[Maratona] Falha ao buscar posições dos blocos:", e);
        for (let i = 0; i < 4; i++) {
            const posEl = document.getElementById(`pos-bloco-${i}`);
            if (posEl) posEl.innerHTML = `—`;
        }
    }
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

    try {
        const snap = await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/tempos`).once('value');
        if (!S.vivo) return;

        const tempos = snap.val() || {};
        let lista = Object.values(tempos).filter(x => x.status === 'completo' && x.tempoTotal != null);
        
        lista.sort((a, b) => a.tempoTotal - b.tempoTotal);
        const index = lista.findIndex(x => x.nome === nome && x.turma === turma);
        
        let html = `<div class="maratona-ranking-box">
            <div class="maratona-ranking-titulo">🏆 Top 5 Geral da Maratona</div>`;
            
        lista.slice(0, 5).forEach((m, i) => {
            const ehVoce = (m.nome === nome && m.turma === turma);
            const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
            html += `<div class="maratona-ranking-linha ${ehVoce ? 'voce' : ''}">
                <span class="pos">${medalha}</span>
                <span class="nome">${escaparHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small> ${ehVoce ? '← Você' : ''}</span>
                <span class="tempo">${_formatarTempo(m.tempoTotal)}</span>
            </div>`;
        });

        if (index >= 5) {
            html += `<div class="maratona-ranking-linha voce" style="margin-top:4px; border-top:1px dashed rgba(148,163,184,.3); border-radius:0; padding-top:8px;">
                <span class="pos">${index + 1}º</span>
                <span class="nome">${escaparHtml(nome.split(' ')[0])} <small>(${turma})</small></span>
                <span class="tempo">${_formatarTempo(tempoTotal)}</span>
            </div>`;
        }
        
        html += `</div>`;
        container.innerHTML = html;

    } catch (e) {
        if (!S.vivo) return;
        container.innerHTML = `<div class="maratona-ranking-erro">Ranking offline.</div>`;
    }
}
// ▲▲▲ FIM [M.08]

// ▼▼▼ [M.09] Persistência com compare-before-set (v2) ─────── INÍCIO ───

async function _salvarResultadoFirebase(S, temposBlocos, tempoTotal, status, motivoDnf = null) {
    const app = S.copaApp;
    if (!app || !app.database) return;

    const nome = app.obterNomeAluno();
    const turma = app.obterTurmaAluno();
    if (!nome || !turma) return;

    const chaveAluno = app.chaveAluno(nome, turma);
    if (!chaveAluno) return;

    const eventoId = S.opts.eventoId;
    const basePath = `copa_maratona/eventos/${eventoId}`;

    // ─── Quantos blocos foram DE FATO completados nesta corrida ───
    // Em COMPLETE: os 4 blocos. Em DNF: só até o bloco onde o aluno
    // estava (S.blocoAtual é 0-indexed e representa o bloco em que ele
    // estava quando saiu — os anteriores a ele já estão completos).
    const blocosCompletos = (status === "completo")
        ? TOTAL_BLOCOS
        : Math.max(0, Math.min(TOTAL_BLOCOS, S.blocoAtual));

    // ─── Dispara em paralelo: gravar marcos + gravar tempo total ───
    const promises = [];

    // 1) Marcos por bloco (B1..Bx completados)
    for (let i = 0; i < blocosCompletos; i++) {
        const t = Number(temposBlocos[i]);
        if (!Number.isFinite(t) || t <= 0) continue;
        const blocoId = `b${i + 1}`;
        promises.push(
            _tentarGravarMarco(app, basePath, blocoId, chaveAluno, t, nome, turma)
                .catch(() => { /* já loga dentro */ })
        );
    }

    // 2) Tempo total (com regra de "melhor ever")
    promises.push(
        _tentarGravarTempoTotal(app, basePath, chaveAluno, {
            nome, turma, temposBlocos, tempoTotal, status,
            motivoDnf: (status === "dnf") ? (motivoDnf || "saiu") : null
        }).catch(() => { /* já loga dentro */ })
    );

    try {
        await Promise.all(promises);
    } catch (e) {
        console.warn("[Maratona] Falha agregada ao salvar resultado:", e);
    }
}

// ─── Grava / atualiza o tempo total com regra de "melhor ever" ───
async function _tentarGravarTempoTotal(app, basePath, chaveAluno, dados) {
    const { nome, turma, temposBlocos, tempoTotal, status, motivoDnf } = dados;
    const novoCompleto = (status === "completo");

    const registroNovo = {
        nome,
        turma,
        temposBlocos: temposBlocos.slice(),
        tempoTotal,
        data: new Date().toISOString(),
        status
    };
    if (novoCompleto) {
        delete registroNovo.motivoDnf;
    } else if (motivoDnf) {
        registroNovo.motivoDnf = motivoDnf;
    }

    try {
        const ref = app.database.ref(`${basePath}/tempos/${chaveAluno}`);
        // Transação: garante que dois alunos não se atropelem e que a
        // regra "melhor ever" seja aplicada atomicamente.
        await ref.transaction((atual) => {
            // Sem registro anterior: grava
            if (!atual) return registroNovo;

            const atualCompleto = atual.status === "completo";
            const tempoAtual = Number(atual.tempoTotal) || 0;

            // COMPLETO sempre vence DNF
            if (novoCompleto && !atualCompleto) return registroNovo;

            // COMPLETO vs COMPLETO: só substitui se for mais rápido
            if (novoCompleto && atualCompleto) {
                if (tempoTotal < tempoAtual) return registroNovo;
                return; // aborta (mantém o melhor já gravado)
            }

            // DNF vs COMPLETO: NUNCA sobrescreve
            if (!novoCompleto && atualCompleto) return; // aborta

            // DNF vs DNF: atualiza para refletir o último estado conhecido
            return registroNovo;
        });
    } catch (e) {
        if (e && e.message && e.message.includes("permission_denied")) {
            console.info("[Maratona] Sem permissão para gravar tempo total (permission_denied).");
        } else {
            console.warn("[Maratona] Falha ao gravar tempo total:", e);
        }
    }
}

// ─── Grava / atualiza o recorde pessoal de UM bloco (menor tempo) ───
async function _tentarGravarMarco(app, basePath, blocoId, chaveAluno, novoTempo, nome, turma) {
    try {
        const ref = app.database.ref(`${basePath}/marcos/${blocoId}/${chaveAluno}`);
        await ref.transaction((atual) => {
            // Só grava se for a primeira vez OU se o novo tempo for
            // ESTRITAMENTE menor que o atual. Empate não substitui
            // (mantém a data original da conquista, que é mais justa
            // como "primeira vez que bateu").
            if (atual && Number(atual.tempo) <= novoTempo) return; // aborta
            return {
                tempo: novoTempo,
                data: new Date().toISOString(),
                nome,
                turma
            };
        });
    } catch (e) {
        if (e && e.message && e.message.includes("permission_denied")) {
            console.info(`[Maratona] Sem permissão para gravar marco ${blocoId} (permission_denied).`);
        } else {
            console.warn(`[Maratona] Falha ao gravar marco ${blocoId}:`, e);
        }
    }
}

// ▲▲▲ FIM [M.09]
