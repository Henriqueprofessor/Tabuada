/**
 * maratona/maratona.js
 * Copa da Tabuada CEIB 2026 · Módulo "Maratona com Barreiras"
 * Versão do módulo: 1.0.1 (Estável - Sem piscar e com Trava de Segurança)
 */

// ▼▼▼ [M.01] Núcleo: constantes, helpers, validação ─────────────── INÍCIO ───

const MODULO_NOME = "Maratona com Barreiras";
const MODULO_VERSAO = "1.0.1";

const BLOCO_FATORES = [2, 3, 4, 5];
const MULTIPLICADORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TOTAL_BLOCOS = 4;
const PERGUNTAS_POR_BLOCO = 10;
const TOTAL_PERGUNTAS = TOTAL_BLOCOS * PERGUNTAS_POR_BLOCO;

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
        onFinalizar: typeof opts.onFinalizar === "function" ? opts.onFinalizar : null,
        onVerRanking: typeof opts.onVerRanking === "function" ? opts.onVerRanking : null
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
            deck.push({ bloco: b, indiceNoBloco: i, fA: fA, fB: fB, resposta: fA * fB });
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

    [fB - 1, fB + 1, fB - 2, fB + 2].forEach((b, i) => { if (b >= 1 && b <= 10) push(fA * b, i < 2 ? 1 : 2); });
    [fA - 1, fA + 1, fA - 2, fA + 2].forEach((a, i) => { if (a >= 1 && a <= 10) push(a * fB, i < 2 ? 1 : 2); });

    push(resposta + 1, 1); push(resposta - 1, 1);
    push(resposta + fA, 1); push(resposta - fA, 1);
    push(resposta + fB, 2); push(resposta - fB, 2);

    push(fA + fB, 3); push(resposta + 2, 3); push(resposta - 2, 3);
    push(resposta + 10, 3); push(resposta - 10, 3);
    push(Math.floor(resposta / 2), 3); push(resposta * 2, 3);

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

    adicionar(menores[0]); adicionar(maiores[0]);
    for (const c of candidatos) { if (escolhidos.length >= quantidade) break; adicionar(c); }

    let tentativas = 0;
    while (escolhidos.length < quantidade && tentativas < 100) {
        tentativas++;
        const delta = Math.floor(Math.random() * 20) - 10;
        const v = Math.max(DISTRATORES_MIN, Math.min(DISTRATORES_MAX, resposta + delta));
        if (v !== resposta && !escolhidos.some(e => e.valor === v)) escolhidos.push({ valor: v, prioridade: 99 });
    }

    return escolhidos.slice(0, quantidade).map(c => c.valor);
}
// ▲▲▲ FIM [M.03]


// ▼▼▼ [M.04] render() + controller + esqueleto + erro ─ INÍCIO ───
export function render(hostElement, opts) {
    if (!hostElement || !(hostElement instanceof Element)) throw new Error("render() exige um Element DOM como host.");

    // 🛑 TRAVA DE SEGURANÇA
    if (hostElement.querySelector('.maratona-app')) {
        console.warn("[Maratona] Bloqueado: o módulo já está sendo exibido na tela.");
        return { destroy: () => {}, obterEstado: () => ({ vivo: true, tela: 'ativa' }) };
    }

    let optsValidos;
    try { optsValidos = _validarOpts(opts); } catch (e) {
        _renderizarErro(hostElement, e.message);
        return { destroy: () => {}, obterEstado: () => ({ vivo: false, erro: e.message }) };
    }

    try { hostElement.innerHTML = ""; } catch (e) {}

    const S = {
        vivo: true, host: hostElement, opts: optsValidos, copaApp: null, tela: "selecao",
        deck: _gerarDeckSequencial(), blocoAtual: 0, indiceNoBloco: 0, temposBlocos: [],
        inicioBlocoPerf: 0, tempoPausadoMs: 0, pausadoEmPerf: null, pausado: false,
        cronoInterval: null, errosTropecos: [], bonecoX: 20, saindo: false,
        recordePessoalNovo: {}, timers: _criarTimerRegistry(),
        mapStats: {}, tempoInicioConta: 0 // NOVO: Rastreamento do mapa
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
            return { vivo: S.vivo, tela: S.tela, eventoId: S.opts.eventoId, blocoAtual: S.blocoAtual, indiceNoBloco: S.indiceNoBloco, indiceGlobal: S.blocoAtual * PERGUNTAS_POR_BLOCO + S.indiceNoBloco, temposBlocos: S.temposBlocos.slice(), errosTropecos: S.errosTropecos.slice() };
        }
    };
    S.controller = controller;

    _renderizarEsqueleto(S);
    _garantirCssCarregado().catch(e => console.warn("[Maratona] CSS:", e));
    _esperarCopaApp(5000).then(app => {
        if (!S.vivo) return;
        if (app) { S.copaApp = app; console.info("[Maratona] window.copaApp disponível. Versão:", app.versao); }
        else console.warn("[Maratona] window.copaApp NÃO ficou disponível em 5s.");
    });
    
    _inicializarTelaSelecao(S); // Chama a tela inicial com o botão do mapa

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

function _inicializarTelaSelecao(S) {
    const container = S.host.querySelector('[data-tela="selecao"]');
    if (!container) return;
    container.innerHTML = `
        <div class="maratona-card maratona-card-boas-vindas">
            <div class="maratona-kicker">🏁 MÓDULO MARATONA</div>
            <h2 class="maratona-titulo">Maratona com Barreiras</h2>
            <p class="maratona-sub"><strong>4 blocos · 40 perguntas</strong> em ordem sequencial.<br>Fatores fixos por bloco: <strong>2, 3, 4 e 5</strong> · multiplicadores de 1 a 10.</p>
            <div class="maratona-regras">
                <div class="maratona-regra"><span class="maratona-regra-icone">✅</span><span>Acertou → avança para a próxima pergunta.</span></div>
                <div class="maratona-regra"><span class="maratona-regra-icone">❌</span><span>Errou → volta uma pergunta (a 1ª do bloco não volta).</span></div>
                <div class="maratona-regra"><span class="maratona-regra-icone">⏱️</span><span>O cronômetro conta o tempo real. Pausa a cada bloco concluído.</span></div>
                <div class="maratona-regra"><span class="maratona-regra-icone">🏁</span><span>Vence quem somar o menor tempo nos 4 blocos.</span></div>
            </div>
            <p class="maratona-nota">Evento: <code data-evento-id>${_escapeHtml(S.opts.eventoId)}</code></p>
            
            <button type="button" class="maratona-btn-comecar" data-btn-comecar style="margin-bottom: 10px;">▶ Começar corrida</button>
            <button type="button" class="maratona-btn-ver-ranking" onclick="window.abrirMapaMaratonaModal()" style="margin-top: 0;">🗺️ Ver meu Mapa de Tabuadas</button>
        </div>
    `;
    const btn = container.querySelector("[data-btn-comecar]");
    if (btn) btn.addEventListener("click", () => _iniciarJogo(S));
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
    S.host.querySelectorAll("[data-tela]").forEach(el => { el.classList.toggle("hidden", el.dataset.tela !== tela); });
    const app = S.host.querySelector(".maratona-app");
    if (app) app.dataset.estado = tela;
}

function _iniciarJogo(S) {
    if (!S.vivo) return;
    S.blocoAtual = 0; S.indiceNoBloco = 0; S.temposBlocos = []; S.errosTropecos = []; S.bonecoX = 20; S.saindo = false;
    
    // NOVO: Rastreador de operações para o Mapa
    S.mapStats = {}; 
    S.tempoInicioConta = 0;

    _mostrarTela(S, "jogo");
    _renderizarTelaJogo(S);
    _iniciarBloco(S);
}

function _iniciarBloco(S) {
    if (!S.vivo) return;
    S.inicioBlocoPerf = performance.now();
    S.tempoPausadoMs = 0; S.pausadoEmPerf = null; S.pausado = false;
    _iniciarCronometro(S);
    _atualizarPerguntaNaTela(S);
    _atualizarPista(S);
}

function _iniciarCronometro(S) {
    _pararCronometro(S);
    if (!S.vivo) return;
    S.cronoInterval = setInterval(() => { if (!S.vivo || S.pausado) return; _atualizarDisplayCronometro(S); }, 50);
    _atualizarDisplayCronometro(S);
}

function _pararCronometro(S) {
    if (S.cronoInterval) { clearInterval(S.cronoInterval); S.cronoInterval = null; }
}

function _tempoBlocoAtual(S) {
    if (!S.inicioBlocoPerf) return 0;
    if (S.pausado && S.pausadoEmPerf) return Math.max(0, S.pausadoEmPerf - S.inicioBlocoPerf - S.tempoPausadoMs);
    return Math.max(0, performance.now() - S.inicioBlocoPerf - S.tempoPausadoMs);
}

