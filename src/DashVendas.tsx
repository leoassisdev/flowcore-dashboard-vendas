// DashVendas · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
// Painel de vendas: menu lateral, 4 KPIs com sparkline, gráfico de receita com
// mira e tooltip, ranking de produtos e seletor de período (7d / 30d / 12m).
// Pra usar dados reais, troque o array DADOS pela resposta da sua API.
// Props: accent (cor de destaque), dados (blocos por período), tema ("claro" |
// "escuro", padrão "claro") e onTemaChange (avisa quando o botão sol/lua troca).
// Requisitos: React 18+ e Tailwind CSS 3+. Zero dependências.

import { useId, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";

type Tema = "claro" | "escuro";
type Periodo = "7d" | "30d" | "12m";
type Ponto = { rotulo: string; valor: number };
type Produto = { nome: string; categoria: string; pedidos: number; receita: number; variacao: number };
type Kpi = { label: string; valor: string; delta: number; serie: number[] };
type Bloco = { titulo: string; serie: Ponto[]; kpis: Kpi[]; produtos: Produto[] };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (v: number) => v.toLocaleString("pt-BR");
const curto = (v: number) => (v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace(".", ",")} mi` : `R$ ${Math.round(v / 1000)} mil`);

// Paleta de cada tema, aplicada como CSS vars na raiz (não depende do dark: do Tailwind).
const TEMAS: Record<Tema, Record<string, string>> = {
  claro: {
    "--fc-bg": "#F7F8FB", "--fc-surface": "#FFFFFF", "--fc-surface-2": "#F1F4F9",
    "--fc-border": "#E3E8F0", "--fc-border-strong": "#CBD3E1",
    "--fc-text": "#0B1220", "--fc-muted": "#4B5565", "--fc-subtle": "#8A94A6",
    "--fc-pos": "#059669", "--fc-neg": "#E11D48", "--fc-warn": "#D97706",
    "--fc-shadow": "0 1px 2px rgba(16,24,40,.06), 0 12px 32px -16px rgba(16,24,40,.18)",
    "--fc-pop": "#FFFFFF", "--fc-grid": "#EDF0F5",
  },
  escuro: {
    "--fc-bg": "#0B0F17", "--fc-surface": "rgba(255,255,255,0.03)", "--fc-surface-2": "rgba(255,255,255,0.06)",
    "--fc-border": "rgba(255,255,255,0.10)", "--fc-border-strong": "rgba(255,255,255,0.25)",
    "--fc-text": "#FFFFFF", "--fc-muted": "rgba(255,255,255,0.60)", "--fc-subtle": "rgba(255,255,255,0.40)",
    "--fc-pos": "#34D399", "--fc-neg": "#FB7185", "--fc-warn": "#FBBF24",
    "--fc-shadow": "0 24px 48px -24px rgba(0,0,0,.6)",
    "--fc-pop": "#111827", "--fc-grid": "rgba(255,255,255,0.06)",
  },
};
const PALETA = ["var(--accent)", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#06B6D4"];
const tinta = (cor: string, pct: number) => `color-mix(in srgb, ${cor} ${pct}%, transparent)`;

// Tema controlado pela prop, mas o botão sol/lua troca por dentro.
function useTema(inicial: Tema, onTemaChange?: (t: Tema) => void) {
  const [tema, setTema] = useState<Tema>(inicial);
  const [prop, setProp] = useState<Tema>(inicial);
  if (prop !== inicial) {
    setProp(inicial);
    setTema(inicial);
  }
  const alternar = () => {
    const novo: Tema = tema === "claro" ? "escuro" : "claro";
    setTema(novo);
    onTemaChange?.(novo);
  };
  return [tema, alternar] as const;
}

function BotaoTema({ tema, onClick }: { tema: Tema; onClick: () => void }) {
  const escuro = tema === "escuro";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] text-[var(--fc-muted)] transition-colors hover:bg-[var(--fc-surface-2)] hover:text-[var(--fc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {escuro ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}

// Gerador pseudoaleatório com semente: mesma saída no servidor e no navegador.
function gerador(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function montar(titulo: string, n: number, base: number, seed: number, rotulo: (i: number) => string, fator: number): Bloco {
  const r = gerador(seed);
  const serie = Array.from({ length: n }, (_, i) => ({ rotulo: rotulo(i), valor: Math.round(base * (1 + (0.35 * i) / n) * (0.82 + r() * 0.36)) }));
  const receita = serie.reduce((s, p) => s + p.valor, 0);
  const ticket = 1840 + Math.round(r() * 260);
  const pedidos = Math.round(receita / ticket);
  const vals = serie.map((p) => p.valor);
  const prods: Produto[] = [
    ["Plano Enterprise anual", "Assinatura", 0.31],
    ["Implantação ERP", "Serviço", 0.22],
    ["Módulo Fiscal NF-e", "Add-on", 0.16],
    ["Suporte Premium 24/7", "Serviço", 0.12],
    ["Integração Marketplace", "Add-on", 0.09],
  ].map(([nome, categoria, share], i) => ({
    nome: nome as string,
    categoria: categoria as string,
    receita: Math.round(receita * (share as number)),
    pedidos: Math.max(1, Math.round(pedidos * (share as number) * (1.4 - i * 0.12))),
    variacao: Math.round((r() * 34 - 8) * 10) / 10,
  }));
  return {
    titulo,
    serie,
    produtos: prods,
    kpis: [
      { label: "Receita", valor: brl(receita), delta: 12.4 * fator, serie: vals },
      { label: "Pedidos", valor: num(pedidos), delta: 8.1 * fator, serie: vals.map((v, i) => v / (ticket + i * 9)) },
      { label: "Ticket médio", valor: brl(ticket), delta: 3.6 * fator, serie: vals.map((v, i) => ticket + Math.sin(i) * 80 + v / 900) },
      { label: "Conversão", valor: `${(3.1 + fator * 0.4).toFixed(1).replace(".", ",")}%`, delta: -1.2 * fator, serie: vals.map((_, i) => 3 + Math.cos(i / 2) * 0.4 - i * 0.01) },
    ],
  };
}

const dia = (n: number) => (i: number) => {
  const d = new Date(2026, 9, 15 - (n - 1 - i));
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const DADOS: Record<Periodo, Bloco> = {
  "7d": montar("Últimos 7 dias", 7, 41_000, 7, dia(7), 0.6),
  "30d": montar("Últimos 30 dias", 30, 38_500, 30, dia(30), 1),
  "12m": montar("Últimos 12 meses", 12, 1_020_000, 12, (i) => `${MESES[(10 + i) % 12]}/${i < 2 ? 25 : 26}`, 1.8),
};

const NAV = [
  { label: "Visão geral", d: "M3 12l9-8 9 8M5 10v10h14V10" },
  { label: "Pedidos", d: "M6 7h12l-1 13H7L6 7zm3 0a3 3 0 016 0" },
  { label: "Clientes", d: "M16 19v-1a4 4 0 00-8 0v1M12 11a3 3 0 100-6 3 3 0 000 6z" },
  { label: "Produtos", d: "M4 7l8-4 8 4v10l-8 4-8-4V7zm0 0l8 4 8-4M12 11v10" },
  { label: "Relatórios", d: "M5 20V10m7 10V4m7 16v-7" },
];

const ICONES_KPI = [
  "M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H6",
  "M6 7h12l-1 13H7L6 7zm3 0a3 3 0 016 0",
  "M3 7h18v10H3zM7 12h.01M17 12h.01M12 14a2 2 0 100-4 2 2 0 000 4z",
  "M4 4h16l-6 8v6l-4 2v-8L4 4z",
];

function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  const id = useId().replace(/:/g, "");
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 26}`);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: cor, stopOpacity: 0.22 }} />
          <stop offset="100%" style={{ stopColor: cor, stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`M${pts.join(" L")} L100,30 L0,30 Z`} fill={`url(#s${id})`} />
      <polyline points={pts.join(" ")} fill="none" strokeWidth="1.6" vectorEffect="non-scaling-stroke" style={{ stroke: cor }} />
    </svg>
  );
}

