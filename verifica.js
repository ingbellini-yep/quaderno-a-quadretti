// Verifiche automatiche sui contenuti: struttura degli argomenti e degli esercizi,
// correttore reale estratto da index.html, comandi LaTeX con backslash, guide allo svolgimento,
// grafici e scene del laboratorio (validati con Laboratorio.controlla di laboratorio.js).
// Uso, dalla cartella del progetto:  node verifica.js .

const fs = require("fs"), path = require("path");
const dir = process.argv[2];
global.window = {};
eval(fs.readFileSync(path.join(dir, "contenuti-matematica.js"), "utf8"));
eval(fs.readFileSync(path.join(dir, "contenuti-fisica.js"), "utf8"));
eval(fs.readFileSync(path.join(dir, "laboratorio.js"), "utf8"));
const Lab = window.Laboratorio;
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const ini = html.indexOf("function normalizza"), fin = html.indexOf("function rispostaGiusta");
(0, eval)(html.slice(ini, fin));
console.log("correttore estratto:", typeof corretta);

const tutti = [...window.CONTENUTI_MATEMATICA.map(a => ["mat", a]), ...window.CONTENUTI_FISICA.map(a => ["fis", a])];
let errori = 0;
for (const [m, a] of tutti) {
  const problemi = [];
  ["id", "titolo", "sommario", "pillole", "formule", "esempi", "risorse", "livelli"].forEach(k => { if (a[k] == null) problemi.push("manca " + k); });
  if (tutti.filter(([, b]) => b.id === a.id).length !== 1) problemi.push("id duplicato");
  a.esempi.forEach((e, i) => { if (!e.t || !Array.isArray(e.passi) || !e.r) problemi.push("esempio " + i + " incompleto"); });
  a.risorse.forEach((r, i) => { if (!/^https:\/\//.test(r.u) || !r.t || !r.f) problemi.push("risorsa " + i + " incompleta"); });
  if (a.livelli.length !== 3 || a.livelli.some(l => l.items.length !== 10)) problemi.push("non 3x10 esercizi");
  a.livelli.forEach((l, li) => l.items.forEach((it, ii) => {
    const tag = `L${li + 1}.${ii + 1}`;
    if (!it.q || !it.spieg) problemi.push(tag + ": manca q o spieg");
    if (it.tipo === "scelta") {
      if (!Array.isArray(it.opz) || it.opz.length !== 4) problemi.push(tag + ": opzioni != 4");
      if (!(Number.isInteger(it.ok) && it.ok >= 0 && it.ok < it.opz.length)) problemi.push(tag + ": ok fuori range");
      if (new Set(it.opz).size !== it.opz.length) problemi.push(tag + ": opzioni duplicate");
    } else if (it.tipo === "aperta") {
      if (!Array.isArray(it.sol) || !it.sol.length) problemi.push(tag + ": sol mancante");
      if (it.num && (typeof it.num.v !== "number" || typeof it.num.tol !== "number")) problemi.push(tag + ": num incompleto");
    } else problemi.push(tag + ": tipo sconosciuto " + it.tipo);
  }));
  // grafici e scene del laboratorio: tipi noti, intervalli validi, espressioni leggibili e definite
  let nFigure = 0;
  const figura = (spec, dove) => { nFigure++; Lab.controlla(spec).forEach(x => problemi.push(dove + ": " + x)); };
  (a.laboratorio || []).forEach((sc, i) => figura(sc, "laboratorio " + (i + 1)));
  a.esempi.forEach((e, i) => { if (e.grafico) figura(e.grafico, "esempio " + (i + 1)); });
  a.livelli.forEach((l, li) => l.items.forEach((it, ii) => { if (it.grafico) figura(it.grafico, `L${li + 1}.${ii + 1} grafico`); }));
  // un «<» seguito da una lettera viene letto dal browser come inizio di un tag HTML e il
  // resto del testo sparisce (es. $1<x<4$): va scritto con uno spazio, $1 < x < 4$
  const tagNoti = /^\/?(strong|em|b|i|u|br|sup|sub|span|code|small|p|div|ul|ol|li|a|table|tr|td|th)\b/i;
  const tagFinti = new Set();
  const cerca = (o, dove) => {
    if (typeof o === "string") { let m, re = /<(?=[A-Za-z\/])/g; while ((m = re.exec(o))) if (!tagNoti.test(o.slice(m.index + 1))) tagFinti.add(dove + " «" + o.slice(Math.max(0, m.index - 6), m.index + 6) + "»"); }
    else if (o && typeof o === "object") for (const k in o) if (k !== "sol" && k !== "k") cerca(o[k], dove + "." + k);
  };
  cerca(a, a.id);
  if (tagFinti.size) problemi.push("«<» seguito da una lettera (metti uno spazio dopo <): " + [...tagFinti].slice(0, 4).join("; "));
  // comandi LaTeX rimasti senza backslash dopo la valutazione JavaScript
  const rotti = JSON.stringify(a).match(/[^\\a-z&](cdot|dfrac|frac|mathrm|qquad|sqrt|times|text|leq|geq|neq)\b/g);
  if (rotti) problemi.push("LaTeX senza backslash: " + [...new Set(rotti.map(s => s.slice(1)))].join(","));
  // guide allo svolgimento: presenza, forma, ultimo passo coerente con la risposta
  let nGuide = 0; const senza = [], incoerenti = [];
  const testoPiano = s => String(s == null ? "" : s).replace(/<[^>]+>/g, "");
  // testo LaTeX in forma confrontabile: via comandi, graffe e dollari, così a\cdot10^{n} diventa "a10n" come nel correttore
  const pulisci = s => normalizza(testoPiano(String(s)).replace(/\{,\}/g, ",").replace(/\\(cdot|,|;|!|quad|qquad|left|right|circ|text|mathrm|tfrac|dfrac|frac|to)/g, "").replace(/[{}$]/g, "").replace(/&deg;/g, "°").replace(/&nbsp;/g, " "));
  a.livelli.forEach((l, li) => l.items.forEach((it, ii) => {
    const tag = `L${li + 1}.${ii + 1}`;
    if (!Array.isArray(it.guida) || !it.guida.length) { senza.push(tag); return; }
    nGuide++;
    if (it.guida.length < 2 || it.guida.length > 6) problemi.push(tag + ": guida con " + it.guida.length + " passi");
    it.guida.forEach((p, pi) => { if (!p.s || !p.r || !Array.isArray(p.k)) problemi.push(tag + ": passo " + (pi + 1) + " incompleto"); });
    const rUlt = it.guida[it.guida.length - 1].r, ultimo = pulisci(rUlt);
    let ok = false;
    if (it.tipo === "scelta") ok = ultimo.indexOf(pulisci(it.opz[it.ok])) >= 0;
    else if (it.num) {
      const t = testoPiano(rUlt).replace(/\{,\}/g, ",").replace(/\\,/g, "");
      const nums = (t.match(/-?\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(",", ".")));
      // valori scritti in notazione scientifica: a\cdot10^{n} e 10^{n}
      let m, reS = /(-?\d+(?:[.,]\d+)?)\\cdot10\^\{?(-?\d+)\}?/g, reP = /(?:^|[^\d])10\^\{?(-?\d+)\}?/g;
      while ((m = reS.exec(t))) nums.push(parseFloat(m[1].replace(",", ".")) * Math.pow(10, parseInt(m[2], 10)));
      while ((m = reP.exec(t))) nums.push(Math.pow(10, parseInt(m[1], 10)));
      ok = nums.some(n => Math.abs(n - it.num.v) <= Math.max(it.num.tol || 0, 1e-9));
    } else ok = it.sol.some(s => ultimo.indexOf(pulisci(s)) >= 0);
    if (!ok) incoerenti.push(tag);
  }));
  if (senza.length) problemi.push("senza guida: " + senza.join(","));
  if (incoerenti.length) console.log("     ATTENZIONE " + a.id + ": ultimo passo senza la risposta in " + incoerenti.join(", "));
  // correttore
  const fallimenti = []; let nTest = 0;
  a.livelli.forEach((l, li) => l.items.forEach((it, ii) => {
    const tag = `L${li + 1}.${ii + 1}`;
    const t = (risp, atteso, desc) => { nTest++; if (corretta(it, risp) !== atteso) fallimenti.push(`${tag} ${desc} "${risp}"`); };
    t("", false, "vuota"); t("   ", false, "spazi"); t(null, false, "null");
    if (it.tipo === "scelta") { for (let k = 0; k < it.opz.length; k++) t(String(k), k === it.ok, "opzione"); }
    else {
      it.sol.forEach(s => t(s, true, "variante rifiutata"));
      if (it.num) {
        const v = it.num.v, u = it.num.u || "";
        t(String(v), true, "valore"); t(String(v).replace(".", ","), true, "virgola"); t(v + " " + u, true, "con unità");
        t(String(v * 10 + 7), false, "sbagliata accettata"); t(String(v + it.num.tol * 3 + 0.5), false, "fuori tolleranza accettata");
      } else t(it.sol[0] + "zz", false, "sporca accettata");
    }
  }));
  const riga = `${m} ${a.id}: pillole ${a.pillole.length}, esempi ${a.esempi.length}, risorse ${a.risorse.length}, esercizi ${a.livelli.map(l => l.items.length).join("/")}, ${nFigure ? "figure " + nFigure + ", " : ""}test correttore ${nTest} (falliti ${fallimenti.length})`;
  console.log((problemi.length || fallimenti.length ? "ERR " : "OK  ") + riga);
  if (problemi.length) console.log("     " + problemi.join("; "));
  if (fallimenti.length) console.log("     " + fallimenti.slice(0, 10).join("; "));
  errori += problemi.length + fallimenti.length;
}
// barra dei simboli (simboli.js): quello che scrivono i tasti deve valere quanto la forma
// scritta a mano, per il correttore e per il lettore di espressioni del laboratorio
{
  const uguali = [["x²", "x^2", "x2", "x^(2)"], ["x³", "x^3", "x^(3)"], ["x⁴", "x^4"], ["aⁿ", "a^n", "a^(n)"],
    ["√(2)", "√2", "sqrt(2)", "radq(2)"], ["∛(8)", "³√8", "cbrt(8)", "³√(8)"], ["⁴√(x)", "⁴√x"],
    ["(1)/(2)", "1/2"], ["(x+1)/(2)", "(x+1)/2"], ["x≥-4", "x>=-4", "x ≥ −4"], ["x≤2", "x<=2"], ["2√(3)", "2√3", "2·√3"]];
  const diversi = [["x²", "x³"], ["√2", "∛2"], ["1/2", "2/1"], ["x>4", "x≥4"], ["(x+1)/2", "x+1/2"]];
  const errS = [];
  uguali.forEach(g => g.forEach(f => { if (normalizza(f) !== normalizza(g[0])) errS.push(`«${f}» ≠ «${g[0]}»`); }));
  diversi.forEach(([p, q]) => { if (normalizza(p) === normalizza(q)) errS.push(`«${p}» = «${q}»`); });
  const calcoli = [["√(16)", 4], ["√16", 4], ["∛(-8)", -2], ["⁴√(16)", 2], ["x²+x³", 12], ["x⁴", 16], ["(1)/(2)", 0.5], ["2⁻¹", 0.5]];
  calcoli.forEach(([e, atteso]) => { try { const y = Lab.compila(e, ["x"]).f({ x: 2 }); if (Math.abs(y - atteso) > 1e-9) errS.push(`«${e}» vale ${y}, non ${atteso}`); } catch (x) { errS.push(`«${e}»: ${x.message}`); } });
  eval(fs.readFileSync(path.join(dir, "simboli.js"), "utf8"));
  const Sb = window.Simboli;
  if (!Sb || !Sb.gruppi().some(g => g.id === "potenze") || Sb.apice("4") !== "⁴") errS.push("simboli.js non caricato o incompleto");
  console.log((errS.length ? "ERR " : "OK  ") + `barra dei simboli: ${uguali.flat().length} forme equivalenti, ${diversi.length} coppie distinte, ${calcoli.length} calcoli`);
  if (errS.length) { console.log("     " + errS.join("; ")); errori += errS.length; }
}
// stabilità degli id: i progressi in localStorage sono indicizzati per id di argomento,
// quindi un id presente nell'ultimo commit non deve sparire né cambiare
try {
  const { execSync } = require("child_process");
  const idsOra = new Set(tutti.map(([, a]) => a.id));
  for (const f of ["contenuti-matematica.js", "contenuti-fisica.js"]) {
    const prima = execSync(`git show HEAD:${f}`, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const idsPrima = [...prima.matchAll(/^\s*id: "([^"]+)"/gm)].map(x => x[1]);
    const spariti = idsPrima.filter(id => !idsOra.has(id));
    if (spariti.length) { console.log(`ERR ${f}: id presenti nell'ultimo commit ma non più nel file (i progressi salvati andrebbero persi): ${spariti.join(", ")}`); errori += spariti.length; }
    else console.log(`OK  ${f}: tutti gli id dell'ultimo commit sono ancora presenti (${idsPrima.length})`);
  }
} catch (e) { console.log("(controllo degli id rispetto all'ultimo commit saltato: " + String(e.message).split("\n")[0] + ")"); }
console.log(errori ? `\nERRORI: ${errori}` : "\nTutto a posto.");
process.exit(errori ? 1 : 0);