function _pausarCronometro(S) {
    if (S.pausado) return;
    S.pausado = true; S.pausadoEmPerf = performance.now();
    _pararCronometro(S); _atualizarDisplayCronometro(S);
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
    if (hud) hud.innerHTML = `Bloco <strong>${S.blocoAtual + 1}/${TOTAL_BLOCOS}</strong> · Pergunta <strong>${S.indiceNoBloco + 1}/${PERGUNTAS_POR_BLOCO}</strong>`;

    const distratores = _gerarDistratores(pergunta.fA, pergunta.fB, pergunta.resposta, 3);
    const opcoes = [pergunta.resposta, ...distratores];
    for (let i = opcoes.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opcoes[i], opcoes[j]] = [opcoes[j], opcoes[i]]; }

    const card = S.host.querySelector("[data-pergunta-card]");
    if (!card) return;
    
    // NOVO: Reinicia o timer para a nova conta
    S.tempoInicioConta = performance.now();

    card.innerHTML = `
        <div class="maratona-pergunta">${pergunta.fA} × ${pergunta.fB} = ?</div>
        <div class="maratona-opcoes">${opcoes.map(v => `<button type="button" class="maratona-opcao" data-valor="${v}">${v}</button>`).join("")}</div>
    `;
    card.querySelectorAll(".maratona-opcao").forEach(btn => {
        btn.addEventListener("click", () => _responder(S, Number(btn.dataset.valor), btn));
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
    const tempoResposta = Math.max(0, performance.now() - S.tempoInicioConta);

    // NOVO: Salva a resposta no rastreador do Mapa
    const chaveOp = `${pergunta.fA}x${pergunta.fB}`;
    if (!S.mapStats[chaveOp]) S.mapStats[chaveOp] = { respostas: [] };
    S.mapStats[chaveOp].respostas.push({ acertou, tempo: tempoResposta });

    if (acertou) {
        if (btn) btn.classList.add("certo");
        _tocarSomCopaApp(S, "somAcerto");
        _animarBonecoAvancar(S);
        S.indiceNoBloco++;

        if (S.indiceNoBloco >= PERGUNTAS_POR_BLOCO) { _completarBloco(S); return; }
        S.timers.setTimeout(() => { if (!S.vivo) return; _atualizarPerguntaNaTela(S); }, 350);
    } else {
        if (btn) btn.classList.add("errado");
        _tocarSomCopaApp(S, "somErro");
        S.errosTropecos.push({ bloco: S.blocoAtual, fA: pergunta.fA, fB: pergunta.fB, resposta: pergunta.resposta, respostaDada: valor });
        if (S.indiceNoBloco > 0) S.indiceNoBloco--;
        _animarBonecoTropecar(S);
        S.timers.setTimeout(() => { if (!S.vivo) return; _atualizarPerguntaNaTela(S); }, 750);
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
    if (S.blocoAtual >= TOTAL_BLOCOS - 1) { _renderizarResultado(S); return; }
    S.blocoAtual++; S.indiceNoBloco = 0;
    _mostrarTela(S, "jogo"); _iniciarBloco(S);
}

function _abrirModalSair(S) {
    if (S.saindo) return;
    const confirmou = window.confirm("Sair da maratona?\n\nO progresso atual NÃO será salvo como partida completa.\nVocê aparecerá como DNF no ranking geral.");
    if (!confirmou) return;

    S.saindo = true; _pausarCronometro(S);
    S.host.querySelectorAll("button").forEach(b => { b.disabled = true; });

    let tempoAtualBloco = 0;
    if (S.inicioBlocoPerf) tempoAtualBloco = _tempoBlocoAtual(S);
    const temposBlocos = [...S.temposBlocos];
    temposBlocos[S.blocoAtual] = tempoAtualBloco;
    const tempoTotal = temposBlocos.reduce((s, t) => s + (Number(t) || 0), 0);

    _salvarResultadoFirebase(S, temposBlocos, tempoTotal, "dnf", "saiu").finally(() => {
        if (S.opts.onSair) { try { S.opts.onSair(); } catch (e) {} }
        try { S.controller.destroy(); } catch (e) {}
    });
}

function _tocarSomCopaApp(S, nome) {
    const app = S.copaApp;
    if (!app || typeof app[nome] !== "function") return;
    try { app[nome](); } catch (e) {}
}

function _acionarVerRankingCompleto(S, parametros) {
    if (!S.vivo) return;
    if (!S.opts.onVerRanking) { console.warn("[Maratona] onVerRanking não configurado."); return; }
    try { S.opts.onVerRanking(parametros || { escopo: "geral", metrica: "tempo" }); } catch(e) {}
}

function _sairDoCheckpointParaRanking(S) {
    if (!S.vivo || S.saindo) return;
    const b4Feito = S.temposBlocos && S.temposBlocos[3] !== undefined && S.temposBlocos[3] !== null;
    if (b4Feito) { _sairDoResultadoParaRanking(S); return; }

    const numBloco = S.blocoAtual + 1;
    const blocosConcluidos = S.blocoAtual;
    const ok = window.confirm(`Ver o ranking completo do Bloco ${numBloco}?\n\n⚠️ Você vai SAIR da maratona agora.\n✅ Os ${blocosConcluidos} bloco(s) já concluído(s) foram salvos.\n❌ O Bloco ${numBloco} não será completado (a corrida conta como DNF).`);
    if (!ok) return;

    _pausarCronometro(S); S.saindo = true;
    S.host.querySelectorAll("button").forEach(b => { b.disabled = true; });
    const temposBlocos = [...S.temposBlocos];
    const tempoTotal = temposBlocos.reduce((s, t) => s + (Number(t) || 0), 0);

    _salvarResultadoFirebase(S, temposBlocos, tempoTotal, "dnf", "ver_ranking").finally(() => {
        _acionarVerRankingCompleto(S, { escopo: "geral", metrica: "barreira", bloco: `b${numBloco}` });
        try { S.controller.destroy(); } catch(e) {}
    });
}

function _sairDoResultadoParaRanking(S) {
    if (!S.vivo || S.saindo) return;
    S.saindo = true;
    _acionarVerRankingCompleto(S, { escopo: "geral", metrica: "tempo" });
    try { S.controller.destroy(); } catch(e) {}
}
// ▲▲▲ FIM [M.05]


// ▼▼▼ [M.06] Pista visual (SVG + boneco + barreiras) ─────────── INÍCIO ───
const PISTA_X_INICIO = 20;
const PISTA_X_FIM = 380;
const PISTA_LARGURA = PISTA_X_FIM - PISTA_X_INICIO;

function _xParaProgresso(progresso) { return PISTA_X_INICIO + Math.max(0, Math.min(1, progresso)) * PISTA_LARGURA; }
function _progressoAtual(S) { const idx = S.blocoAtual * PERGUNTAS_POR_BLOCO + Math.min(S.indiceNoBloco, PERGUNTAS_POR_BLOCO); return idx / TOTAL_PERGUNTAS; }

function _renderizarPistaHTML(S) {
    const barreirasX = [ PISTA_X_INICIO + PISTA_LARGURA * 0.25, PISTA_X_INICIO + PISTA_LARGURA * 0.50, PISTA_X_INICIO + PISTA_LARGURA * 0.75, PISTA_X_FIM ];
    const barreiras = barreirasX.map((x, i) => `<rect class="pista-barreira" data-barreira="${i}" x="${(x - 3).toFixed(1)}" y="55" width="6" height="30" rx="1.5"/>`).join("");
    const bonecoX = S.bonecoX != null ? S.bonecoX : PISTA_X_INICIO;
    return `
        <svg viewBox="0 0 400 100" class="maratona-pista-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Pista da maratona">
            <line x1="${PISTA_X_INICIO}" y1="70" x2="${PISTA_X_FIM}" y2="70" class="pista-trilha"/>
            <line x1="${PISTA_X_INICIO}" y1="58" x2="${PISTA_X_INICIO}" y2="82" class="pista-linha-inicio"/>
            ${barreiras}
            <text x="${PISTA_X_FIM + 4}" y="52" text-anchor="middle" class="pista-chegada">🏁</text>
            <g class="pista-boneco-posicao" data-boneco transform="translate(${bonecoX.toFixed(1)}, 0)">
                <g class="pista-boneco-animacao">
                    <circle cx="0" cy="55" r="8"/><line x1="0" y1="63" x2="0" y2="75"/><line x1="-4" y1="72" x2="4" y2="72"/>
                </g>
            </g>
        </svg>
    `;
}

function _atualizarPista(S) {
    if (!S.vivo) return;
    S.host.querySelectorAll("[data-barreira]").forEach(el => { el.classList.toggle("concluida", S.temposBlocos[Number(el.dataset.barreira)] != null); });
    const alvoX = _xParaProgresso(_progressoAtual(S));
    if (Math.abs(alvoX - (S.bonecoX || PISTA_X_INICIO)) > 0.5) _animarBonecoPara(S, alvoX, 400);
}

function _animarBonecoPara(S, targetX, duracao) {
    if (!S.vivo) return;
    const boneco = S.host.querySelector("[data-boneco]");
    if (!boneco) { S.bonecoX = targetX; return; }
    const reduzido = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const inicioX = S.bonecoX != null ? S.bonecoX : PISTA_X_INICIO;
    if (reduzido || Math.abs(targetX - inicioX) < 0.5) { S.bonecoX = targetX; boneco.setAttribute("transform", `translate(${targetX.toFixed(1)}, 0)`); return; }
    const t0 = performance.now();
    function tick(agora) {
        if (!S.vivo) return;
        const t = Math.min(1, (agora - t0) / duracao);
        const eased = 1 - Math.pow(1 - t, 3);
        boneco.setAttribute("transform", `translate(${(inicioX + (targetX - inicioX) * eased).toFixed(1)}, 0)`);
        if (t < 1) requestAnimationFrame(tick); else S.bonecoX = targetX;
    }
    requestAnimationFrame(tick);
}

function _animarClasseTemporaria(S, seletor, classe, duracaoMs) {
    if (!S.vivo) return;
    const el = S.host.querySelector(seletor);
    if (!el) return;
    el.classList.remove(classe); void el.offsetWidth; el.classList.add(classe);
    S.timers.setTimeout(() => { if (!S.vivo) return; const el2 = S.host.querySelector(seletor); if (el2) el2.classList.remove(classe); }, duracaoMs);
}
function _animarBonecoAvancar(S) { _atualizarPista(S); _animarClasseTemporaria(S, "[data-boneco] .pista-boneco-animacao", "avancando", 420); }
function _animarBonecoTropecar(S) { _atualizarPista(S); _animarClasseTemporaria(S, "[data-boneco] .pista-boneco-animacao", "tropecando", 650); }
function _animarBonecoPulo(S) { _animarClasseTemporaria(S, "[data-boneco] .pista-boneco-animacao", "pulando", 750); }
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
        if (btn) { btn.disabled = false; btn.textContent = rotuloBtn; }
        if (btnVer) { btnVer.disabled = false; }
    }, 1200);

    if (btn) btn.addEventListener("click", () => _continuarProximoBloco(S));
    if (btnVer) btnVer.addEventListener("click", () => _sairDoCheckpointParaRanking(S));

    _buscarRankingBloco(S, blocoId, tempo, numBloco);
}