function GraficoReceita({ pontos }: { pontos: Ponto[] }) {
  const id = useId().replace(/:/g, "");
  const [ativo, setAtivo] = useState<number | null>(null);
  const W = 1000;
  const H = 300;
  const max = Math.max(...pontos.map((p) => p.valor)) * 1.12;
  const x = (i: number) => (i / (pontos.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const passo = Math.ceil(pontos.length / 7);

  const mover = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    setAtivo(Math.max(0, Math.min(pontos.length - 1, Math.round(rel * (pontos.length - 1)))));
  };
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const atual = ativo ?? (e.key === "ArrowRight" ? -1 : pontos.length);
    setAtivo(Math.max(0, Math.min(pontos.length - 1, atual + (e.key === "ArrowRight" ? 1 : -1))));
  };
  const p = ativo !== null ? pontos[ativo] : null;
  const left = ativo !== null ? (x(ativo) / W) * 100 : 0;

  return (
    <div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between text-[10px] tabular-nums text-[var(--fc-subtle)]">
          {[1, 0.66, 0.33, 0].map((f) => (
            <span key={f}>{curto(max * f)}</span>
          ))}
        </div>
        <div
          tabIndex={0}
          onMouseMove={mover}
          onMouseLeave={() => setAtivo(null)}
          onKeyDown={teclado}
          onBlur={() => setAtivo(null)}
          className="relative ml-16 h-56 cursor-crosshair rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:h-64"
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={`Gráfico de área da receita: ${pontos.length} pontos, de ${brl(pontos[0].valor)} a ${brl(pontos[pontos.length - 1].valor)}. Use as setas para navegar.`}>
            <defs>
              <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
                <stop offset="60%" style={{ stopColor: "#7C3AED", stopOpacity: 0.08 }} />
                <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
              </linearGradient>
              <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: "var(--accent)" }} />
                <stop offset="100%" style={{ stopColor: "#7C3AED" }} />
              </linearGradient>
            </defs>
            {[0.33, 0.66, 1].map((f) => (
              <line key={f} x1="0" x2={W} y1={H - f * H + 1} y2={H - f * H + 1} vectorEffect="non-scaling-stroke" style={{ stroke: "var(--fc-grid)" }} />
            ))}
            <path d={`${linha} L${W},${H} L0,${H} Z`} fill={`url(#g${id})`} />
            <path d={linha} fill="none" stroke={`url(#l${id})`} strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
            {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1="0" y2={H} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--fc-border-strong)" }} />}
          </svg>
          {p && (
            <>
              <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--fc-pop)] bg-[var(--accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_20%,transparent)]" style={{ left: `${left}%`, top: `${(y(p.valor) / H) * 100}%` }} />
              <div
                role="status"
                className="pointer-events-none absolute top-2 z-10 rounded-lg border border-[var(--fc-border)] bg-[var(--fc-pop)] px-3 py-2 text-xs shadow-[var(--fc-shadow)]"
                style={{ left: `${left}%`, transform: `translateX(${left > 70 ? "calc(-100% - 12px)" : "12px"})` }}
              >
                <p className="text-[var(--fc-subtle)]">{p.rotulo}</p>
                <p className="mt-0.5 font-semibold tabular-nums">{brl(p.valor)}</p>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="ml-16 mt-2 flex justify-between text-[10px] tabular-nums text-[var(--fc-subtle)]">
        {pontos.filter((_, i) => i % passo === 0).map((pt) => (
          <span key={pt.rotulo}>{pt.rotulo}</span>
        ))}
      </div>
    </div>
  );
}

