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


// ▼▼▼ [M.04] render() + controller + esqueleto + erro ───────────── INÍCIO ───

export function render(hostElement, opts) {
    if (!hostElement || !(hostElement instanceof Element)) {
        throw new Error("render() exige um Element DOM como host.");
    }

    // Valida opts ANTES de qualquer coisa
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

    // Limpa o host
    try { hostElement.innerHTML = ""; } catch (e) {}

    // Estado interno
    const S = {
        vivo: true,
        host: hostElement,
        opts: optsValidos,
        copaApp: null,
        tela: "selecao",
        deck: _gerarDeckSequencial(),
        blocoAtual: 0,
        indiceNoBloco: 0,
        indiceGlobal: 0,
        temposBlocos: [],
        inicioBlocoPerf: 0,
        errosTropecos: [],
        timers: _criarTimerRegistry()
    };

    // Controller
    const controller = {
        destroy: function () {
            if (!S.vivo) return;
            S.vivo = false;
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
                indiceGlobal: S.indiceGlobal,
                temposBlocos: S.temposBlocos.slice(),
                errosTropecos: S.errosTropecos.slice()
            };
        }
    };

    // Renderiza o esqueleto
    _renderizarEsqueleto(S);

    // CSS + copaApp em background (não bloqueia)
    _garantirCssCarregado().catch(e => console.warn("[Maratona] CSS:", e));
    _esperarCopaApp(5000).then(app => {
        if (!S.vivo) return;
        if (app) {
            S.copaApp = app;
            console.info("[Maratona] window.copaApp disponível. Versão:", app.versao);
        } else {
            console.warn("[Maratona] window.copaApp NÃO ficou disponível em 5s. Verifique se o bloco [19.10] foi aplicado no index.html.");
        }
    });

    return controller;
}

// ─── Renderização do esqueleto (4 telas) ───
function _renderizarEsqueleto(S) {
    const host = S.host;
    if (!host) return;

    host.innerHTML = `
        <div class="maratona-app" data-estado="selecao">
            <div class="maratona-tela maratona-tela-selecao" data-tela="selecao">
                <div class="maratona-card maratona-card-boas-vindas">
                    <div class="maratona-kicker">🏁 MÓDULO MARATONA</div>
                    <h2 class="maratona-titulo">Maratona com Barreiras</h2>
                    <p class="maratona-sub">
                        <strong>4 blocos · 40 perguntas</strong> em ordem sequencial.<br>
                        Fatores fixos por bloco: <strong>2, 3, 4 e 5</strong> · multiplicadores de 1 a 10.
                    </p>
                    <p class="maratona-status">
                        <span class="maratona-dot"></span>
                        Esqueleto carregado · aguardando Fase 1
                    </p>
                    <p class="maratona-nota">
                        Evento: <code data-evento-id>${_escapeHtml(S.opts.eventoId)}</code>
                    </p>
                </div>
            </div>
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