async function _buscarRankingBloco(S, blocoId, novoTempo, numBloco) {
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
        
        lista = lista.filter(x => !(x.nome === nome && x.turma === turma));
        lista.push({ nome, turma, tempo: novoTempo });
        lista.sort((a, b) => a.tempo - b.tempo);

        const index = lista.findIndex(x => x.nome === nome && x.turma === turma);
        const recordeAntigo = marcos[chaveAluno] ? marcos[chaveAluno].tempo : null;
        const bateuRecorde = (recordeAntigo === null || novoTempo < recordeAntigo);

        if (bateuRecorde) {
            S.recordePessoalNovo[blocoId] = novoTempo;
            if (window.maratonaDispararFogos) window.maratonaDispararFogos(3);
        }

        let listaTurma = lista.filter(x => x.turma === turma);

        const gerarRankingHTML = (arr, titulo) => {
            if (arr.length === 0) return '';
            let html = `<div class="top5-turma-injetado"><div class="top5-turma-header">${titulo}</div><div class="top5-turma-list">`;
            arr.slice(0, 5).forEach((m, i) => {
                const ehVoce = (m.nome === nome && m.turma === turma);
                const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
                html += `<div class="top5-turma-item ${ehVoce ? 'minha-posicao' : ''}">
                    <span>${medalha} ${_escapeHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small> ${ehVoce ? '← Você' : ''}</span>
                    <span class="top5-turma-tempo">${_formatarTempo(m.tempo)}</span>
                </div>`;
            });
            if (arr.findIndex(x => x.nome === nome && x.turma === turma) >= 5) {
                html += `<div class="top5-turma-item minha-posicao" style="border-top:1px dashed rgba(255,255,255,.2); border-radius:0; margin-top:4px;">
                    <span>${index + 1}º ${_escapeHtml(nome.split(' ')[0])} <small>(${turma})</small></span>
                    <span class="top5-turma-tempo">${_formatarTempo(novoTempo)}</span>
                </div>`;
            }
            html += `</div></div>`;
            return html;
        };

        let html = gerarRankingHTML(lista, `🏆 TOP 5 GERAL - BLOCO ${numBloco}`);
        html += gerarRankingHTML(listaTurma, `🏫 TOP 5 DA SUA TURMA (${turma})`);

        if (bateuRecorde) {
            html += `<div class="maratona-ranking-posicao destaque" style="margin-top: 10px; background:rgba(16,185,129,0.15); border-color:#10b981; color:#6ee7b7;"><span class="maratona-ranking-icone">🔥</span><span>Novo Recorde Pessoal!</span></div>`;
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
    if (window.maratonaDispararFogos) window.maratonaDispararFogos(5);

    const tempoTotal = S.temposBlocos.reduce((s, t) => s + (Number(t) || 0), 0);
    
    const btnVerRankingHtml = S.opts.onVerRanking ? `<button type="button" class="maratona-btn-ver-ranking-destaque" data-btn-ver-ranking>🏆 Ver ranking completo</button>` : "";
    const gridStyle = S.opts.onVerRanking ? "" : "grid-template-columns: 1fr;";
    
    container.innerHTML = `
        <div class="maratona-card maratona-card-resultado">
            <div class="maratona-kicker">🏁 MARATONA CONCLUÍDA</div>
            <h2 class="maratona-titulo">Você cruzou a linha!</h2>
            <div class="maratona-resultado-total"><div class="maratona-resultado-total-rotulo">Tempo Total</div><div class="maratona-resultado-total-valor">${_formatarTempo(tempoTotal)}</div></div>
            <div class="maratona-resultado-ranking" data-resultado-ranking><div class="maratona-ranking-loading">⏳ Salvando tempo e buscando posição...</div></div>
            <div class="maratona-resultado-bloco">
                <div class="maratona-resultado-subtitulo">Tempos e Posições por bloco</div>
                <div class="maratona-resultado-lista" id="maratona-lista-blocos-res" style="display:flex; flex-direction:column; gap:8px;">
                    ${S.temposBlocos.map((t, i) => `<div class="maratona-resultado-linha" id="linha-bloco-${i}"><span style="flex:1;">Bloco ${i + 1} (Fator ${i + 2})</span><strong style="color:var(--m-gold); margin-right:12px;">${_formatarTempo(t)}</strong><span class="maratona-posicao-bloco" id="pos-bloco-${i}" style="color:var(--m-cyan); font-weight:800; font-size:12px;">⏳...</span></div>`).join("")}
                </div>
            </div>
            ${_renderizarTropecos(S.errosTropecos)}
            <div class="maratona-resultado-acoes" style="${gridStyle}">${btnVerRankingHtml}<button type="button" class="maratona-btn-voltar-secundario" data-btn-voltar>🏠 Voltar ao início</button></div>
        </div>
    `;

    const btnVoltar = container.querySelector("[data-btn-voltar]");
    if (btnVoltar) btnVoltar.addEventListener("click", () => {
        if (S.opts.onFinalizar) { try { S.opts.onFinalizar({ eventoId: S.opts.eventoId, temposBlocos: S.temposBlocos.slice(), tempoTotal }); } catch (e) {} }
        if (S.opts.onSair) { try { S.opts.onSair(); } catch (e) {} }
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
            let posicao = 1; let total = 0;
            Object.values(marcosBloco).forEach(m => { if (m.tempo != null) { total++; if (m.tempo < meuTempo) posicao++; } });
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
        for (let i = 0; i < 4; i++) { const posEl = document.getElementById(`pos-bloco-${i}`); if (posEl) posEl.innerHTML = `—`; }
    }
}

function _renderizarTropecos(erros) {
    if (!erros || erros.length === 0) return `<div class="maratona-resultado-bloco"><div class="maratona-resultado-subtitulo">Tropeços na corrida</div><div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#6ee7b7; padding:14px; border-radius:10px; font-size:13.5px; font-weight:700; display:flex; align-items:center; gap:8px;"><span>✨</span> Corrida perfeita! Você não cometeu nenhum erro.</div></div>`;
    const lista = erros.map(e => `<div class="maratona-tropeco-item"><span class="maratona-tropeco-op">${e.fA} × ${e.fB}</span><span class="maratona-tropeco-sua">${e.respostaDada}</span><span class="maratona-tropeco-certa">${e.resposta}</span></div>`).join("");
    return `<div class="maratona-resultado-bloco"><div class="maratona-resultado-subtitulo">Tropeços na corrida</div><div class="maratona-tropecos-lista">${lista}</div></div>`;
}

async function _buscarRankingGeral(S, tempoTotal) {
    const container = S.host.querySelector("[data-resultado-ranking]");
    if (!container) return;
    const app = S.copaApp;
    const nome = app ? app.obterNomeAluno() : null;
    const turma = app ? app.obterTurmaAluno() : null;
    if (!app || !app.database || !nome || !turma) { container.innerHTML = `<div class="maratona-ranking-erro">⚠️ Aluno não identificado.</div>`; return; }

    try {
        const snap = await app.database.ref(`copa_maratona/eventos/${S.opts.eventoId}/tempos`).once('value');
        if (!S.vivo) return;
        const tempos = snap.val() || {};
        let lista = Object.values(tempos).filter(x => x.status === 'completo' && x.tempoTotal != null);
        lista.sort((a, b) => a.tempoTotal - b.tempoTotal);
        
        let listaTurma = lista.filter(x => x.turma === turma);

        const gerarRankingHTML = (arr, titulo, isGeral) => {
            if (arr.length === 0) return '';
            let html = `<div class="top5-turma-injetado"><div class="top5-turma-header">${titulo}</div><div class="top5-turma-list">`;
            arr.slice(0, 5).forEach((m, i) => {
                const ehVoce = (m.nome === nome && m.turma === turma);
                const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
                html += `<div class="top5-turma-item ${ehVoce ? 'minha-posicao' : ''}">
                    <span>${medalha} ${_escapeHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small> ${ehVoce ? '← Você' : ''}</span>
                    <span class="top5-turma-tempo">${_formatarTempo(m.tempoTotal)}</span>
                </div>`;
            });
            const index = arr.findIndex(x => x.nome === nome && x.turma === turma);
            if (index >= 5) {
                html += `<div class="top5-turma-item minha-posicao" style="border-top:1px dashed rgba(255,255,255,.2); border-radius:0; margin-top:4px;">
                    <span>${index + 1}º ${_escapeHtml(nome.split(' ')[0])} <small>(${turma})</small></span>
                    <span class="top5-turma-tempo">${_formatarTempo(tempoTotal)}</span>
                </div>`;
            }
            html += `</div></div>`;
            return html;
        };

        let html = gerarRankingHTML(lista, `🏆 TOP 5 GERAL DA MARATONA`, true);
        html += gerarRankingHTML(listaTurma, `🏫 TOP 5 DA SUA TURMA (${turma})`, false);
        
        container.innerHTML = html;
    } catch (e) {
        if (!S.vivo) return;
        container.innerHTML = `<div class="maratona-ranking-erro">Ranking offline.</div>`;
    }
}
// ▲▲▲ FIM [M.08]


// ▼▼▼ [M.09] Persistência com compare-before-set ─────── INÍCIO ───
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
    const blocosCompletos = (status === "completo") ? TOTAL_BLOCOS : Math.max(0, Math.min(TOTAL_BLOCOS, S.blocoAtual));

    const promises = [];

    for (let i = 0; i < blocosCompletos; i++) {
        const t = Number(temposBlocos[i]);
        if (!Number.isFinite(t) || t <= 0) continue;
        const blocoId = `b${i + 1}`;
        promises.push(_tentarGravarMarco(app, basePath, blocoId, chaveAluno, t, nome, turma).catch(() => {}));
    }

    promises.push(_tentarGravarTempoTotal(app, basePath, chaveAluno, { nome, turma, temposBlocos, tempoTotal, status, motivoDnf: (status === "dnf") ? (motivoDnf || "saiu") : null }).catch(() => {}));

    // NOVO: Salvar os dados do Mapa
    if (S.mapStats && Object.keys(S.mapStats).length > 0) {
        promises.push(_salvarMapaMaratona(app, basePath, chaveAluno, S.mapStats).catch(() => {}));
    }

    promises.push(_salvarHistoricoMaratona(app, basePath, chaveAluno, { nome, turma, temposBlocos, tempoTotal, status, motivoDnf, errosTropecos: S.errosTropecos }).catch(() => {}));

    try { 
        await Promise.all(promises); 
        if (status === "completo") {
            await _verificarNovasMedalhas(app, eventoId, chaveAluno);
        }
    } catch (e) { 
        console.warn("[Maratona] Falha agregada ao salvar resultado:", e); 
    }
}

// NOVO: Função que mescla os dados do mapa com o que já existe no banco
async function _salvarMapaMaratona(app, basePath, chaveAluno, mapStats) {
    try {
        const snap = await app.database.ref(`${basePath}/mapas/${chaveAluno}`).once('value');
        let atual = snap.val() || {};
        
        Object.entries(mapStats).forEach(([opKey, data]) => {
            if (!atual[opKey]) atual[opKey] = { historico: [] };
            let hist = atual[opKey].historico || [];
            
            data.respostas.forEach(r => {
                hist.push({ acertou: !!r.acertou, tempo: Number(r.tempo) || 0, data: Date.now() });
            });
            
            // Mantém apenas as últimas 15 respostas (mesma lógica do jogo principal)
            if (hist.length > 15) hist = hist.slice(-15);
            atual[opKey].historico = hist;
        });

        await app.database.ref(`${basePath}/mapas/${chaveAluno}`).set(atual);
    } catch (e) {
        console.warn("[Maratona] Falha ao salvar mapa:", e);
    }
}

async function _salvarHistoricoMaratona(app, basePath, chaveAluno, dados) {
    const { nome, turma, temposBlocos, tempoTotal, status, motivoDnf, errosTropecos } = dados;
    const registro = { nome, turma, temposBlocos: temposBlocos.slice(), tempoTotal, status, data: new Date().toISOString() };
    
    if (errosTropecos) registro.errosTropecos = errosTropecos;
    if (status === "dnf" && motivoDnf) registro.motivoDnf = motivoDnf;
    
    try { await app.database.ref(`${basePath}/historico/${chaveAluno}`).push(registro); } catch (e) { console.warn("[Maratona] Falha ao gravar histórico:", e); }
}

async function _tentarGravarTempoTotal(app, basePath, chaveAluno, dados) {
    const { nome, turma, temposBlocos, tempoTotal, status, motivoDnf } = dados;
    const novoCompleto = (status === "completo");

    const registroNovo = { nome, turma, temposBlocos: temposBlocos.slice(), tempoTotal, data: new Date().toISOString(), status };
    if (novoCompleto) delete registroNovo.motivoDnf;
    else if (motivoDnf) registroNovo.motivoDnf = motivoDnf;

    try {
        const ref = app.database.ref(`${basePath}/tempos/${chaveAluno}`);
        await ref.transaction((atual) => {
            if (!atual) return registroNovo;
            const atualCompleto = atual.status === "completo";
            const tempoAtual = Number(atual.tempoTotal) || 0;
            if (novoCompleto && !atualCompleto) return registroNovo;
            if (novoCompleto && atualCompleto) { if (tempoTotal < tempoAtual) return registroNovo; return; }
            if (!novoCompleto && atualCompleto) return;
            return registroNovo;
        });
    } catch (e) { console.warn("[Maratona] Falha ao gravar tempo total:", e); }
}

async function _tentarGravarMarco(app, basePath, blocoId, chaveAluno, novoTempo, nome, turma) {
    try {
        const ref = app.database.ref(`${basePath}/marcos/${blocoId}/${chaveAluno}`);
        await ref.transaction((atual) => {
            if (atual && Number(atual.tempo) <= novoTempo) return;
            return { tempo: novoTempo, data: new Date().toISOString(), nome, turma };
        });
    } catch (e) { console.warn(`[Maratona] Falha ao gravar marco ${blocoId}:`, e); }
}
// ▲▲▲ FIM [M.09]


// ▼▼▼ [M.19] Exportação CSV Avançada ─── INÍCIO ───
export async function exportarCSVMaratona(eventoId, app) {
    if (!app || !app.database) { if (app && app.notificar) app.notificar("Banco de dados indisponível.", "erro"); return; }
    if (app.notificar) app.notificar("⏳ Gerando planilha... Aguarde.", "info");

    try {
        const snapTempos = await app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value');
        const tempos = snapTempos.val() || {};
        const lista = Object.values(tempos).filter(t => t && t.nome);
        lista.sort((a, b) => a.nome.localeCompare(b.nome));

        const esc = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
        const fmtTempo = (ms) => (Number.isFinite(ms) && ms > 0) ? (ms / 1000).toFixed(2) : "";

        let csv = "\ufeffNOME,TURMA,STATUS,TEMPO_TOTAL,BLOCO1,BLOCO2,BLOCO3,BLOCO4,DATA\n";

        lista.forEach(t => {
            const blocos = t.temposBlocos || [];
            const b1 = fmtTempo(blocos[0]); const b2 = fmtTempo(blocos[1]); const b3 = fmtTempo(blocos[2]); const b4 = fmtTempo(blocos[3]);
            let statusTxt = t.status === 'completo' ? 'COMPLETO' : 'DNF';
            if (t.status === 'dnf' && t.motivoDnf) statusTxt = `DNF (${t.motivoDnf})`;
            const tempoTotal = fmtTempo(t.tempoTotal);
            const dataFmt = t.data ? new Date(t.data).toLocaleString('pt-BR') : "";

            csv += `${esc(t.nome)},${esc(t.turma)},${esc(statusTxt)},${tempoTotal},${b1},${b2},${b3},${b4},${esc(dataFmt)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `maratona_${eventoId}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
        if (app.notificar) app.notificar("✅ Planilha exportada com sucesso!", "sucesso");
    } catch(e) {
        console.error("[CSV Maratona] Erro:", e);
        if (app.notificar) app.notificar("Erro ao exportar planilha.", "erro");
    }
}
// ▲▲▲ FIM [M.19]


// ▼▼▼ [M.19.D] Renderização do Hall da Fama ─── INÍCIO ───
export async function renderizarHallDaFama(container, app) {
    if (!app || !app.database) { container.innerHTML = `<div class="desempenho-empty-msg">Banco de dados indisponível.</div>`; return; }

    try {
        const snapEv = await app.database.ref('copa_maratona/eventos').once('value');
        const eventos = snapEv.val() || {};
        let eventoId = null; let maxTs = 0;

        for (const [id, dados] of Object.entries(eventos)) {
            const meta = dados && dados.meta;
            if (!meta) continue;
            if (meta.ativo === true) { eventoId = id; break; }
            const ts = meta.criadoEm || 0;
            if (ts > maxTs) { maxTs = ts; eventoId = id; }
        }

        if (!eventoId) { container.innerHTML = `<div class="desempenho-empty-msg">Nenhum evento de maratona encontrado.</div>`; return; }

        const [snapTempos, snapMarcos] = await Promise.all([
            app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value'),
            app.database.ref(`copa_maratona/eventos/${eventoId}/marcos`).once('value')
        ]);

        const tempos = snapTempos.val() || {};
        const marcos = snapMarcos.val() || {};

        let listaGeral = Object.values(tempos).filter(t => t && t.status === 'completo' && t.tempoTotal != null);
        listaGeral.sort((a, b) => a.tempoTotal - b.tempoTotal);
        const top3 = listaGeral.slice(0, 3);

        let htmlPodio = `<div class="maratona-hall-podio">`;
        const ordemVisual = [
            { pos: 2, item: top3[1], classe: 'pos-2', emoji: '🥈' },
            { pos: 1, item: top3[0], classe: 'pos-1', emoji: '🥇' },
            { pos: 3, item: top3[2], classe: 'pos-3', emoji: '🥉' }
        ];

        ordemVisual.forEach(o => {
            if (!o.item) return;
            htmlPodio += `
                <div class="maratona-hall-podio-item ${o.classe}">
                    <span class="maratona-hall-podio-emoji">${o.emoji}</span>
                    <span class="maratona-hall-podio-nome">${_escapeHtml(o.item.nome)}</span>
                    <span class="maratona-hall-podio-turma">Turma ${o.item.turma}</span>
                    <span class="maratona-hall-podio-tempo">${(o.item.tempoTotal / 1000).toFixed(2)}s</span>
                </div>
            `;
        });
        htmlPodio += `</div>`;
        
        if (top3.length === 0) htmlPodio = `<div class="desempenho-empty-msg">Ninguém completou a maratona ainda.</div>`;

        let htmlBlocos = `<div class="maratona-hall-blocos-grid">`;
        const blocosIds = ['b1', 'b2', 'b3', 'b4'];
        
        blocosIds.forEach(b => {
            const num = b.replace('b', '');
            const alunosBloco = marcos[b] || {};
            let listaB = Object.values(alunosBloco).filter(m => m && m.tempo != null);
            listaB.sort((x, y) => x.tempo - y.tempo);
            const top1 = listaB[0];

            htmlBlocos += `<div class="maratona-hall-bloco-card"><div class="maratona-hall-bloco-titulo">🏁 Bloco ${num} (Fator ${Number(num)+1})</div>`;
            
            if (top1) {
                htmlBlocos += `<div class="maratona-hall-bloco-linha"><span class="maratona-hall-bloco-nome">${_escapeHtml(top1.nome)} <small style="color:var(--text-muted);font-size:10px;">(${top1.turma})</small></span><span class="maratona-hall-bloco-tempo">${(top1.tempo / 1000).toFixed(2)}s</span></div>`;
            } else {
                htmlBlocos += `<div style="font-size:12px;color:var(--text-muted);font-style:italic;">Sem recordes ainda.</div>`;
            }
            
            htmlBlocos += `</div>`;
        });
        htmlBlocos += `</div>`;

        container.innerHTML = `
            <div style="background:linear-gradient(135deg, rgba(19,42,71,0.6) 0%, rgba(15,35,64,0.6) 100%); border:1px solid var(--border-neon); border-radius:14px; padding:16px; text-align:left;">
                <h3 style="font-size:14px; color:var(--neon-gold); margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">🏆 Pódio Geral</h3>
                ${htmlPodio}
                <h3 style="font-size:14px; color:var(--neon-cyan); margin:30px 0 14px 0; text-transform:uppercase; letter-spacing:0.5px;">⚡ Recordistas por Bloco</h3>
                ${htmlBlocos}
            </div>
        `;
    } catch (e) {
        console.warn("[Hall Maratona] Erro ao renderizar:", e);
        container.innerHTML = `<div class="desempenho-empty-msg">Erro ao carregar os dados. Tente novamente.</div>`;
    }
}
// ▲▲▲ FIM [M.19.D]


// ▼▼▼ [M.20] Estatísticas da Maratona no Painel ─── INÍCIO ───
export async function renderizarEstatisticasMaratona(container, app, eventosCache) {
    if (!app || !app.database) {
        container.innerHTML = `<div class="desempenho-empty-msg">Banco de dados indisponível.</div>`;
        return;
    }

    try {
        let eventoId = null;
        let maxTs = 0;
        let nomeEvento = "Evento";

        for (const [id, dados] of Object.entries(eventosCache)) {
            const meta = dados && dados.meta;
            if (!meta) continue;
            if (meta.ativo === true) { eventoId = id; nomeEvento = meta.nome || nomeEvento; break; }
            const ts = meta.criadoEm || 0;
            if (ts > maxTs) { maxTs = ts; eventoId = id; nomeEvento = meta.nome || nomeEvento; }
        }

        if (!eventoId) {
            container.innerHTML = `<div class="desempenho-empty-msg">Nenhum evento encontrado para analisar.</div>`;
            return;
        }

        const [snapTempos, snapMarcos] = await Promise.all([
            app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value'),
            app.database.ref(`copa_maratona/eventos/${eventoId}/marcos`).once('value')
        ]);

        const tempos = snapTempos.val() || {};
        const marcos = snapMarcos.val() || {};

        const totalAlunos = Object.keys(tempos).length;
        let completos = 0;
        let dnfs = 0;

        Object.values(tempos).forEach(t => {
            if (t.status === 'completo') completos++;
            else dnfs++;
        });

        const taxaConclusao = totalAlunos > 0 ? Math.round((completos / totalAlunos) * 100) : 0;
        const pctCompleto = totalAlunos > 0 ? (completos / totalAlunos) * 100 : 0;
        const pctDnf = totalAlunos > 0 ? (dnfs / totalAlunos) * 100 : 0;

        const melhoresBlocos = [];
        ['b1', 'b2', 'b3', 'b4'].forEach(b => {
            const alunosBloco = marcos[b] || {};
            let lista = Object.values(alunosBloco).filter(m => m && m.tempo != null);
            lista.sort((x, y) => x.tempo - y.tempo);
            melhoresBlocos.push({
                bloco: b.toUpperCase(),
                nome: lista[0] ? lista[0].nome.split(' ')[0] : '—',
                tempo: lista[0] ? (lista[0].tempo / 1000).toFixed(2) + 's' : '—'
            });
        });

        let html = `
            <div class="maratona-stats-wrap">
                <div style="font-size:13px; font-weight:800; color:var(--neon-cyan); text-transform:uppercase; margin-bottom:-4px;">
                    📊 Estatísticas do Evento: ${app.escaparHtml(nomeEvento)}
                </div>
                
                <div class="maratona-stats-grid">
                    <div class="maratona-stats-card">
                        <span class="maratona-stats-valor">${totalAlunos}</span>
                        <span class="maratona-stats-rotulo">Alunos que jogaram</span>
                    </div>
                    <div class="maratona-stats-card destaque">
                        <span class="maratona-stats-valor">${taxaConclusao}%</span>
                        <span class="maratona-stats-rotulo">Taxa de Conclusão</span>
                    </div>
                </div>

                <div class="maratona-stats-barra-wrap">
                    <div class="maratona-stats-barra-titulo">
                        <span>Completos: ${completos}</span>
                        <span>Desistiram (DNF): ${dnfs}</span>
                    </div>
                    <div class="maratona-stats-barra-trilha">
                        <div class="maratona-stats-barra-fill completo" style="width: ${pctCompleto}%"></div>
                        <div class="maratona-stats-barra-fill dnf" style="width: ${pctDnf}%"></div>
                    </div>
                </div>

                <div style="background:rgba(10,22,40,0.6); border:1px solid rgba(56,189,248,0.2); border-radius:12px; padding:14px;">
                    <div class="maratona-stats-barra-titulo" style="margin-bottom:10px;">
                        <span>⚡ Melhores Tempos por Bloco</span>
                    </div>
                    <div class="maratona-stats-melhores">
                        ${melhoresBlocos.map(b => `
                            <div class="maratona-stats-melhor-linha">
                                <span>${b.bloco}</span>
                                <span style="color:var(--text-secondary); font-size:12px;">${app.escaparHtml(b.nome)}</span>
                                <strong>${b.tempo}</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

    } catch (e) {
        console.error("[Painel Maratona] Erro nas estatísticas:", e);
        container.innerHTML = `<div class="desempenho-empty-msg">Erro ao carregar as estatísticas do evento.</div>`;
    }
}
// ▲▲▲ FIM [M.20]


// ▼▼▼ [M.21] Fogos de Artifício (Versão Segura) ─── INÍCIO ───
(function maratonaFogos() {
  if (window.__maratonaFogosOK) return;
  window.__maratonaFogosOK = true;

  const coresFw = ['#FFD700','#FF3D00','#00E5FF','#76FF03','#E040FB','#FF4081','#FFEB3B'];

  function getCamada() {
    let l = document.querySelector('.maratona-fireworks-layer');
    if (!l) {
      l = document.createElement('div');
      l.className = 'maratona-fireworks-layer';
      document.body.appendChild(l);
    }
    return l;
  }

  window.maratonaDispararFogos = function(centros) {
    centros = centros || 3;
    const camada = getCamada();
    for (let c = 0; c < centros; c++) {
      const cx = window.innerWidth  * (0.15 + Math.random() * 0.7);
      const cy = window.innerHeight * (0.10 + Math.random() * 0.55);
      const n  = 16 + Math.floor(Math.random() * 8);
      for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        p.className = 'maratona-fw-particula';
        p.style.left = cx + 'px';
        p.style.top  = cy + 'px';
        const ang  = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const dist = 70 + Math.random() * 130;
        p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
        p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
        p.style.background = coresFw[Math.floor(Math.random() * coresFw.length)];
        p.style.boxShadow = '0 0 10px ' + p.style.background;
        camada.appendChild(p);
        setTimeout(() => p.remove(), 1250);
      }
    }
  };
})();
// ▲▲▲ FIM [M.21]


// ▼▼▼ [M.22-B] Botão "Testar Fogos" no Painel ─── INÍCIO ───
(function maratonaTestarFogos() {
  if (window.__maratonaTestarFogosOK) return;
  window.__maratonaTestarFogosOK = true;

  var SELETOR_PAINEL = '[id*="painel" i],[id*="professor" i],[class*="painel" i],[class*="professor" i],[id*="admin" i],[class*="admin" i]';

  function sincronizar() {
    var painel = null;
    var lista = document.querySelectorAll(SELETOR_PAINEL);
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].offsetParent !== null && lista[i].getBoundingClientRect().width > 200) {
        painel = lista[i];
        break;
      }
    }
    
    var btnExistente = document.getElementById('maratona-btn-testar-fogos');
    
    if (painel && !btnExistente) {
      var b = document.createElement('button');
      b.id = 'maratona-btn-testar-fogos';
      b.type = 'button';
      b.textContent = '🧪 Testar Fogos';
      b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100000;padding:12px 18px;border-radius:999px;border:2px solid #FFD700;background:linear-gradient(135deg,#1a1a2e,#16213e);color:#FFD700;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 6px 22px rgba(255,215,0,.35);';
      b.onclick = function() {
        if (typeof window.maratonaDispararFogos === 'function') {
          window.maratonaDispararFogos(5);
          b.textContent = '🎆 Fogos!';
          setTimeout(function() { b.textContent = '🧪 Testar Fogos'; }, 1800);
        }
      };
      document.body.appendChild(b);
    } else if (!painel && btnExistente) {
      btnExistente.remove();
    }
  }

  setInterval(sincronizar, 1000);
})();
// ▲▲▲ FIM [M.22-B]