const Variacao = ({ v }: { v: number }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${v >= 0 ? "text-[var(--fc-pos)]" : "text-[var(--fc-neg)]"}`}
    style={{ background: tinta(v >= 0 ? "var(--fc-pos)" : "var(--fc-neg)", 12) }}
  >
    {v >= 0 ? "▲ +" : "▼ −"}
    {Math.abs(v).toFixed(1).replace(".", ",")}%
  </span>
);

export default function DashVendas({
  accent = "#0057FF",
  dados = DADOS,
  tema = "claro",
  onTemaChange,
}: {
  accent?: string;
  dados?: Record<Periodo, Bloco>;
  tema?: Tema;
  onTemaChange?: (t: Tema) => void;
}) {
  const [modo, alternarTema] = useTema(tema, onTemaChange);
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [nav, setNav] = useState(0);
  const bloco = dados[periodo];
  const maxProduto = Math.max(...bloco.produtos.map((p) => p.receita));

  return (
    <div style={{ ...TEMAS[modo], colorScheme: modo === "claro" ? "light" : "dark", "--accent": accent } as CSSProperties} data-tema={modo} className="flex min-h-full flex-col bg-[var(--fc-bg)] text-[var(--fc-text)] lg:flex-row">
      <aside className="border-b border-[var(--fc-border)] bg-[var(--fc-surface)] lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-5 py-4 lg:py-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[linear-gradient(135deg,var(--accent),#7C3AED)] text-sm font-bold text-white shadow-[0_6px_16px_-6px_var(--accent)]">V</span>
          <span className="text-sm font-semibold tracking-tight">Vértice Comercial</span>
        </div>
        <nav aria-label="Menu do painel" className="flex flex-wrap gap-1 px-3 pb-3 lg:flex-col lg:flex-nowrap lg:pb-0">
          {NAV.map((n, i) => (
            <button
              key={n.label}
              type="button"
              onClick={() => setNav(i)}
              aria-current={nav === i ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${nav === i ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] font-medium text-[var(--fc-text)] [&>svg]:text-[var(--accent)]" : "text-[var(--fc-muted)] hover:bg-[var(--fc-surface-2)] hover:text-[var(--fc-text)]"}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={n.d} />
              </svg>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mx-3 mb-4 mt-auto hidden rounded-xl bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] px-4 py-4 text-xs text-[var(--fc-subtle)] lg:block">
          <p className="font-medium text-[var(--fc-text)]">Meta trimestral</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--fc-border)]">
            <div className="h-full w-[72%] rounded-full bg-[linear-gradient(90deg,var(--accent),#7C3AED)]" />
          </div>
          <p className="mt-1.5 tabular-nums">72% atingido</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-[var(--fc-subtle)]">{bloco.titulo}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Vendas</h1>
          </div>
          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label="Período" className="inline-flex rounded-lg border border-[var(--fc-border)] bg-[var(--fc-surface)] p-1 shadow-[var(--fc-shadow)]">
              {(["7d", "30d", "12m"] as Periodo[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={periodo === p}
                  onClick={() => setPeriodo(p)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${periodo === p ? "bg-[var(--accent)] text-white" : "text-[var(--fc-muted)] hover:text-[var(--fc-text)]"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <BotaoTema tema={modo} onClick={alternarTema} />
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {bloco.kpis.map((k, i) => {
            const cor = PALETA[i % PALETA.length];
            return (
              <article key={k.label} className="rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 shadow-[var(--fc-shadow)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-[var(--fc-muted)]">{k.label}</p>
                  <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: tinta(cor, 12), color: cor }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d={ICONES_KPI[i % ICONES_KPI.length]} />
                    </svg>
                  </span>
                </div>
                <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight" data-kpi={k.label}>
                  {k.valor}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Variacao v={k.delta} />
                  <div className="w-24">
                    <Sparkline valores={k.serie} cor={cor} />
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] p-4 shadow-[var(--fc-shadow)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Receita</h2>
            <span className="text-xs text-[var(--fc-subtle)]">passe o mouse ou use as setas</span>
          </div>
          <GraficoReceita key={periodo} pontos={bloco.serie} />
        </section>

        <section className="mt-4 rounded-2xl border border-[var(--fc-border)] bg-[var(--fc-surface)] shadow-[var(--fc-shadow)]">
          <h2 className="px-4 pt-4 text-sm font-medium sm:px-6 sm:pt-5">Produtos mais vendidos</h2>
          <ul className="mt-3 md:hidden">
            {bloco.produtos.map((p, i) => (
              <li key={p.nome} className="border-t border-[var(--fc-border)] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: PALETA[i % PALETA.length] }} />
                    <div className="min-w-0">
                      <p className="font-medium">{p.nome}</p>
                      <p className="mt-0.5 text-xs text-[var(--fc-muted)]">{p.categoria}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums">{brl(p.receita)}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums">
                  <span className="text-[var(--fc-muted)]">{num(p.pedidos)} pedidos</span>
                  <Variacao v={p.variacao} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-[var(--fc-subtle)]">
                <tr className="border-b border-[var(--fc-border)]">
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-6">Produto</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Categoria</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Pedidos</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Receita</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:pr-6">Variação</th>
                </tr>
              </thead>
              <tbody>
                {bloco.produtos.map((p, i) => {
                  const cor = PALETA[i % PALETA.length];
                  return (
                    <tr key={p.nome} className="border-b border-[var(--fc-border)] last:border-0 hover:bg-[var(--fc-surface-2)]">
                      <th scope="row" className="px-4 py-3 font-medium sm:px-6">
                        <span className="flex items-center gap-2.5">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
                          {p.nome}
                        </span>
                      </th>
                      <td className="px-4 py-3">
                        <span className="rounded-md px-2 py-0.5 text-xs font-medium" style={{ background: tinta(cor, 12), color: cor }}>
                          {p.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--fc-muted)]">{num(p.pedidos)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="flex items-center justify-end gap-3">
                          <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--fc-surface-2)] lg:block">
                            <span className="block h-full rounded-full" style={{ width: `${(p.receita / maxProduto) * 100}%`, background: cor }} />
                          </span>
                          {brl(p.receita)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right sm:pr-6">
                        <Variacao v={p.variacao} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="mt-6 flex justify-end">
          <a href="https://flowcoresolucoes.com.br/codigos" target="_blank" rel="noopener" className="text-[11px] text-[var(--fc-subtle)] transition-colors hover:text-[var(--fc-text)]">
            Criado por FlowCore Soluções LTDA
          </a>
        </footer>
      </main>
    </div>
  );
}
