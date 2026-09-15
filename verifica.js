// Verifiche automatiche sui contenuti: struttura degli argomenti e degli esercizi,
// correttore reale estratto da index.html, comandi LaTeX con backslash, guide allo svolgimento.
// Uso, dalla cartella del progetto:  node verifica.js .

const fs = require("fs"), path = require("path");
const dir = process.argv[2];
global.window = {};
eval(fs.readFileSync(path.join(dir, "contenuti-matematica.js"), "utf8"));
eval(fs.readFileSync(path.join(dir, "contenuti-fisica.js"), "utf8"));
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
  const riga = `${m} ${a.id}: pillole ${a.pillole.length}, esempi ${a.esempi.length}, risorse ${a.risorse.length}, esercizi ${a.livelli.map(l => l.items.length).join("/")}, test correttore ${nTest} (falliti ${fallimenti.length})`;
  console.log((problemi.length || fallimenti.length ? "ERR " : "OK  ") + riga);
  if (problemi.length) console.log("     " + problemi.join("; "));
  if (fallimenti.length) console.log("     " + fallimenti.slice(0, 10).join("; "));
  errori += problemi.length + fallimenti.length;
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