// ▼▼▼ [M.29-B] INÍCIO — Ferramenta de Comparação (Duelo de Tempos) ───
(function maratonaDueloTempos() {
  if (window.__maratonaDueloTemposOK) return;
  window.__maratonaDueloTemposOK = true;

  document.body.addEventListener('click', async function(e) {
    const tr = e.target.closest('.maratona-tabela-rank tbody tr');
    if (!tr) return;

    const app = window.copaApp;
    if (!app || !app.database) return;

    const tds = tr.querySelectorAll('td');
    if (tds.length < 3) return;

    // 1. Extração super limpa do nome e turma
    let rawName = tds[1].textContent;
    rawName = rawName.replace(/\(.*?\)/g, ''); // remove (3002)
    rawName = rawName.replace(/← Você/g, ''); // remove seta
    rawName = rawName.replace(/👑|TOP 1|[🥇🥈🥉]/g, ''); // remove coroas e medalhas
    rawName = rawName.replace(/^\d+º\s*/, ''); // remove "1º ", "2º " do começo
    const nomeTarget = rawName.trim();
    const turmaTarget = tds[2].textContent.trim();

    const meuNome = app.obterNomeAluno();
    const minhaTurma = app.obterTurmaAluno();

    // Cria o modal com tela de carregamento
    const overlay = document.createElement('div');
    overlay.className = 'maratona-modal-compare';
    overlay.innerHTML = `
      <div class="maratona-modal-card">
        <div class="maratona-modal-header">
          <h3>⚔️ Duelo de Tempos</h3>
          <button class="maratona-modal-close">&times;</button>
        </div>
        <div class="maratona-modal-body">
          <div class="maratona-ranking-loading">⏳ Cruzando dados...</div>
        </div>
      </div>
    `;
    
    const fecharModal = () => overlay.remove();
    overlay.querySelector('.maratona-modal-close').onclick = fecharModal;
    overlay.onclick = (ev) => { if (ev.target === overlay) fecharModal(); };

    document.body.appendChild(overlay);

    try {
      // 2. Descobre o evento ativo
      const snapEv = await app.database.ref('copa_maratona/eventos').once('value');
      const eventos = snapEv.val() || {};
      let eventoId = null;
      let maxTs = 0;
      
      for (const [id, dados] of Object.entries(eventos)) {
        const meta = dados && dados.meta;
        if (!meta) continue;
        if (meta.ativo === true) { eventoId = id; break; }
        const ts = meta.criadoEm || 0;
        if (ts > maxTs) { maxTs = ts; eventoId = id; }
      }
      if (!eventoId) throw new Error("Evento não encontrado.");

      // 3. Baixa a lista completa de tempos
      const snapTempos = await app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value');
      const tempos = snapTempos.val() || {};

      let dadosMeu = null;
      let dadosTarget = null;

      // Funções auxiliares para limpar strings e facilitar a comparação
      const limparNome = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const limparTurma = (t) => String(t || '').replace(/[^a-z0-9]/g, '').trim();

      const meuNomeLimpo = limparNome(meuNome);
      const minhaTurmaLimpa = limparTurma(minhaTurma);
      const nomeTargetLimpo = limparNome(nomeTarget);
      const turmaTargetLimpa = limparTurma(turmaTarget);

      // 4. Procura os dados com busca inteligente
      for (const key in tempos) {
        const t = tempos[key];
        const tNomeLimpo = limparNome(t.nome);
        const tTurmaLimpa = limparTurma(t.turma);

        // Verifica Aluno Logado
        if (!dadosMeu && tTurmaLimpa === minhaTurmaLimpa) {
          if (tNomeLimpo === meuNomeLimpo || tNomeLimpo.includes(meuNomeLimpo) || meuNomeLimpo.includes(tNomeLimpo)) {
            dadosMeu = t;
          }
        }

        // Verifica Alvo
        if (!dadosTarget && tTurmaLimpa === turmaTargetLimpa) {
          if (tNomeLimpo === nomeTargetLimpo || tNomeLimpo.includes(nomeTargetLimpo) || nomeTargetLimpo.includes(tNomeLimpo)) {
            dadosTarget = t;
          }
        }
      }

      if (!dadosMeu) throw new Error("Seus dados não foram encontrados no ranking do evento.");
      if (!dadosTarget) throw new Error(`Dados de ${nomeTarget} não encontrados.`);
      
      // Regra do Resultado Nulo (se clicou em si mesmo)
      if (dadosMeu === dadosTarget || (dadosMeu.nome === dadosTarget.nome && dadosMeu.turma === dadosTarget.turma)) {
        alert("Você não pode comparar com você mesmo! (Resultado Nulo)");
        overlay.remove();
        return;
      }

      // 5. Monta a tabela comparativa (Bloco a Bloco)
      let htmlRows = '';
      const blocos = [0, 1, 2, 3];

      blocos.forEach(i => {
        const tMeu = (dadosMeu.temposBlocos && dadosMeu.temposBlocos[i] != null) ? dadosMeu.temposBlocos[i] : null;
        const tTarget = (dadosTarget.temposBlocos && dadosTarget.temposBlocos[i] != null) ? dadosTarget.temposBlocos[i] : null;

        const valMeu = tMeu != null ? (tMeu / 1000).toFixed(2) : '—';
        const valTarget = tTarget != null ? (tTarget / 1000).toFixed(2) : '—';
        
        let diffHtml = '—';
        if (tMeu != null && tTarget != null) {
          const diff = tTarget - tMeu; // Positivo = Eu sou mais rápido
          const diffSegundos = Math.abs(diff / 1000).toFixed(2);
          
          if (diff > 0) diffHtml = `<span style="color:#10b981; font-weight:bold;">+${diffSegundos}s</span>`;
          else if (diff < 0) diffHtml = `<span style="color:#ef4444; font-weight:bold;">-${diffSegundos}s</span>`;
          else diffHtml = `<span style="color:#fbbf24; font-weight:bold;">Empate</span>`;
        }

        htmlRows += `<tr>
          <td>Bloco ${i+1}</td>
          <td>${valMeu === '—' ? '—' : valMeu + 's'}</td>
          <td>${valTarget === '—' ? '—' : valTarget + 's'}</td>
          <td>${diffHtml}</td>
        </tr>`;
      });

      // 6. Cálculo do Total
      const totalMeu = dadosMeu.tempoTotal || 0;
      const totalTarget = dadosTarget.tempoTotal || 0;
      const diffTotal = totalTarget - totalMeu;
      const diffTotalSeg = Math.abs(diffTotal / 1000).toFixed(2);
      
      let totalHtml = '';
      if (diffTotal > 0) totalHtml = `<span style="color:#10b981; font-weight:bold;">+${diffTotalSeg}s</span>`;
      else if (diffTotal < 0) totalHtml = `<span style="color:#ef4444; font-weight:bold;">-${diffTotalSeg}s</span>`;
      else totalHtml = `<span style="color:#fbbf24; font-weight:bold;">Empate</span>`;

      htmlRows += `<tr style="background:rgba(255,215,0,0.1); font-weight:bold; border-top: 2px solid rgba(255,215,0,0.3);">
        <td>TOTAL</td>
        <td>${(totalMeu / 1000).toFixed(2)}s</td>
        <td>${(totalTarget / 1000).toFixed(2)}s</td>
        <td>${totalHtml}</td>
      </tr>`;

      // 7. Atualiza a tela do modal
      overlay.querySelector('.maratona-modal-body').innerHTML = `
        <p style="text-align:center; margin-top:0; margin-bottom:16px; font-size:14px; color:#e2e8f0;">
          Você 🆚 <strong style="color:#22d3ee;">${dadosTarget.nome}</strong>
        </p>
        <table class="maratona-tabela-compare">
          <thead>
            <tr>
              <th>Bloco</th>
              <th>Você</th>
              <th>${dadosTarget.nome.split(' ')[0]}</th>
              <th>Diferença</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      `;

    } catch (err) {
      console.warn("[Duelo] Erro:", err);
      overlay.querySelector('.maratona-modal-body').innerHTML = `
        <p style="color:#ef4444; font-weight:bold; text-align:center;">Erro: ${err.message}</p>
      `;
    }
  });
})();
// ▲▲▲ FIM [M.29-B] ───

// ▼▼▼ [M.30-B] INÍCIO — Hall da Fama Independente da Maratona ───
(function maratonaHallIndependente() {
  if (window.__maratonaHallIndependenteOK) return;
  window.__maratonaHallIndependenteOK = true;

  async function renderizarHallMaratona(container, app) {
    try {
      const snapEv = await app.database.ref('copa_maratona/eventos').once('value');
      const eventos = snapEv.val() || {};
      let eventoId = null;
      let maxTs = 0;
      
      for (const [id, dados] of Object.entries(eventos)) {
        const meta = dados && dados.meta;
        if (!meta) continue;
        if (meta.ativo === true) { eventoId = id; break; }
        const ts = meta.criadoEm || 0;
        if (ts > maxTs) { maxTs = ts; eventoId = id; }
      }

      if (!eventoId) {
        container.innerHTML = `<div class="maratona-rank-empty">Nenhum evento de maratona encontrado.</div>`;
        return;
      }

      const snapTempos = await app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value');
      const tempos = snapTempos.val() || {};
      
      const snapMarcos = await app.database.ref(`copa_maratona/eventos/${eventoId}/marcos`).once('value');
      const marcos = snapMarcos.val() || {};

      const snapHist = await app.database.ref(`copa_maratona/eventos/${eventoId}/historico`).once('value');
      const historico = snapHist.val() || {};

      const listaTempos = Object.values(tempos).filter(t => t && t.nome);
      const completos = listaTempos.filter(t => t.status === 'completo').sort((a, b) => a.tempoTotal - b.tempoTotal);
      
      const contagemCompletos = {};
      Object.values(historico).forEach(arr => {
        arr.forEach(partida => {
          if (partida.status === 'completo') {
            const key = partida.nome + '|' + partida.turma;
            contagemCompletos[key] = (contagemCompletos[key] || 0) + 1;
          }
        });
      });
      const maratonistas = Object.entries(contagemCompletos)
        .map(([key, qtd]) => ({ nome: key.split('|')[0], turma: key.split('|')[1], qtd }))
        .sort((a, b) => b.qtd - a.qtd);

      const contagemTotal = {};
      Object.values(historico).forEach(arr => {
        arr.forEach(partida => {
          const key = partida.nome + '|' + partida.turma;
          contagemTotal[key] = (contagemTotal[key] || 0) + 1;
        });
      });
      const sobreviventes = Object.entries(contagemTotal)
        .map(([key, qtd]) => ({ nome: key.split('|')[0], turma: key.split('|')[1], qtd }))
        .sort((a, b) => b.qtd - a.qtd);

      const podios = {};
      completos.slice(0, 10).forEach((t, i) => {
        if (i < 3) {
          const key = t.nome + '|' + t.turma;
          podios[key] = (podios[key] || 0) + 1;
        }
      });
      const cacadores = Object.entries(podios)
        .map(([key, qtd]) => ({ nome: key.split('|')[0], turma: key.split('|')[1], qtd }))
        .sort((a, b) => b.qtd - a.qtd);

      const recordesBloco = [];
      ['b1', 'b2', 'b3', 'b4'].forEach(b => {
        const alunos = marcos[b] || {};
        const lista = Object.values(alunos).filter(m => m.tempo).sort((a, b) => a.tempo - b.tempo);
        recordesBloco.push({
          bloco: b.toUpperCase(),
          nome: lista[0] ? lista[0].nome.split(' ')[0] : '—',
          tempo: lista[0] ? (lista[0].tempo / 1000).toFixed(2) + 's' : '—'
        });
      });

      let html = `<div class="maratona-hall-container-override">`;

      html += `
        <div class="maratona-hall-card">
          <div class="maratona-hall-card-header"><span class="maratona-hall-card-emoji">🏆</span><h4 class="maratona-hall-card-title">Mestre da Velocidade</h4></div>
          <p class="maratona-hall-card-desc">O aluno mais rápido a cruzar a linha de chegada.</p>
          <div class="maratona-hall-lista">
            ${completos.slice(0, 3).map((m, i) => `
              <div class="maratona-hall-linha pos-${i+1}">
                <span class="maratona-hall-nome">${i===0?'🥇':i===1?'🥈':'🥉'} ${app.escaparHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small></span>
                <span class="maratona-hall-valor">${(m.tempoTotal / 1000).toFixed(2)}s</span>
              </div>
            `).join('')}
            ${completos.length === 0 ? '<div class="maratona-hall-linha" style="justify-content:center; color:#94a3b8; font-size:12px;">Sem registros</div>' : ''}
          </div>
        </div>
      `;

      html += `
        <div class="maratona-hall-card">
          <div class="maratona-hall-card-header"><span class="maratona-hall-card-emoji">⚡</span><h4 class="maratona-hall-card-title">Recordistas de Blocos</h4></div>
          <p class="maratona-hall-card-desc">Os donos dos melhores tempos em cada barreira.</p>
          <div class="maratona-hall-blocos">
            ${recordesBloco.map(r => `
              <div class="maratona-hall-bloco-mini">
                <div class="titulo">${r.bloco}</div>
                <div class="nome">${app.escaparHtml(r.nome)}</div>
                <div class="tempo">${r.tempo}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      html += `
        <div class="maratona-hall-card">
          <div class="maratona-hall-card-header"><span class="maratona-hall-card-emoji">🔥</span><h4 class="maratona-hall-card-title">Maratonista Nato</h4></div>
          <p class="maratona-hall-card-desc">Quem completou a maratona o maior número de vezes.</p>
          <div class="maratona-hall-lista">
            ${maratonistas.slice(0, 3).map((m, i) => `
              <div class="maratona-hall-linha pos-${i+1}">
                <span class="maratona-hall-nome">${app.escaparHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small></span>
                <span class="maratona-hall-valor">${m.qtd} ${m.qtd === 1 ? 'vez' : 'vezes'}</span>
              </div>
            `).join('')}
            ${maratonistas.length === 0 ? '<div class="maratona-hall-linha" style="justify-content:center; color:#94a3b8; font-size:12px;">Sem registros</div>' : ''}
          </div>
        </div>
      `;

      html += `
        <div class="maratona-hall-card">
          <div class="maratona-hall-card-header"><span class="maratona-hall-card-emoji">🛡️</span><h4 class="maratona-hall-card-title">Sobrevivente</h4></div>
          <p class="maratona-hall-card-desc">Quem mais entrou na pista, independente de terminar.</p>
          <div class="maratona-hall-lista">
            ${sobreviventes.slice(0, 3).map((m, i) => `
              <div class="maratona-hall-linha pos-${i+1}">
                <span class="maratona-hall-nome">${app.escaparHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small></span>
                <span class="maratona-hall-valor">${m.qtd} corridas</span>
              </div>
            `).join('')}
            ${sobreviventes.length === 0 ? '<div class="maratona-hall-linha" style="justify-content:center; color:#94a3b8; font-size:12px;">Sem registros</div>' : ''}
          </div>
        </div>
      `;

      html += `
        <div class="maratona-hall-card">
          <div class="maratona-hall-card-header"><span class="maratona-hall-card-emoji">👑</span><h4 class="maratona-hall-card-title">Caçador de Pódios</h4></div>
          <p class="maratona-hall-card-desc">Quem mais vezes ficou no Top 3 Geral.</p>
          <div class="maratona-hall-lista">
            ${cacadores.slice(0, 3).map((m, i) => `
              <div class="maratona-hall-linha pos-${i+1}">
                <span class="maratona-hall-nome">${app.escaparHtml(m.nome.split(' ')[0])} <small>(${m.turma})</small></span>
                <span class="maratona-hall-valor">${m.qtd} pódios</span>
              </div>
            `).join('')}
            ${cacadores.length === 0 ? '<div class="maratona-hall-linha" style="justify-content:center; color:#94a3b8; font-size:12px;">Sem registros</div>' : ''}
          </div>
        </div>
      `;

      // ⚠️ Card 6 AGORA ABRE O ÁLBUM
      html += `
        <div class="maratona-hall-card">
          <div class="maratona-hall-card-header">
            <span class="maratona-hall-card-emoji">📖</span>
            <h4 class="maratona-hall-card-title">Álbum da Maratona</h4>
          </div>
          <p class="maratona-hall-card-desc">Colecione as figurinhas de cada bloco e complete o álbum.</p>
          <div class="maratona-hall-lista" style="flex-grow:1; display:flex; align-items:center; justify-content:center; padding-top:10px;">
            <button class="maratona-btn-comecar" onclick="window.abrirAlbumMaratonaModal()" style="padding:12px 20px; font-size:13px; width:100%; max-width:200px;">📖 Abrir Álbum</button>
          </div>
        </div>
      `;

      html += `</div>`;
      container.innerHTML = html;

    } catch (e) {
      console.error("Erro no Hall da Maratona:", e);
      container.innerHTML = `<div class="maratona-rank-empty">Erro ao carregar as conquistas da maratona.</div>`;
    }
  }

  let isRendering = false;

  function verificarHallDaFama() {
    if (isRendering) return;
    const headers = Array.from(document.querySelectorAll('h1, h2, h3'));
    const hallTitle = headers.find(el => el.textContent.includes('Hall da Fama'));

    if (!hallTitle) return;

    let container = hallTitle.parentElement;
    while (container && container.tagName !== 'BODY') {
        if (container.querySelector('.maratona-hall-container-override')) return;
        if (container.querySelector('[class*="mais-medalhas" i]') || container.textContent.includes('Mais Medalhas')) break;
        container = container.parentElement;
    }

    if (!container || container.tagName === 'BODY') return;

    const urlTemMaratona = window.location.href.toLowerCase().includes('maratona');
    const app = window.copaApp;
    
    if (urlTemMaratona || (app && app.eventoAtivo === 'maratona')) {
        isRendering = true;
        const filhosOriginais = Array.from(container.children);
        filhosOriginais.forEach(filho => {
            if (!filho.classList.contains('maratona-hall-container-override')) {
                filho.classList.add('hall-original-escondido');
            }
        });

        const novoContainer = document.createElement('div');
        container.appendChild(novoContainer);

        if (app && app.database) {
            renderizarHallMaratona(novoContainer, app);
        }
        setTimeout(() => { isRendering = false; }, 1000);
    }
  }

  setInterval(verificarHallDaFama, 1000);
})();
// ▲▲▲ FIM [M.30-B]

// ▼▼▼ [M.31] Álbum da Maratona ────────────────────────────── INÍCIO ───

const MEDALHAS_MARATONA = [
    // Primeiros Passos
    { id: "m_estreia", nome: "Estreia", icone: "🆕", secao: "primeiros_passos", raridade: "comum", requisito: "Entrar na pista pela primeira vez.", condicao: d => d.totalPartidas >= 1 },
    { id: "m_primeira_barreira", nome: "Primeira Barreira", icone: "🚧", secao: "primeiros_passos", raridade: "comum", requisito: "Completar o Bloco 1.", condicao: d => d.blocosCompletos >= 1 },
    { id: "m_maratonista", nome: "Maratonista", icone: "🏁", secao: "primeiros_passos", raridade: "incomum", requisito: "Completar os 4 blocos.", condicao: d => d.partidasCompletas >= 1 },
    
    // Velocidade
    { id: "m_velocista_b1", nome: "Velocista B1", icone: "⚡", secao: "velocidade", raridade: "comum", requisito: "Completar o Bloco 1 em menos de 15s.", condicao: d => d.melhorTempoB1 > 0 && d.melhorTempoB1 <= 15000 },
    { id: "m_velocista_b2", nome: "Velocista B2", icone: "💨", secao: "velocidade", raridade: "incomum", requisito: "Completar o Bloco 2 em menos de 20s.", condicao: d => d.melhorTempoB2 > 0 && d.melhorTempoB2 <= 20000 },
    { id: "m_velocista_b3", nome: "Velocista B3", icone: "🚀", secao: "velocidade", raridade: "raro", requisito: "Completar o Bloco 3 em menos de 25s.", condicao: d => d.melhorTempoB3 > 0 && d.melhorTempoB3 <= 25000 },
    { id: "m_velocista_b4", nome: "Velocista B4", icone: "🔥", secao: "velocidade", raridade: "epico", requisito: "Completar o Bloco 4 em menos de 30s.", condicao: d => d.melhorTempoB4 > 0 && d.melhorTempoB4 <= 30000 },

    // Precisão
    { id: "m_sem_tropeco", nome: "Sem Tropeço", icone: "🎯", secao: "precisao", raridade: "raro", requisito: "Completar uma maratona sem errar nenhuma conta.", condicao: d => d.partidasPerfeitas >= 1 },
    { id: "m_impecavel", nome: "Impecável", icone: "💎", secao: "precisao", raridade: "lendario", requisito: "Completar 3 maratonas sem errar.", condicao: d => d.partidasPerfeitas >= 3 },

    // Dedicação
    { id: "m_volta_amanha", nome: "Volta Amanhã", icone: "🌅", secao: "dedicacao", raridade: "comum", requisito: "Jogar em 2 dias diferentes.", condicao: d => d.diasDistintos >= 2 },
    { id: "m_maratonista_nato", nome: "Maratonista Nato", icone: "🏃", secao: "dedicacao", raridade: "raro", requisito: "Completar 5 maratonas.", condicao: d => d.partidasCompletas >= 5 },
    { id: "m_sobrevivente", nome: "Sobrevivente", icone: "🛡️", secao: "dedicacao", raridade: "epico", requisito: "Entrar na pista 10 vezes.", condicao: d => d.totalPartidas >= 10 },

    // Recordes
    { id: "m_recorde_pessoal", nome: "Superação", icone: "📈", secao: "recordes", raridade: "incomum", requisito: "Bater seu próprio recorde de tempo total.", condicao: d => d.bateuRecordePessoal },
    { id: "m_cacador_podio", nome: "Caçador de Pódios", icone: "👑", secao: "recordes", raridade: "lendario", requisito: "Ficar no Top 3 Geral da maratona.", condicao: d => d.melhorPosicaoGlobal > 0 && d.melhorPosicaoGlobal <= 3 }
];

const SECOES_MARATONA = [
    { id: "primeiros_passos", nome: "Primeiros Passos", icone: "📚" },
    { id: "velocidade", nome: "Velocidade", icone: "⚡" },
    { id: "precisao", nome: "Precisão", icone: "🎯" },
    { id: "dedicacao", nome: "Dedicação", icone: "💪" },
    { id: "recordes", nome: "Recordes", icone: "🏆" }
];

const RARIDADES_MARATONA = {
    comum: { nome: "Comum", emoji: "⚪" },
    incomum: { nome: "Incomum", emoji: "🟢" },
    raro: { nome: "Raro", emoji: "🔵" },
    epico: { nome: "Épico", emoji: "🟣" },
    lendario: { nome: "Lendário", emoji: "🟡" }
};

function _compilarDadosAlbum(historicoObj, temposObj, nome, turma) {
    const partidas = Object.values(historicoObj || {});
    const totalPartidas = partidas.length;
    let partidasCompletas = 0;
    let partidasPerfeitas = 0;
    let diasDistintos = new Set();
    let melhorTempoB1 = Infinity, melhorTempoB2 = Infinity, melhorTempoB3 = Infinity, melhorTempoB4 = Infinity;
    let melhorTempoTotal = Infinity;
    let bateuRecordePessoal = false;

    partidas.sort((a, b) => new Date(a.data) - new Date(b.data));
    let recordeAtual = Infinity;

    partidas.forEach(p => {
        if (p.status === 'completo') {
            partidasCompletas++;
            if (p.temposBlocos) {
                if (p.temposBlocos[0] > 0) melhorTempoB1 = Math.min(melhorTempoB1, p.temposBlocos[0]);
                if (p.temposBlocos[1] > 0) melhorTempoB2 = Math.min(melhorTempoB2, p.temposBlocos[1]);
                if (p.temposBlocos[2] > 0) melhorTempoB3 = Math.min(melhorTempoB3, p.temposBlocos[2]);
                if (p.temposBlocos[3] > 0) melhorTempoB4 = Math.min(melhorTempoB4, p.temposBlocos[3]);
            }
            if (p.tempoTotal > 0) {
                if (p.tempoTotal < recordeAtual) {
                    if (recordeAtual !== Infinity) bateuRecordePessoal = true;
                    recordeAtual = p.tempoTotal;
                }
                melhorTempoTotal = Math.min(melhorTempoTotal, p.tempoTotal);
            }
            if (p.errosTropecos && p.errosTropecos.length === 0) {
                partidasPerfeitas++;
            } else if (!p.errosTropecos) {
                partidasPerfeitas++;
            }
        }
        if (p.data) {
            const d = new Date(p.data);
            diasDistintos.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
    });

    let melhorPosicaoGlobal = 0;
    if (temposObj) {
        const completos = Object.values(temposObj).filter(t => t.status === 'completo' && t.tempoTotal != null);
        completos.sort((a,b) => a.tempoTotal - b.tempoTotal);
        const idx = completos.findIndex(t => t.nome === nome && t.turma === turma);
        if (idx !== -1) melhorPosicaoGlobal = idx + 1;
    }

    let blocosCompletos = 0;
    if (partidasCompletas > 0) blocosCompletos = 4;
    else if (totalPartidas > 0) {
        const ultima = partidas[partidas.length - 1];
        blocosCompletos = ultima.blocosCompletos || 0;
    }

    return {
        totalPartidas, partidasCompletas, partidasPerfeitas, blocosCompletos, diasDistintos: diasDistintos.size,
        melhorTempoB1: melhorTempoB1 === Infinity ? 0 : melhorTempoB1,
        melhorTempoB2: melhorTempoB2 === Infinity ? 0 : melhorTempoB2,
        melhorTempoB3: melhorTempoB3 === Infinity ? 0 : melhorTempoB3,
        melhorTempoB4: melhorTempoB4 === Infinity ? 0 : melhorTempoB4,
        melhorTempoTotal: melhorTempoTotal === Infinity ? 0 : melhorTempoTotal,
        melhorPosicaoGlobal, bateuRecordePessoal
    };
}

async function _verificarNovasMedalhas(app, eventoId, chaveAluno) {
    try {
        const nome = app.obterNomeAluno();
        const turma = app.obterTurmaAluno();
        
        const snapMedals = await app.database.ref(`copa_maratona/eventos/${eventoId}/medalhas/${chaveAluno}`).once('value');
        const medalhasSalvas = snapMedals.val() || {};
        
        const snapHist = await app.database.ref(`copa_maratona/eventos/${eventoId}/historico/${chaveAluno}`).once('value');
        const hist = snapHist.val() || {};
        
        const snapTempos = await app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value');
        const tempos = snapTempos.val() || {};

        const dados = _compilarDadosAlbum(hist, tempos, nome, turma);
        
        const novas = [];
        MEDALHAS_MARATONA.forEach(m => {
            if (!medalhasSalvas[m.id] && m.condicao(dados)) {
                novas.push(m.id);
            }
        });

        if (novas.length > 0) {
            const updates = {};
            const agora = new Date().toISOString();
            novas.forEach(id => {
                updates[`copa_maratona/eventos/${eventoId}/medalhas/${chaveAluno}/${id}`] = { data: agora };
            });
            await app.database.ref().update(updates);
            _mostrarPopupNovasMedalhas(novas);
        }
    } catch (e) {
        console.warn("[Álbum Maratona] Erro ao verificar medalhas:", e);
    }
}

function _mostrarPopupNovasMedalhas(ids) {
    const medalhas = ids.map(id => MEDALHAS_MARATONA.find(m => m.id === id)).filter(Boolean);
    if (!medalhas.length) return;

    const overlay = document.createElement("div");
    overlay.className = "maratona-modal-compare";
    overlay.style.zIndex = "999999";

    let html = `
        <div class="maratona-modal-card" style="max-width: 400px; text-align: center;">
            <div class="maratona-modal-header"><h3>🎉 NOVA MEDALHA!</h3></div>
            <div class="maratona-modal-body" style="padding: 24px 20px;">
    `;

    medalhas.forEach(m => {
        html += `
            <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                <span style="font-size: 36px;">${m.icone}</span>
                <div style="text-align: left;">
                    <div style="font-size: 16px; font-weight: 900; color: #fff;">${m.nome}</div>
                    <div style="font-size: 12px; color: #94a3b8;">${m.requisito}</div>
                </div>
            </div>
        `;
    });

    html += `
            <button type="button" class="maratona-btn-comecar" onclick="this.closest('.maratona-modal-compare').remove()" style="margin-top: 10px;">Ver no Álbum 🚀</button>
            </div>
        </div>
    `;

    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    try {
        if (window.maratonaDispararFogos) window.maratonaDispararFogos(3);
        if (window.copaApp && typeof window.copaApp.somNovoRecorde === 'function') window.copaApp.somNovoRecorde();
    } catch(e) {}
}

window.abrirAlbumMaratonaModal = async function() {
    const app = window.copaApp;
    if (!app || !app.database) return;
    
    const nome = app.obterNomeAluno();
    const turma = app.obterTurmaAluno();
    if (!nome || !turma) { app.notificar("Identifique-se para ver o álbum.", "aviso"); return; }
    const chaveAluno = app.chaveAluno(nome, turma);

    const snapEv = await app.database.ref('copa_maratona/eventos').once('value');
    const eventos = snapEv.val() || {};
    let eventoId = null;
    for (const [id, dados] of Object.entries(eventos)) {
        if (dados && dados.meta && dados.meta.ativo === true) { eventoId = id; break; }
    }
    if (!eventoId) { app.notificar("Nenhum evento de maratona ativo.", "aviso"); return; }

    const [snapMedals, snapHist, snapTempos] = await Promise.all([
        app.database.ref(`copa_maratona/eventos/${eventoId}/medalhas/${chaveAluno}`).once('value'),
        app.database.ref(`copa_maratona/eventos/${eventoId}/historico/${chaveAluno}`).once('value'),
        app.database.ref(`copa_maratona/eventos/${eventoId}/tempos`).once('value')
    ]);

    const medalhasSalvas = snapMedals.val() || {};
    const hist = snapHist.val() || {};
    const tempos = snapTempos.val() || {};
    
    const dados = _compilarDadosAlbum(hist, tempos, nome, turma);

    const overlay = document.createElement("div");
    overlay.className = "maratona-album-overlay";
    
    let html = `
        <div class="maratona-album-modal">
            <div class="maratona-album-header">
                <h3>📖 Álbum da Maratona</h3>
                <button class="maratona-album-close" onclick="this.closest('.maratona-album-overlay').remove()">×</button>
            </div>
            <div class="maratona-album-body">
    `;

    SECOES_MARATONA.forEach(sec => {
        const meds = MEDALHAS_MARATONA.filter(m => m.secao === sec.id);
        const coladas = meds.filter(m => medalhasSalvas[m.id]).length;
        
        html += `
            <div class="album-secao" style="margin-bottom: 24px; border-radius: 12px; padding: 16px; background: rgba(10, 22, 40, 0.6); border: 1px solid rgba(56, 189, 248, 0.2);">
                <div class="album-secao-linha1" style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <span class="album-secao-icone" style="font-size: 24px;">${sec.icone}</span>
                    <span class="album-secao-nome" style="font-size: 15px; font-weight: 900; color: var(--neon-cyan, #22d3ee); text-transform: uppercase;">${sec.nome}</span>
                    <span class="album-secao-prog-num" style="margin-left:auto; font-size: 12px; font-weight: 800; color: #94a3b8;">${coladas}/${meds.length}</span>
                </div>
                <div class="album-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px;">
        `;
        
        meds.forEach(m => {
            const colada = !!medalhasSalvas[m.id];
            const rar = RARIDADES_MARATONA[m.raridade];
            const cls = colada ? `colada ${m.raridade}` : '';
            
            html += `
                <div class="album-figurinha ${cls}" style="cursor: pointer; position: relative; padding: 14px 10px; border-radius: 12px; border: 2px solid ${colada ? '#10b981' : '#334155'}; background: ${colada ? 'linear-gradient(160deg, #064e3b 0%, #022c22 100%)' : 'linear-gradient(160deg, #1e293b 0%, #0f172a 100%)'}; text-align: center;" onclick="alert('${m.requisito}')">
                    <span style="position: absolute; top: 6px; right: 6px; font-size: 10px; opacity: 0.8;">${rar.emoji}</span>
                    <span style="font-size: 32px; display: block; margin-bottom: 8px; filter: ${colada ? 'none' : 'grayscale(1) opacity(0.3)'};">${colada ? m.icone : '❓'}</span>
                    <span style="font-size: 12px; font-weight: 800; color: ${colada ? '#fff' : '#cbd5e1'}; display: block; margin-bottom: 4px;">${colada ? m.nome : 'Bloqueada'}</span>
                    <span style="font-size: 10.5px; font-weight: 700; color: ${colada ? '#6ee7b7' : '#94a3b8'};">${colada ? '✅ Conquistada' : '🔒 ' + m.requisito}</span>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    html += `</div></div>`;
    overlay.innerHTML = html;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
};

// ▲▲▲ FIM [M.31]

// ▼▼▼ [M.32] Mapa de Tabuadas da Maratona ────────────────── INÍCIO ───

const MAPA_JANELA_AVALIACAO_MARATONA = 10;
const LIMIAR_DOMINIO_MARATONA = 0.90;
const LIMIAR_QUASE_MARATONA = 0.80;
const LIMIAR_DESENV_MARATONA = 0.60;

function _statsDaOperacaoMaratona(historico) {
    const lista = (historico || []).slice(-MAPA_JANELA_AVALIACAO_MARATONA);
    const tentativas = lista.length;
    if (tentativas === 0) return { tentativas: 0, acertos: 0, taxa: 0 };
    const acertos = lista.filter(r => r.acertou).length;
    return { tentativas, acertos, taxa: acertos / tentativas };
}

function _estadoDaOperacaoMaratona(historico, minTent = 5) {
    const s = _statsDaOperacaoMaratona(historico);
    if (s.tentativas === 0) return "cinza";
    if (s.taxa < LIMIAR_DESENV_MARATONA) return "vermelho";
    if (s.taxa < LIMIAR_QUASE_MARATONA) return "amarelo";
    if (s.taxa < LIMIAR_DOMINIO_MARATONA) return "azul";
    if (s.tentativas >= minTent) return "verde";
    return "cinza-parcial";
}

window.abrirMapaMaratonaModal = async function() {
    const app = window.copaApp;
    if (!app || !app.database) return;
    
    const nome = app.obterNomeAluno();
    const turma = app.obterTurmaAluno();
    if (!nome || !turma) { app.notificar("Identifique-se para ver o mapa.", "aviso"); return; }
    const chaveAluno = app.chaveAluno(nome, turma);

    const snapEv = await app.database.ref('copa_maratona/eventos').once('value');
    const eventos = snapEv.val() || {};
    let eventoId = null;
    for (const [id, dados] of Object.entries(eventos)) {
        if (dados && dados.meta && dados.meta.ativo === true) { eventoId = id; break; }
    }
    if (!eventoId) { app.notificar("Nenhum evento ativo.", "aviso"); return; }

    app.notificar("⏳ Carregando mapa...", "info");
    const snapMapa = await app.database.ref(`copa_maratona/eventos/${eventoId}/mapas/${chaveAluno}`).once('value');
    const mapaDados = snapMapa.val() || {};

    const overlay = document.createElement("div");
    overlay.className = "maratona-mapa-overlay";
    
    let html = `
        <div class="maratona-mapa-modal">
            <div class="maratona-mapa-header">
                <h3>🗺️ Mapa de Tabuadas (Maratona)</h3>
                <button class="maratona-mapa-close" onclick="this.closest('.maratona-mapa-overlay').remove()">×</button>
            </div>
            <div class="maratona-mapa-body">
                <p style="font-size:13px; color:#cbd5e1; margin-bottom:16px; line-height:1.5;">
                    Como a Maratona foca nos fatores <strong>2, 3, 4 e 5</strong>, apenas as linhas correspondentes serão preenchidas aqui. As demais operações ficam disponíveis nos treinos normais do app.
                </p>
                <div class="maratona-mapa-grid-wrapper">
                    <table class="maratona-mapa-grid">
                        <thead><tr><th></th>`;
    for (let b = 1; b <= 10; b++) html += `<th>${b}</th>`;
    html += `</tr></thead><tbody>`;

    for (let a = 1; a <= 10; a++) {
        html += `<tr><th>${a}</th>`;
        for (let b = 1; b <= 10; b++) {
            const k = `${a}x${b}`;
            const hist = mapaDados[k] ? mapaDados[k].historico : [];
            const est = _estadoDaOperacaoMaratona(hist);
            const s = _statsDaOperacaoMaratona(hist);
            const tentTxt = s.tentativas > 0 ? `<span style="position:absolute;bottom:2px;right:4px;font-size:9px;opacity:0.7;">${s.tentativas}</span>` : "";
            
            html += `<td class="maratona-mapa-celula ${est}" style="position:relative; cursor:help;" title="${a}x${b} · ${s.acertos}/${s.tentativas} acertos">
                ${a}x${b} ${tentTxt}
            </td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>
        <div class="maratona-mapa-legenda">
            <div class="item"><span class="cor" style="background:#22c55e;"></span> Dominada</div>
            <div class="item"><span class="cor" style="background:#e2e8f0; border:2px dashed #0ea5e9;"></span> A confirmar</div>
            <div class="item"><span class="cor" style="background:#38bdf8;"></span> Quase lá</div>
            <div class="item"><span class="cor" style="background:#facc15;"></span> Em treino</div>
            <div class="item"><span class="cor" style="background:#ef4444;"></span> Preciso reforçar</div>
            <div class="item"><span class="cor" style="background:#334155;"></span> Sem prática</div>
        </div>
    </div></div>`;

    overlay.innerHTML = html;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
};

// ▲▲▲ FIM [M.32]
