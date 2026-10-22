/* =====================================================================
   QUADERNO A QUADRETTI — GENERATORE DI ESERCIZI SIMILI
   ---------------------------------------------------------------------
   Dato uno o più esercizi (stesso formato dei file dei contenuti, oppure
   testo semplice, un esercizio per riga) il generatore produce esercizi
   nuovi della stessa forma, con la risposta calcolata dal motore.

   COME FUNZIONA
   1. Riconoscimento. L'esercizio viene riletto: si estrae l'espressione
      (LaTeX fra $...$ oppure testo semplice), si capisce il compito
      (risolvere, sviluppare, scomporre, dividere, calcolare un valore,
      un problema con unità di misura...) e se ne ricalcola la risposta.
      L'esercizio è RICONOSCIUTO solo se la risposta calcolata coincide con
      quella dichiarata: così un'interpretazione sbagliata non passa.
   2. Generazione. I numeri dell'espressione (non gli esponenti) vengono
      sostituiti con altri di grandezza simile; un candidato è accettato
      solo se ha la stessa «firma» dell'originale (per esempio: stesso tipo
      di insieme soluzione, stesso caso del discriminante, zeri interi se lo
      erano, stesso numero di termini nel risultato). Per scomposizioni e
      divisioni esatte i polinomi si costruiscono a partire dagli zeri.
   3. Esercizio nuovo: testo con i numeri nuovi, risposta (con le varianti
      di scrittura accettate dal correttore, oppure valore numerico, oppure
      quattro opzioni con i distrattori tipici), spiegazione e guida allo
      svolgimento {s, r, k}, figura rigenerata se l'originale ne aveva una.

   FAMIGLIE RICONOSCIUTE
     risolvi     equazioni e disequazioni (intere, fratte, prodotti di fattori,
                 sistemi), con le domande numeriche sull'insieme soluzione
                 (quanti interi, il più piccolo intero, la soluzione maggiore...)
     esistenza   condizione di esistenza di una frazione
     delta       discriminante di un trinomio
     sviluppa    calcolo letterale: somme, prodotti, potenze, prodotti notevoli,
                 divisione per un monomio (anche con più lettere)
     scomponi    scomposizione in fattori di un polinomio in una lettera
     dividi      quoziente e resto di una divisione fra polinomi
     valuta      valore numerico di un'espressione, f(2), legge oraria in t=...
     problema    problemi numerici con unità di misura o angoli: il motore cerca
                 la formula (prodotto di potenze dei dati, oppure somma con 90,
                 180, 360 per gli angoli), controlla le dimensioni e varia i dati
     modello     esercizio con il campo «modello» scritto dall'insegnante (o
                 proposto da Claude su claude.ai): parametri, vincoli, risposta

   CAMPO «modello» DI UN ESERCIZIO (facoltativo, risposta numerica)
     modello:{
       testo:"Un'auto viaggia a {v} km/h per {t} ore. Quanti km percorre?",
       parametri:{ v:{min:40, max:120, passo:5}, t:{valori:[1, 1.5, 2, 3]} },
       vincoli:["v*t <= 400"],                 facoltativo
       risposta:"v*t", unita:"km", decimali:1,  tolleranza facoltativa
       spiegazione:"Spazio = velocità per tempo: {v}·{t} = {risposta} km.",
       guida:[{s:"Scrivi la relazione fra spazio, velocità e tempo.", r:"s = v·t", k:["v"]},
              {s:"Sostituisci i dati e calcola.", r:"s = {v}·{t} = {risposta} km", k:["{risposta}"]}]
     }
     Nel testo, nella spiegazione e nella guida {nome} è il valore di un
     parametro, {risposta} il risultato e {=espressione} un valore calcolato.

   API: Generatore.configura({corretta, normalizza}) (dal correttore di
   index.html), Generatore.riconosci(item), Generatore.simili(items,
   {quanti, livelli, seme, difficolta}), Generatore.leggiTesto(testo),
   Generatore.famiglie(). Nessuna libreria esterna, nessun eval.
   ===================================================================== */

(function(){
"use strict";

/* ================= 0. frazioni esatte (BigInt) ================= */
function mcdB(a, b){ if(a < 0n) a = -a; if(b < 0n) b = -b; while(b){ var t = a % b; a = b; b = t; } return a; }
function mcmB(a, b){ return a === 0n || b === 0n ? 0n : (a < 0n ? -a : a) / mcdB(a, b) * (b < 0n ? -b : b); }
function Q(n, d){
  n = BigInt(n); d = d === undefined ? 1n : BigInt(d);
  if(d === 0n) throw errore("divisione per zero");
  if(d < 0n){ n = -n; d = -d; }
  var g = mcdB(n, d); if(g > 1n){ n /= g; d /= g; }
  return {n:n, d:d};
}
var Q0 = Q(0), Q1 = Q(1);
function qAdd(a, b){ return Q(a.n*b.d + b.n*a.d, a.d*b.d); }
function qSub(a, b){ return Q(a.n*b.d - b.n*a.d, a.d*b.d); }
function qMul(a, b){ return Q(a.n*b.n, a.d*b.d); }
function qDiv(a, b){ if(b.n === 0n) throw errore("divisione per zero"); return Q(a.n*b.d, a.d*b.n); }
function qNeg(a){ return {n:-a.n, d:a.d}; }
function qAbs(a){ return a.n < 0n ? qNeg(a) : a; }
function qZero(a){ return a.n === 0n; }
function qEq(a, b){ return a.n === b.n && a.d === b.d; }
function qCmp(a, b){ var x = a.n*b.d - b.n*a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
function qNum(a){ return Number(a.n) / Number(a.d); }
function qIntero(a){ return a.d === 1n; }
function qPow(a, e){ var r = Q1; for(var i=0; i<e; i++) r = qMul(r, a); return r; }
function qDaDecimale(s){
  var m = /^(\d+)(?:[.,](\d+))?$/.exec(String(s));
  if(!m) throw errore("numero non valido: "+s);
  var dec = m[2] || "";
  return Q(BigInt(m[1]+dec), 10n ** BigInt(dec.length));
}
function errore(msg){ var e = new Error(msg); e.generatore = true; return e; }

/* ================= 1. polinomi a più lettere, coefficienti razionali =================
   Un polinomio è un oggetto {chiave del monomio: frazione}; la chiave elenca le lettere in
   ordine alfabetico con il loro esponente ("a:2,b:1"), "" è il termine noto. */
function chiaveDi(m){ return Object.keys(m).filter(function(v){ return m[v] > 0; }).sort().map(function(v){ return v+":"+m[v]; }).join(","); }
function monoDi(k){ var m = {}; if(k) k.split(",").forEach(function(p){ var q = p.split(":"); m[q[0]] = +q[1]; }); return m; }
function pCost(q){ var p = {}; if(!qZero(q)) p[""] = q; return p; }
function pVar(v){ var p = {}; p[v+":1"] = Q1; return p; }
function pAdd(a, b){
  var r = {}, k;
  for(k in a) r[k] = a[k];
  for(k in b){ var s = r[k] ? qAdd(r[k], b[k]) : b[k]; if(qZero(s)) delete r[k]; else r[k] = s; }
  return r;
}
function pScala(p, q){ var r = {}; if(qZero(q)) return r; for(var k in p) r[k] = qMul(p[k], q); return r; }
function pNeg(p){ return pScala(p, Q(-1)); }
function pSub(a, b){ return pAdd(a, pNeg(b)); }
function pMul(a, b){
  var r = {};
  for(var ka in a) for(var kb in b){
    var ma = monoDi(ka), mb = monoDi(kb), m = {}, v;
    for(v in ma) m[v] = (m[v]||0) + ma[v];
    for(v in mb) m[v] = (m[v]||0) + mb[v];
    var k = chiaveDi(m), c = qMul(a[ka], b[kb]);
    var s = r[k] ? qAdd(r[k], c) : c;
    if(qZero(s)) delete r[k]; else r[k] = s;
  }
  return r;
}
function pPow(p, e){ var r = pCost(Q1); for(var i=0; i<e; i++) r = pMul(r, p); return r; }
function pNullo(p){ return Object.keys(p).length === 0; }
function pUguali(a, b){ return pNullo(pSub(a, b)); }
function pLettere(p){ var s = {}; for(var k in p) for(var v in monoDi(k)) s[v] = true; return Object.keys(s).sort(); }
function pCostante(p){ var ks = Object.keys(p); if(!ks.length) return Q0; return ks.length === 1 && ks[0] === "" ? p[""] : null; }
function pGradoTot(p){ var g = -1; for(var k in p){ var m = monoDi(k), s = 0; for(var v in m) s += m[v]; if(s > g) g = s; } return g; }
function pTermini(p){ return Object.keys(p).length; }
/* coefficienti in una lettera, dal grado massimo al termine noto */
function pUni(p, v){
  var g = 0, k;
  for(k in p){ var m = monoDi(k); for(var w in m) if(w !== v) throw errore("compare anche la lettera "+w); if((m[v]||0) > g) g = m[v]||0; }
  var c = []; for(var i=0; i<=g; i++) c.push(Q0);
  for(k in p){ var e = monoDi(k)[v]||0; c[g-e] = p[k]; }
  return c;
}
function pDaUni(c, v){
  var p = {}, n = c.length-1;
  c.forEach(function(q, i){ if(!qZero(q)){ var m = {}; if(n-i > 0) m[v] = n-i; p[chiaveDi(m)] = q; } });
  return p;
}
function pValuta(p, val){
  var s = 0;
  for(var k in p){ var m = monoDi(k), t = qNum(p[k]); for(var v in m) t *= Math.pow(val[v], m[v]); s += t; }
  return s;
}
function pValutaEsatto(p, val){
  var s = Q0;
  for(var k in p){ var m = monoDi(k), t = p[k]; for(var v in m) t = qMul(t, qPow(val[v], m[v])); s = qAdd(s, t); }
  return s;
}
/* divisione per un monomio (esatta, altrimenti null) */
function pDivMono(p, k0, c0){
  var m0 = monoDi(k0), r = {};
  for(var k in p){
    var m = monoDi(k), q = {};
    for(var v in m) q[v] = m[v];
    for(var w in m0){ q[w] = (q[w]||0) - m0[w]; if(q[w] < 0) return null; }
    r[chiaveDi(q)] = qDiv(p[k], c0);
  }
  return r;
}

/* ================= 2. funzioni razionali {n, d} ================= */
function R(n, d){ return normR({n:n, d:d || pCost(Q1)}); }
function normR(r){
  if(pNullo(r.d)) throw errore("divisione per zero");
  var c = pCostante(r.d);
  if(c) return {n:pScala(r.n, qDiv(Q1, c)), d:pCost(Q1)};
  var ks = Object.keys(r.d);
  if(ks.length === 1){ var q = pDivMono(r.n, ks[0], r.d[ks[0]]); if(q) return {n:q, d:pCost(Q1)}; }
  return r;
}
function rAdd(a, b){
  if(pUguali(a.d, b.d)) return normR({n:pAdd(a.n, b.n), d:a.d});
  return normR({n:pAdd(pMul(a.n, b.d), pMul(b.n, a.d)), d:pMul(a.d, b.d)});
}
function rNeg(a){ return {n:pNeg(a.n), d:a.d}; }
function rSub(a, b){ return rAdd(a, rNeg(b)); }
function rMul(a, b){ return normR({n:pMul(a.n, b.n), d:pMul(a.d, b.d)}); }
function rDiv(a, b){ if(pNullo(b.n)) throw errore("divisione per zero"); return normR({n:pMul(a.n, b.d), d:pMul(a.d, b.n)}); }
function rPow(a, e){ var r = R(pCost(Q1)); for(var i=0; i<e; i++) r = rMul(r, a); return r; }
function rPolinomio(r){ return pCostante(r.d) ? r.n : null; }

/* ================= 3. lettura delle espressioni ================= */
var APICI = {"⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9"};
/* indice della graffa che chiude quella aperta in posizione i */
function chiudeGraffa(s, i){ var l = 0; for(var j=i; j<s.length; j++){ if(s[j] === "{") l++; else if(s[j] === "}"){ l--; if(!l) return j; } } return -1; }
/* da LaTeX a testo semplice leggibile dal lettore di espressioni */
function daLatex(s){
  s = String(s);
  // frazioni, anche annidate: \dfrac{A}{B} -> ((A)/(B))
  var re = /\\[dt]?frac\s*\{/;
  for(var guardia=0; guardia<50; guardia++){
    var m = re.exec(s); if(!m) break;
    var i1 = m.index + m[0].length - 1, j1 = chiudeGraffa(s, i1);
    if(j1 < 0 || s[j1+1] !== "{") break;
    var j2 = chiudeGraffa(s, j1+1); if(j2 < 0) break;
    s = s.slice(0, m.index) + "((" + s.slice(i1+1, j1) + ")/(" + s.slice(j1+2, j2) + "))" + s.slice(j2+1);
  }
  return s
    .replace(/\\left|\\right|\\displaystyle/g, "")
    .replace(/\{,\}/g, ".")
    .replace(/\\(?:cdot|times)/g, "*").replace(/\\div/g, ":")
    .replace(/\\(?:leqslant|leq|le)\b/g, "≤").replace(/\\(?:geqslant|geq|ge)\b/g, "≥")
    .replace(/\\(?:neq|ne)\b/g, "≠").replace(/\\lt\b/g, "<").replace(/\\gt\b/g, ">")
    .replace(/\^\\circ|°/g, "°")
    .replace(/\\(?:,|;|!|:|quad|qquad| )/g, " ")
    .replace(/\\sqrt\s*\{/g, "√{")
    .replace(/[{}]/g, function(c){ return c === "{" ? "(" : ")"; })
    .replace(/[−–]/g, "-").replace(/[·×]/g, "*")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function(t){ return "^(" + t.split("").map(function(c){ return APICI[c]; }).join("") + ")"; })
    .replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥").replace(/!=/g, "≠")
    .replace(/(\d),(\d)/g, "$1.$2");
}
function tokenizza(s){
  var t = [], i = 0;
  while(i < s.length){
    var c = s[i];
    if(/\s/.test(c)){ i++; continue; }
    var m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if(m){ t.push({t:"num", v:qDaDecimale(m[0])}); i += m[0].length; continue; }
    if(/[a-zA-Z]/.test(c)){
      if(/[a-zA-Z]/.test(s[i+1]||"") && /^(?:sqrt|sin|cos|tan|log|ln|exp)/.test(s.slice(i))) throw errore("funzione non gestita");
      if(c === "\\") throw errore("comando non gestito");
      t.push({t:"var", v:c}); i++; continue;
    }
    if("+-*/:^()".indexOf(c) >= 0){ t.push({t:c}); i++; continue; }
    throw errore("simbolo non gestito «"+c+"»");
  }
  // moltiplicazione sottintesa: 2x, 3(x+1), (x+1)(x-1), xy, x(...)
  var o = [];
  t.forEach(function(k, j){
    var p = o[o.length-1];
    if(p && (p.t === "num" || p.t === "var" || p.t === ")") && (k.t === "var" || k.t === "(" || (k.t === "num" && p.t !== "num"))) o.push({t:"*", imp:true});
    o.push(k);
  });
  return o;
}
/* albero dell'espressione: {k:"num"|"var"|"som"|"pro"|"div"|"pot"|"neg", ...} */
function analizza(s){
  var t = tokenizza(s), i = 0;
  function vedi(){ return t[i]; }
  function prendi(tipo){ var k = t[i]; if(!k || (tipo && k.t !== tipo)) throw errore("espressione non valida"); i++; return k; }
  function somma(){
    var a = [{s:1, n:prodotto()}];
    while(vedi() && (vedi().t === "+" || vedi().t === "-")){ var op = prendi().t; a.push({s:op === "-" ? -1 : 1, n:prodotto()}); }
    return a.length === 1 && a[0].s === 1 ? a[0].n : {k:"som", a:a};
  }
  function prodotto(){
    var n = unario();
    while(vedi() && (vedi().t === "*" || vedi().t === "/" || vedi().t === ":")){
      var op = prendi().t, m = unario();
      n = op === "*" ? {k:"pro", a:n, b:m} : {k:"div", a:n, b:m, due:op === ":"};
    }
    return n;
  }
  function unario(){
    if(vedi() && vedi().t === "-"){ prendi(); return {k:"neg", n:unario()}; }
    if(vedi() && vedi().t === "+"){ prendi(); return unario(); }
    return potenza();
  }
  function potenza(){
    var b = atomo();
    if(vedi() && vedi().t === "^"){
      prendi();
      var e = vedi() && vedi().t === "(" ? atomo() : (vedi() && vedi().t === "-" ? (prendi(), {k:"neg", n:atomo()}) : atomo());
      var ev = rPolinomio(valutaAlbero(e)), c = ev && pCostante(ev);
      if(!c || !qIntero(c) || c.n < 0n || c.n > 200n) throw errore("esponente non gestito");
      return {k:"pot", b:b, e:Number(c.n)};
    }
    return b;
  }
  function atomo(){
    var k = prendi();
    if(k.t === "num") return {k:"num", v:k.v};
    if(k.t === "var") return {k:"var", v:k.v};
    if(k.t === "("){ var n = somma(); prendi(")"); return {k:"par", n:n}; }
    throw errore("espressione non valida");
  }
  var albero = somma();
  if(i < t.length) throw errore("espressione non valida");
  return albero;
}
function valutaAlbero(n){
  switch(n.k){
    case "num": return R(pCost(n.v));
    case "var": return R(pVar(n.v));
    case "par": return valutaAlbero(n.n);
    case "neg": return rNeg(valutaAlbero(n.n));
    case "som": return n.a.reduce(function(r, x){ var v = valutaAlbero(x.n); return rAdd(r, x.s < 0 ? rNeg(v) : v); }, R(pCost(Q0)));
    case "pro": return rMul(valutaAlbero(n.a), valutaAlbero(n.b));
    case "div": return rDiv(valutaAlbero(n.a), valutaAlbero(n.b));
    case "pot": return rPow(valutaAlbero(n.b), n.e);
  }
  throw errore("nodo sconosciuto");
}
function espressione(testo){ return valutaAlbero(analizza(testo)); }
/* relazione «A op B», anche a catena (1 < x < 4 diventa due relazioni) */
var OP_REL = /[=<>≤≥≠]/;
function spezzaRelazioni(testo){
  var pezzi = [], ops = [], cur = "", l = 0;
  for(var i=0; i<testo.length; i++){
    var c = testo[i];
    if(c === "(") l++; else if(c === ")") l--;
    if(l === 0 && OP_REL.test(c)){ pezzi.push(cur); ops.push(c); cur = ""; } else cur += c;
  }
  pezzi.push(cur);
  if(!ops.length) return null;
  var rel = [];
  for(var j=0; j<ops.length; j++) rel.push({sx:pezzi[j].trim(), op:ops[j], dx:pezzi[j+1].trim()});
  if(rel.some(function(r){ return !r.sx || !r.dx; })) return null;
  return rel;
}

/* ================= 4. zeri e scomposizione di un polinomio in una lettera ================= */
function divisoriB(n){
  n = n < 0n ? -n : n;
  if(n > 1000000000000n) return null;
  var d = [], k = 1n;
  for(; k*k <= n; k++) if(n % k === 0n){ d.push(k); if(k*k !== n) d.push(n/k); }
  return d;
}
function liberoQuadrati(n){ // n = s^2 * r con r libero da quadrati
  var s = 1n, r = n, k = 2n;
  while(k*k <= r){ while(r % (k*k) === 0n){ r /= k*k; s *= k; } k++; }
  return {s:s, r:r};
}
function radQ(q){ return {tipo:"q", q:q, v:qNum(q), chiave:"q"+q.n+"/"+q.d}; }
/* radice (a + b·√r)/d */
function radIrr(a, b, r, d){
  var g = mcdB(mcdB(a, b), d); if(g > 1n){ a /= g; b /= g; d /= g; }
  if(d < 0n){ a = -a; b = -b; d = -d; }
  return {tipo:"irr", a:a, b:b, r:r, d:d, v:(Number(a) + Number(b)*Math.sqrt(Number(r)))/Number(d), chiave:"i"+a+"|"+b+"|"+r+"|"+d};
}
/* interi primitivi con il primo coefficiente positivo; restituisce anche il fattore tolto */
function primitivo(c){
  var den = c.reduce(function(m, q){ return mcmB(m, q.d); }, 1n);
  var z = c.map(function(q){ return q.n * (den / q.d); });
  var g = z.reduce(function(m, x){ return mcdB(m, x); }, 0n) || 1n;
  if(z[0] < 0n) g = -g;
  return {z:z.map(function(x){ return x / g; }), k:Q(g, den)};
}
function valutaZ(z, p, q){ // q^n · P(p/q), esatto
  var n = z.length-1, s = 0n;
  for(var i=0; i<=n; i++) s += z[i] * (p ** BigInt(n-i)) * (q ** BigInt(i));
  return s;
}
/* P = k · x^m · Π(qx − p)^molt · Π(Ax² + Bx + C)^molt · resto */
function scomponiUni(c){
  while(c.length > 1 && qZero(c[0])) c = c.slice(1);
  var base = primitivo(c), z = base.z, f = {k:base.k, m:0, lin:[], quad:[], resto:null};
  while(z.length > 1 && z[z.length-1] === 0n){ z = z.slice(0, -1); f.m++; }
  var cambiato = true;
  while(z.length > 2 && cambiato){
    cambiato = false;
    var dp = divisoriB(z[z.length-1]), dq = divisoriB(z[0]);
    if(!dp || !dq) break;
    candidati: for(var i=0; i<dp.length; i++) for(var j=0; j<dq.length; j++) for(var s=1n; s>=-1n; s-=2n){
      var p = s*dp[i], q = dq[j];
      if(mcdB(p, q) !== 1n) continue;
      if(valutaZ(z, p, q) === 0n){
        var b = [z[0] / q];
        for(var t=1; t<z.length-1; t++) b.push((z[t] + p*b[t-1]) / q);
        z = b; cambiato = true;
        var gia = f.lin.filter(function(x){ return x.p === p && x.q === q; })[0];
        if(gia) gia.molt++; else f.lin.push({p:p, q:q, molt:1});
        break candidati;
      }
    }
  }
  if(z.length === 2){
    var gia2 = f.lin.filter(function(x){ return x.p === -z[1] && x.q === z[0]; })[0];
    if(gia2) gia2.molt++; else f.lin.push({p:-z[1], q:z[0], molt:1});
  } else if(z.length === 3) f.quad.push({A:z[0], B:z[1], C:z[2], molt:1});
  else if(z.length === 5 && z[1] === 0n && z[3] === 0n){
    // biquadratica senza zeri razionali: si prova a scomporre in x² due trinomi x² − r
    var t2 = scomponiUni([Q(z[0]), Q(z[2]), Q(z[4])]);
    if(!t2.quad.length && !t2.resto && t2.m === 0){
      t2.lin.forEach(function(l){ for(var u=0; u<l.molt; u++) f.quad.push({A:l.q, B:0n, C:-l.p, molt:1}); });
    } else f.resto = z;
  } else if(z.length > 3) f.resto = z;
  // fattori quadratici uguali: molteplicità
  var q2 = [];
  f.quad.forEach(function(x){ var g = q2.filter(function(y){ return y.A === x.A && y.B === x.B && y.C === x.C; })[0]; if(g) g.molt++; else q2.push(x); });
  f.quad = q2;
  // k: il coefficiente che resta fuori, ricalcolato perché il prodotto ridia P
  var lead = c[0], prod = Q1;
  f.lin.forEach(function(l){ prod = qMul(prod, qPow(Q(l.q), l.molt)); });
  f.quad.forEach(function(x){ prod = qMul(prod, qPow(Q(x.A), x.molt)); });
  if(f.resto) prod = qMul(prod, Q(f.resto[0]));
  f.k = qDiv(lead, prod);
  return f;
}
/* zeri reali (esatti) di un polinomio in una lettera; null se non si sanno scrivere */
function zeriUni(c){
  if(c.length <= 1) return [];
  var f = scomponiUni(c), z = [];
  if(f.resto) return null;
  if(f.m) z.push({r:radQ(Q0), molt:f.m});
  f.lin.forEach(function(l){ z.push({r:radQ(Q(l.p, l.q)), molt:l.molt}); });
  f.quad.forEach(function(x){
    var D = x.B*x.B - 4n*x.A*x.C;
    if(D < 0n) return;
    var sr = liberoQuadrati(D);
    if(sr.r === 1n) return; // non succede: sarebbe stato scomposto
    z.push({r:radIrr(-x.B, sr.s, sr.r, 2n*x.A), molt:x.molt});
    z.push({r:radIrr(-x.B, -sr.s, sr.r, 2n*x.A), molt:x.molt});
  });
  return z.sort(function(a, b){ return a.r.v - b.r.v; });
}

/* ================= 5. insiemi soluzione ================= */
/* relazione: {f: funzione razionale (sx − dx), op} in una lettera v. Restituisce i punti
   critici e l'appartenenza di punti e intervalli, oppure null se non si sa risolvere. */
function studiaRelazione(f, op, v){
  var cn = pUni(f.n, v), cd = pUni(f.d, v);
  var zn = pNullo(f.n) ? [] : zeriUni(cn), zd = zeriUni(cd);
  if(zn === null || zd === null) return null;
  var punti = {}, lista = [];
  function metti(z, cosa){ z.forEach(function(x){ var k = x.r.chiave; if(!punti[k]){ punti[k] = {r:x.r, zero:false, polo:false, molt:0}; lista.push(punti[k]); } punti[k][cosa] = true; if(cosa === "zero") punti[k].molt = x.molt; }); }
  metti(zn, "zero"); metti(zd, "polo");
  lista.sort(function(a, b){ return a.r.v - b.r.v; });
  var nullo = pNullo(f.n), nNum = cn.map(qNum), dNum = cd.map(qNum);
  function val(x){ var a = 0, b = 0; nNum.forEach(function(c){ a = a*x + c; }); dNum.forEach(function(c){ b = b*x + c; }); return a/b; }
  function vale(y){ if(nullo) return op === "=" || op === "≥" || op === "≤"; return op === ">" ? y > 0 : op === "≥" ? y > 0 : op === "<" ? y < 0 : op === "≤" ? y < 0 : op === "≠" ? y !== 0 : false; }
  return {
    lista: lista, val: val,
    nelPunto: function(r){
      var p = punti[r.chiave];
      if(p){ if(p.polo) return false; if(p.zero || nullo) return op === "=" || op === "≥" || op === "≤"; }
      return vale(val(r.v));
    },
    inX: function(x){ return vale(val(x)); }
  };
}
/* intersezione di più relazioni sulla griglia comune dei punti critici */
function insieme(relazioni){
  var tutti = {}, lista = [];
  relazioni.forEach(function(s){ s.lista.forEach(function(p){ if(!tutti[p.r.chiave]){ tutti[p.r.chiave] = 1; lista.push(p.r); } }); });
  lista.sort(function(a, b){ return a.v - b.v; });
  var inP = lista.map(function(r){ return relazioni.every(function(s){ return s.nelPunto(r); }); });
  var inI = [];
  for(var i=0; i<=lista.length; i++){
    var x = !lista.length ? 0 : i === 0 ? lista[0].v - 1 : i === lista.length ? lista[i-1].v + 1 : (lista[i-1].v + lista[i].v)/2;
    inI.push(relazioni.every(function(s){ return s.inX(x); }));
  }
  // forma canonica: si tolgono i punti che non separano niente
  var P = [], IP = [], II = [inI[0]];
  for(var j=0; j<lista.length; j++){
    if(inI[j] === inP[j] && inP[j] === inI[j+1]) continue;
    P.push(lista[j]); IP.push(inP[j]); II.push(inI[j+1]);
  }
  // fusione degli intervalli separati da punti rimossi
  return {punti:P, inP:IP, inI:II};
}
function insiemeDaTesto(rel, v){
  var studi = [];
  for(var i=0; i<rel.length; i++){
    var f = rSub(espressione(rel[i].sx), espressione(rel[i].dx));
    var s = studiaRelazione(f, rel[i].op, v);
    if(!s) return null;
    studi.push(s);
  }
  return insieme(studi);
}
/* pezzi dell'insieme: [{da, a, daC, aC}] con da/a radici o null (infinito) */
function pezzi(S){
  var out = [], cur = null, n = S.punti.length;
  function chiudi(a, aC){ if(cur){ cur.a = a; cur.aC = aC; out.push(cur); cur = null; } }
  if(S.inI[0]) cur = {da:null, daC:false};
  for(var i=0; i<n; i++){
    var p = S.punti[i];
    if(cur){ if(S.inP[i]){ if(!S.inI[i+1]) chiudi(p, true); } else chiudi(p, false); }
    else if(S.inP[i]){ cur = {da:p, daC:true}; if(!S.inI[i+1]) chiudi(p, true); }
    if(!cur && S.inI[i+1]) cur = {da:p, daC:false};
  }
  if(cur) chiudi(null, false);
  return out;
}
function tipoInsieme(S){
  if(!S.punti.length) return S.inI[0] ? "tutto" : "vuoto";
  if(S.inI.every(function(x){ return x; }) && S.inP.every(function(x){ return !x; })) return "tranne";
  if(S.inI.every(function(x){ return !x; })) return "punti";
  return "generale";
}
/* firma dell'insieme: forma senza i valori */
function firmaInsieme(S){
  return tipoInsieme(S) + ":" + S.inI.map(function(x){ return x ? "1" : "0"; }).join("") + "/" + S.inP.map(function(x){ return x ? "1" : "0"; }).join("");
}
function chiaveInsieme(S){ return firmaInsieme(S) + "@" + S.punti.map(function(r){ return r.chiave; }).join(","); }

/* ================= 6. scrittura di numeri, polinomi, insiemi ================= */
function qTxt(q){ return (q.n < 0n ? "-" : "") + (q.n < 0n ? -q.n : q.n) + (q.d !== 1n ? "/" + q.d : ""); }
function qTex(q){ if(q.d === 1n) return String(q.n); return (q.n < 0n ? "-" : "") + "\\dfrac{" + (q.n < 0n ? -q.n : q.n) + "}{" + q.d + "}"; }
function qDecimale(q){ // "-1,5" se il decimale è finito e corto, altrimenti null
  if(q.d === 1n) return null;
  var d = q.d, k = 0; while(d % 10n === 0n){ d /= 10n; k++; } while(d % 2n === 0n){ d /= 2n; k++; } while(d % 5n === 0n){ d /= 5n; k++; }
  if(d !== 1n || k > 3) return null;
  return String(qNum(q).toFixed(k)).replace(/\.?0+$/, "").replace(".", ",");
}
function radTxt(r){
  if(r.tipo === "q") return qTxt(r.q);
  var b = r.b < 0n ? -r.b : r.b, rad = (b === 1n ? "" : String(b)) + "√" + r.r, num;
  if(r.a === 0n) num = (r.b < 0n ? "-" : "") + rad;
  else num = r.a + (r.b < 0n ? "-" : "+") + rad;
  if(r.d === 1n) return num;
  return r.a === 0n ? num + "/" + r.d : "(" + num + ")/" + r.d;
}
function radTex(r){
  if(r.tipo === "q") return qTex(r.q);
  var b = r.b < 0n ? -r.b : r.b, rad = (b === 1n ? "" : String(b)) + "\\sqrt{" + r.r + "}", num;
  if(r.a === 0n){ num = rad; if(r.d === 1n) return (r.b < 0n ? "-" : "") + num; return (r.b < 0n ? "-" : "") + "\\dfrac{" + num + "}{" + r.d + "}"; }
  num = r.a + (r.b < 0n ? "-" : "+") + rad;
  return r.d === 1n ? num : "\\dfrac{" + num + "}{" + r.d + "}";
}
var APICE_TXT = ["⁰","¹","²","³","⁴","⁵","⁶","⁷","⁸","⁹"];
/* termini ordinati: grado totale decrescente, poi lettere in ordine alfabetico con esponente decrescente */
function terminiOrdinati(p, crescente){
  var ks = Object.keys(p), lettere = pLettere(p);
  ks.sort(function(a, b){
    var ma = monoDi(a), mb = monoDi(b), ga = 0, gb = 0, v;
    for(v in ma) ga += ma[v]; for(v in mb) gb += mb[v];
    if(ga !== gb) return gb - ga;
    for(var i=0; i<lettere.length; i++){ var d = (mb[lettere[i]]||0) - (ma[lettere[i]]||0); if(d) return d; }
    return 0;
  });
  if(crescente) ks.reverse();
  return ks;
}
function monoTesto(m, tex){
  return Object.keys(m).sort().map(function(v){ return m[v] === 1 ? v : v + (tex ? "^{" + m[v] + "}" : "^" + m[v]); }).join("");
}
function coefTesto(q, haLettere, primo, tex){
  var neg = q.n < 0n, a = qAbs(q), s = "";
  if(!haLettere || !qEq(a, Q1)) s = tex ? qTex(a) : (a.d === 1n ? String(a.n) : (haLettere ? "(" + qTxt(a) + ")" : qTxt(a)));
  return (neg ? "-" : (primo ? "" : "+")) + s;
}
function polTesto(p, opz){
  opz = opz || {};
  var ks = terminiOrdinati(p, opz.crescente);
  if(!ks.length) return "0";
  return ks.map(function(k, i){ var m = monoDi(k); return coefTesto(p[k], !!k, i === 0, opz.tex) + monoTesto(m, opz.tex); }).join("");
}
function polTex(p, crescente){ return polTesto(p, {tex:true, crescente:crescente}).replace(/\^\{(\d)\}/g, "^$1"); }
/* insieme in forma di disuguaglianze (testo semplice o LaTeX) */
function insiemeTesto(S, v, tex){
  var t = tipoInsieme(S), N = tex ? radTex : radTxt;
  var LE = tex ? " \\le " : " ≤ ", GE = tex ? " \\ge " : " ≥ ", O = tex ? " \\vee " : " ∨ ";
  if(t === "vuoto") return tex ? "\\text{nessuna soluzione}" : "nessuna soluzione";
  if(t === "tutto") return tex ? "\\forall x\\in\\mathbb{R}".replace("x", v) : "per ogni " + v + " reale";
  if(t === "tranne") return S.punti.map(function(r){ return v + (tex ? " \\neq " : " ≠ ") + N(r); }).join(tex ? " \\wedge " : " ∧ ");
  return pezzi(S).map(function(q){
    if(q.da && q.a && q.da.chiave === q.a.chiave) return v + " = " + N(q.da);
    if(!q.da) return v + (q.aC ? LE : " < ") + N(q.a);
    if(!q.a) return v + (q.daC ? GE : " > ") + N(q.da);
    return N(q.da) + (q.daC ? LE : " < ") + v + (q.aC ? LE : " < ") + N(q.a);
  }).join(O);
}
/* testo per le opzioni: «nessuna soluzione», «per ogni $x$ reale» o $...$ */
function insiemeOpzione(S, v){
  var t = tipoInsieme(S);
  if(t === "vuoto") return "nessuna soluzione";
  if(t === "tutto") return "per ogni $" + v + "$ reale";
  return "$" + insiemeTesto(S, v, true) + "$";
}
function insiemeIntervalli(S, sep, francese){
  var t = tipoInsieme(S);
  if(t === "vuoto") return "∅";
  if(t === "tutto") return "ℝ";
  sep = sep || ";";
  return pezzi(S).map(function(q){
    if(q.da && q.a && q.da.chiave === q.a.chiave) return "{" + radTxt(q.da) + "}";
    var aperta = francese ? "]" : "(", chiusa = francese ? "[" : ")";
    return (q.da ? (q.daC ? "[" : aperta) + radTxt(q.da) : aperta + "-∞") + sep + (q.a ? radTxt(q.a) + (q.aC ? "]" : chiusa) : "+∞" + chiusa);
  }).join("∪");
}
/* risposte accettate per un insieme */
function variantiInsieme(S, v){
  var t = tipoInsieme(S), out = [];
  if(t === "vuoto") return ["nessuna soluzione", "impossibile", "∅", "S=∅", "nessuna"];
  if(t === "tutto") return ["per ogni " + v + " reale", "ogni " + v + " reale", "ℝ", "S=ℝ", "R", "sempre verificata", "∀" + v + "∈ℝ"];
  out.push(insiemeTesto(S, v, false));
  if(t === "punti"){
    var vals = S.punti.map(radTxt);
    if(vals.length === 1) out.push(vals[0]);
    else {
      out.push(vals.join(" ∨ "));
      out.push(vals.map(function(x){ return v + " = " + x; }).join(" e "), vals.slice().reverse().map(function(x){ return v + " = " + x; }).join(" e "));
      out.push(vals.join(" e "), vals.slice().reverse().join(" e "), vals.join("; "), vals.slice().reverse().join("; "));
    }
    return out;
  }
  if(t === "tranne"){ out.push(S.punti.map(function(r){ return v + "!=" + radTxt(r); }).join(" ∧ ")); return out; }
  out.push(insiemeIntervalli(S, ";"), insiemeIntervalli(S, ","), insiemeIntervalli(S, ";", true));
  // con i decimali, se i numeri li hanno corti
  var dec = insiemeTesto(S, v, false), cambiato = false;
  S.punti.forEach(function(r){ if(r.tipo === "q"){ var d = qDecimale(r.q); if(d){ dec = dec.split(radTxt(r)).join(d); cambiato = true; } } });
  if(cambiato) out.push(dec);
  // una sola disuguaglianza: anche scritta al contrario (4 < x)
  var pz = pezzi(S);
  if(pz.length === 1 && (!pz[0].da || !pz[0].a)){
    var q = pz[0];
    out.push(!q.da ? radTxt(q.a) + (q.aC ? " ≥ " : " > ") + v : radTxt(q.da) + (q.daC ? " ≤ " : " < ") + v);
  }
  return out;
}
/* insiemi: appartenenza, combinazioni, forma canonica, distrattori */
function canonico(S){
  var P = [], IP = [], II = [S.inI[0]];
  for(var j=0; j<S.punti.length; j++){
    if(S.inI[j] === S.inP[j] && S.inP[j] === S.inI[j+1] && II[II.length-1] === S.inI[j]) continue;
    P.push(S.punti[j]); IP.push(S.inP[j]); II.push(S.inI[j+1]);
  }
  // dopo la rimozione due intervalli consecutivi uguali vanno fusi: si ricalcola
  var P2 = [], IP2 = [], II2 = [II[0]];
  for(var k=0; k<P.length; k++){
    if(II2[II2.length-1] === IP[k] && IP[k] === II[k+1]) continue;
    P2.push(P[k]); IP2.push(IP[k]); II2.push(II[k+1]);
  }
  return {punti:P2, inP:IP2, inI:II2};
}
function appartieneX(S, x){ for(var i=0; i<S.punti.length; i++){ if(x < S.punti[i].v) return S.inI[i]; } return S.inI[S.punti.length]; }
function appartieneR(S, r){ for(var i=0; i<S.punti.length; i++) if(S.punti[i].chiave === r.chiave) return S.inP[i]; return appartieneX(S, r.v); }
function combina(insiemi, e){
  var tutti = {}, lista = [];
  insiemi.forEach(function(S){ S.punti.forEach(function(r){ if(!tutti[r.chiave]){ tutti[r.chiave] = 1; lista.push(r); } }); });
  lista.sort(function(a, b){ return a.v - b.v; });
  function op(f){ return e ? insiemi.every(f) : insiemi.some(f); }
  var inP = lista.map(function(r){ return op(function(S){ return appartieneR(S, r); }); }), inI = [];
  for(var i=0; i<=lista.length; i++){
    var x = !lista.length ? 0 : i === 0 ? lista[0].v - 1 : i === lista.length ? lista[i-1].v + 1 : (lista[i-1].v + lista[i].v)/2;
    inI.push(op(function(S){ return appartieneX(S, x); }));
  }
  return canonico({punti:lista, inP:inP, inI:inI});
}
function radNeg(r){ return r.tipo === "q" ? radQ(qNeg(r.q)) : radIrr(-r.a, -r.b, r.r, r.d); }
function complemento(S){ return canonico({punti:S.punti, inP:S.inP.map(function(x){ return !x; }), inI:S.inI.map(function(x){ return !x; })}); }
function specchia(S){ return canonico({punti:S.punti.slice().reverse().map(radNeg), inP:S.inP.slice().reverse(), inI:S.inI.slice().reverse()}); }
function bordiScambiati(S){ return canonico({punti:S.punti, inP:S.inP.map(function(x, i){ return S.inI[i] !== S.inI[i+1] ? !x : x; }), inI:S.inI}); }
/* insieme formato da un solo pezzo {da, a, daC, aC} (da/a null = infinito) */
function insiemeDaPezzo(q){
  if(!q.da && !q.a) return {punti:[], inP:[], inI:[true]};
  if(!q.da) return {punti:[q.a], inP:[q.aC], inI:[true, false]};
  if(!q.a) return {punti:[q.da], inP:[q.daC], inI:[false, true]};
  if(q.da.chiave === q.a.chiave) return {punti:[q.da], inP:[true], inI:[false, false]};
  return {punti:[q.da, q.a], inP:[q.daC, q.aC], inI:[false, true, false]};
}
function soloPrimo(S){ var pz = pezzi(S); return pz.length ? insiemeDaPezzo(pz[0]) : S; }
function insiemeDaPunti(punti, inP, inI){ return canonico({punti:punti, inP:inP, inI:inI}); }
function interiDi(S){
  var n = S.punti.length;
  if(S.inI[0] || S.inI[n]) return null;
  if(!n) return [];
  var a = Math.ceil(S.punti[0].v - 1e-9), b = Math.floor(S.punti[n-1].v + 1e-9), out = [];
  if(b - a > 500) return null;
  for(var k=a; k<=b; k++) if(appartieneR(S, radQ(Q(k)))) out.push(k);
  return out;
}
function interoEstremo(S, verso, positivo){
  // il più piccolo (verso 1) o il più grande (verso -1) intero di S, con eventuale vincolo > 0
  var n = S.punti.length;
  if(verso > 0 && S.inI[0] && !positivo) return null;
  if(verso < 0 && S.inI[n]) return null;
  var lo = positivo ? 1 : (n ? Math.floor(S.punti[0].v) - 2 : -2), hi = n ? Math.ceil(S.punti[n-1].v) + 2 : 2;
  if(positivo && hi < 1) hi = 1;
  hi += 60;
  if(verso > 0){ for(var k=lo; k<=hi; k++) if(appartieneR(S, radQ(Q(k)))) return k; }
  else { for(var j=hi; j>=lo-60; j--) if(appartieneR(S, radQ(Q(j)))) return j; }
  return null;
}

/* ================= 7. testo degli esercizi ================= */
var CFG = {corretta:null, normalizza:null};
/* un «<» seguito da una lettera sarebbe letto come inizio di un tag HTML: si aggiunge uno spazio,
   lasciando stare i tag veri (<strong>, <em>...) */
function sanifica(s){ return String(s).replace(/<(?=[A-Za-z\\])(?!(?:strong|em|b|i|u|br|sup|sub|span|code|small|p|div|ul|ol|li|a|table|tr|td|th)\b)/g, "< "); }
function testoPiano(h){ return String(h==null?"":h).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&deg;/g, "°").replace(/\s+/g, " ").trim(); }
/* testo semplice («Risolvi x^2-5x+6>0») -> testo con la matematica fra $...$ */
function avvolgiMatematica(riga){
  if(/\$/.test(riga)) return riga;
  var tok = riga.split(/(\s+)/), out = [], run = [];
  function matematico(t){
    if(!t || /^\s+$/.test(t)) return false;
    if(/[0-9=<>≤≥≠^+*/:()²³−]/.test(t)) return /^[0-9a-zA-Z()+\-−*/:^.,=<>≤≥≠²³]+[.?!;,:]?$/.test(t);
    return /^[a-zA-Z]$/.test(t) && !/^[eoaiEOAI]$/.test(t);
  }
  function chiudi(){
    if(!run.length) return;
    var testo = run.join(" "), coda = "";
    var m = /[.?!;,:]$/.exec(testo);
    if(m){ coda = m[0]; testo = testo.slice(0, -1); }
    var tex = testo.replace(/−/g, "-").replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥").replace(/!=/g, "≠")
      .replace(/\s*≤\s*/g, " \\le ").replace(/\s*≥\s*/g, " \\ge ").replace(/\s*≠\s*/g, " \\neq ")
      .replace(/\s*<\s*/g, " < ").replace(/\s*>\s*/g, " > ").replace(/\*/g, "\\cdot ")
      .replace(/\^(\d{2,})/g, "^{$1}").replace(/(\d),(\d)/g, "$1{,}$2");
    out.push("$" + tex.trim() + "$" + coda); run = [];
  }
  tok.forEach(function(t){
    if(/^\s+$/.test(t)){ if(!run.length) out.push(t); return; }
    if(matematico(t)) run.push(t); else { chiudi(); if(out.length && !/\s$/.test(out[out.length-1])) out.push(" "); out.push(t); }
  });
  chiudi();
  return out.join("").replace(/\$\s+\$/g, " ").replace(/ {2,}/g, " ").trim();
}
function segmentiDi(q){
  var s = [], re = /\$([^$]+)\$/g, m;
  while((m = re.exec(q))) s.push({tex:m[1], i:m.index, j:m.index + m[0].length});
  return s;
}
function ricomponi(q, segs, nuovi){
  var out = "", p = 0;
  segs.forEach(function(sg, k){ out += q.slice(p, sg.i) + "$" + (nuovi[k] != null ? nuovi[k] : sg.tex) + "$"; p = sg.j; });
  return out + q.slice(p);
}
/* parti di un segmento LaTeX: sistemi (cases) e lati delle relazioni */
function righeSistema(tex){
  var m = /\\begin\{cases\}([\s\S]*)\\end\{cases\}/.exec(tex);
  if(!m) return null;
  return m[1].split(/\\\\/).map(function(r){ return r.replace(/&/g, "").trim(); }).filter(Boolean);
}
function latiTex(tex){
  // spezza «A op B» in LaTeX al primo operatore di relazione fuori dalle parentesi
  var l = 0, re = /\\(?:leqslant|leq|le|geqslant|geq|ge|neq|ne|lt|gt)\b|[<>=≤≥≠]/g, m;
  for(var i=0; i<tex.length; i++){ var c = tex[i]; if(c === "(" || c === "{") l++; else if(c === ")" || c === "}") l--; }
  var pos = [];
  l = 0;
  for(var j=0; j<tex.length; j++){
    var ch = tex[j];
    if(ch === "(" || ch === "{") l++; else if(ch === ")" || ch === "}") l--;
    if(l !== 0) continue;
    re.lastIndex = j; m = re.exec(tex);
    if(m && m.index === j){ pos.push({i:j, len:m[0].length}); j += m[0].length - 1; }
  }
  if(!pos.length) return null;
  var lati = [], p = 0;
  pos.forEach(function(x){ lati.push(tex.slice(p, x.i)); p = x.i + x.len; });
  lati.push(tex.slice(p));
  return lati.map(function(x){ return x.trim(); });
}
/* numeri che si possono cambiare in un segmento LaTeX */
function numeriDi(tex){
  var out = [], re = /\d+(?:(?:\{,\}|,(?=\d)|\.(?=\d))\d+)?/g, m;
  while((m = re.exec(tex))){
    var i = m.index, prima = tex.slice(0, i).replace(/[\s{]+$/, ""), dopo = tex.slice(i + m[0].length).replace(/^\s+/, "");
    var ultimo = prima.slice(-1), fisso = false;
    if(ultimo === "^" || ultimo === "_" || /\\sqrt\[$/.test(prima)) fisso = true;
    if(/^\^\\circ|^°/.test(dopo)) fisso = true;
    if(m[0] === "10" && /^\^/.test(dopo)) fisso = true; // base della notazione scientifica
    var stile = /\{,\}/.test(m[0]) ? "graffa" : /,/.test(m[0]) ? "virgola" : /\./.test(m[0]) ? "punto" : "intero";
    var testo = m[0].replace("{,}", ".").replace(",", ".");
    var dec = (testo.split(".")[1] || "").length, v = parseFloat(testo);
    if(v === 0) fisso = true;
    var ruolo = /^[a-zA-Z(]|^\\(?:left|sqrt|dfrac|frac|cdot)/.test(dopo) ? "coef" : (/[/:]$/.test(prima) || /\}$/.test(prima) && /\\[dt]?frac\s*\{[^{}]*\}$/.test(prima + "}") ) ? "den" : "cost";
    if(/\}\{$/.test(tex.slice(0, i).replace(/\s+$/, ""))) ruolo = "den";
    out.push({i:i, j:i + m[0].length, v:v, dec:dec, stile:stile, ruolo:ruolo, fisso:fisso});
  }
  return out;
}
function scriviNumero(v, dec, stile){
  var s = dec ? v.toFixed(dec) : String(Math.round(v));
  if(stile === "graffa") return s.replace(".", "{,}");
  if(stile === "virgola") return s.replace(".", ",");
  return s;
}
function nuovoNumero(n, rng, scala){
  if(n.dec){
    for(var t=0; t<30; t++){ var x = +(n.v * (0.5 + 1.5*rng())).toFixed(n.dec); if(x > 0 && x !== n.v && Math.round(x * Math.pow(10, n.dec)) % 10 !== 0) return x; }
    return n.v;
  }
  var M = Math.max(9, Math.ceil(1.6*n.v)) * (scala || 1), lo = (n.ruolo === "coef" || n.ruolo === "den") ? 2 : 1;
  M = Math.max(lo + 2, Math.round(M));
  return lo + Math.floor(rng() * (M - lo + 1));
}
var LIBERI = {v:false}; // se vero, anche i numeri uguali dell'originale cambiano in modo indipendente
function cambiaNumeri(tex, rng, scala, mappa){
  var ns = numeriDi(tex), out = "", p = 0, lega = !LIBERI.v && rng() < 0.85;
  mappa = mappa || {};
  ns.forEach(function(n){
    var chiave = n.v + "|" + n.dec + "|" + (n.ruolo === "cost" ? "c" : "k"), nuovo;
    if(n.fisso) nuovo = tex.slice(n.i, n.j);
    else if(lega && mappa[chiave] != null) nuovo = mappa[chiave];
    else { nuovo = scriviNumero(nuovoNumero(n, rng, scala), n.dec, n.stile); mappa[chiave] = nuovo; }
    out += tex.slice(p, n.i) + nuovo; p = n.j;
  });
  return out + tex.slice(p);
}
function haCifreLibere(tex){ return numeriDi(tex).some(function(n){ return !n.fisso; }); }
/* sostituisce una lettera con un valore in un testo LaTeX, saltando i comandi */
function sostituisciLettera(tex, v, val){
  return tex.replace(/\\[a-zA-Z]+|[a-zA-Z]/g, function(t){ return t === v ? "(" + val + ")" : t; });
}
function rng32(seme){
  var a = (seme >>> 0) || 1;
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function mescola(arr, rng){ var a = arr.slice(); for(var i=a.length-1; i>0; i--){ var j = Math.floor(rng()*(i+1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
/* opzioni: la corretta in una posizione casuale */
function opzioni(corretta, distrattori, rng){
  var tutte = mescola([corretta].concat(distrattori.slice(0, 3)), rng);
  return {opz:tutte, ok:tutte.indexOf(corretta)};
}
function scientifica(x){ // 35000 -> {txt:"3,5·10^4", tex:"3{,}5\\cdot10^{4}"}
  if(x === 0) return {txt:"0", tex:"0"};
  var e = Math.floor(Math.log10(Math.abs(x))), m = Math.round(x / Math.pow(10, e) * 1000) / 1000;
  if(Math.abs(m) >= 10){ m /= 10; e++; }
  var mt = testoNumero(m);
  return {txt:(mt === "1" ? "" : mt + "·") + "10^" + e, tex:(mt === "1" ? "" : mt.replace(",", "{,}") + "\\cdot") + "10^{" + e + "}"};
}
function testoNumero(x){ // 2.5 -> "2,5"
  var r = Math.round(x*1e6)/1e6;
  return String(r).replace(".", ",");
}
function texNumero(x){ return testoNumero(x).replace(",", "{,}"); }

/* ================= 8. strumenti comuni alle famiglie ================= */
function prova(f){ try{ return f(); }catch(e){ if(e && e.generatore) return null; throw e; } }
function parseSicuro(testo){ return prova(function(){ return espressione(testo); }); }
function polinomioDi(testo){ var r = parseSicuro(testo); return r ? rPolinomio(r) : null; }
function letteraUnica(testi){
  var s = {}; testi.forEach(function(t){ (String(t).match(/[a-zA-Z]/g) || []).forEach(function(c){ s[c] = 1; }); });
  var k = Object.keys(s); return k.length === 1 ? k[0] : null;
}
function testoOpzione(o){ return String(o).replace(/<[^>]+>/g, " "); }
/* un'opzione (o una risposta) letta come insieme di soluzioni */
function leggiInsieme(testo, v){
  var t = testoPiano(testo).toLowerCase();
  if(/nessuna soluzione|impossibile|non ha soluzion|nessun valore|insieme vuoto|∅/.test(t)) return {punti:[], inP:[], inI:[false]};
  if(/per ogni|qualsiasi|sempre verificat|tutti i numeri reali|ogni valore|ℝ|\\mathbb\{r\}/.test(t)) return {punti:[], inP:[], inI:[true]};
  var mat = segmentiDi(String(testo)).map(function(s){ return s.tex; }).join(" ");
  if(!mat) mat = String(testo);
  var plain = daLatex(mat.replace(/\\vee|\\lor/g, "∨").replace(/\\wedge|\\land/g, "∧")).replace(/\s+(?:o|oppure)\s+/g, "∨");
  if(/[a-zA-Z]{2,}/.test(plain.replace(/\b[a-z]\b/g, ""))) return null;
  var pz = plain.split("∨"), insiemi = [];
  for(var i=0; i<pz.length; i++){
    var parti = pz[i].split("∧"), rel = [];
    for(var j=0; j<parti.length; j++){ var r = spezzaRelazioni(parti[j].trim()); if(!r) return null; rel = rel.concat(r); }
    var S = prova(function(){ return insiemeDaTesto(rel, v); });
    if(!S) return null;
    insiemi.push(S);
  }
  return combina(insiemi, false);
}
function stessoInsieme(A, B){ return !!(A && B) && chiaveInsieme(canonico(A)) === chiaveInsieme(canonico(B)); }
function leggiPolinomioTesto(testo){
  var mat = segmentiDi(String(testo)).map(function(s){ return s.tex; }).join(" ");
  var plain = daLatex(mat || testoPiano(testo)).replace(/^\s*[A-Za-z]\([a-z]\)\s*=/, "");
  return polinomioDi(plain);
}
function leggiNumeroTesto(testo){
  var mat = segmentiDi(String(testo)).map(function(s){ return s.tex; }).join(" ");
  var plain = daLatex(mat || testoPiano(testo)).replace(/^[a-zA-Z]\s*=\s*/, "").trim();
  var p = polinomioDi(plain), c = p && pCostante(p);
  return c ? qNum(c) : null;
}
function decimaliDi(x){ var s = String(x); return (s.split(".")[1] || "").length; }
function numOk(item, x){ if(!item.num) return false; var tol = Math.max(item.num.tol || 0, 1e-9); return Math.abs(x - item.num.v) <= tol; }
/* la nostra risposta (varianti di testo) è accettata dal correttore dell'esercizio originale? */
function accettata(item, varianti){ return !!CFG.corretta && varianti.some(function(t){ return CFG.corretta(item, t); }); }

/* scomposizione scritta: prefisso (costante e monomio) e fattori */
function fattoriDi(c, v){
  var f = scomponiUni(c), fatt = [], k = f.k;
  if(f.resto) return null;
  f.lin.forEach(function(l){ fatt.push({p:pDaUni([Q(l.q), Q(-l.p)], v), molt:l.molt, lin:l}); });
  f.quad.forEach(function(x){ fatt.push({p:pDaUni([Q(x.A), Q(x.B), Q(x.C)], v), molt:x.molt, quad:x}); });
  return {k:k, m:f.m, fatt:fatt, f:f};
}
function prefissoTesto(F, v, tex){
  var s = "";
  if(qEq(F.k, Q(-1))) s = "-";
  else if(!qEq(F.k, Q1) || (!F.m && !F.fatt.length)) s = tex ? qTex(F.k) : qTxt(F.k);
  if(F.m) s += v + (F.m > 1 ? (tex ? "^{" + F.m + "}" : "^" + F.m) : "");
  return s;
}
function fattoreTesto(x, tex, costantePrima){
  var t = tex ? polTex(x.p, costantePrima) : polTesto(x.p, {crescente:costantePrima});
  var solo = pTermini(x.p) === 1 && !pCostante(x.p);
  var base = solo ? t : "(" + t + ")";
  return x.molt > 1 ? base + (tex ? "^{" + x.molt + "}" : "^" + x.molt) : base;
}
function scomposizioneTesto(F, v, tex, ordine, costantePrima){
  var fs = (ordine || F.fatt).map(function(x){ return fattoreTesto(x, tex, costantePrima); }).join("");
  var pre = prefissoTesto(F, v, tex);
  if(pre === "-" && !fs) return "-1";
  return (pre + fs).replace(/\^\{(\d)\}/g, "^$1") || "1";
}
function permutazioni(a){
  if(a.length <= 1) return [a];
  var out = [];
  a.forEach(function(x, i){ permutazioni(a.slice(0, i).concat(a.slice(i+1))).forEach(function(p){ out.push([x].concat(p)); }); });
  return out;
}
function variantiScomposizione(F, v){
  var out = [], perm = F.fatt.length <= 4 ? permutazioni(F.fatt) : [F.fatt];
  perm.forEach(function(o){ out.push(scomposizioneTesto(F, v, false, o, false)); out.push(scomposizioneTesto(F, v, false, o, true)); });
  // fattori ripetuti scritti per esteso: (x-1)(x-1)(x+2)
  if(F.fatt.some(function(x){ return x.molt > 1; })){
    var est = [];
    F.fatt.forEach(function(x){ for(var i=0; i<x.molt; i++) est.push({p:x.p, molt:1}); });
    out.push(scomposizioneTesto(F, v, false, est, false));
  }
  // segno meno assorbito dal primo fattore lineare: -(x-3)(x+3) -> (3-x)(x+3)
  if(qEq(F.k, Q(-1)) && F.fatt.length){
    var i0 = F.fatt.findIndex ? F.fatt.findIndex(function(x){ return x.lin && x.molt === 1; }) : -1;
    if(i0 >= 0){
      var G = {k:Q1, m:F.m, fatt:F.fatt.map(function(x, i){ return i === i0 ? {p:pNeg(x.p), molt:1, lin:x.lin} : x; })};
      var assorbite = [];
      (G.fatt.length <= 4 ? permutazioni(G.fatt) : [G.fatt]).forEach(function(o){ assorbite.push(scomposizioneTesto(G, v, false, o, true)); assorbite.push(scomposizioneTesto(G, v, false, o, false)); });
      out = assorbite.concat(out);
    }
  }
  return out.filter(function(x, i){ return out.indexOf(x) === i; });
}

/* ================= 9. famiglia «risolvi» ================= */
/* relazioni di un segmento (anche un sistema) in testo semplice */
function relazioniDi(tex){
  var righe = righeSistema(tex), rel = [];
  if(righe){ for(var i=0; i<righe.length; i++){ var r = spezzaRelazioni(daLatex(righe[i])); if(!r) return null; rel = rel.concat(r); } return {rel:rel, sistema:true}; }
  var r2 = spezzaRelazioni(daLatex(tex));
  return r2 ? {rel:r2, sistema:r2.length > 1} : null;
}
function eDefinizione(r){ return r.length === 1 && r[0].op === "=" && /^[a-zA-Z](?:\([a-zA-Z]\))?$/.test(r[0].sx.replace(/\s/g, "")) && /[a-zA-Z]/.test(r[0].dx) && r[0].dx.indexOf(r[0].sx.replace(/\s/g, "")[0]) < 0; }
function eAssegnazione(r){ return r.every(function(x){ return x.op === "=" && /^[a-zA-Z]$/.test(x.sx.replace(/\s/g, "")) && !/[a-zA-Z]/.test(x.dx); }); }
/* analisi completa di una lista di relazioni: insieme, studi, caratteri dei punti critici */
function risolviRelazioni(rel, v){
  var studi = [], info = [];
  for(var i=0; i<rel.length; i++){
    var f = prova(function(){ return rSub(espressione(rel[i].sx), espressione(rel[i].dx)); });
    if(!f) return null;
    var lettere = pLettere(f.n).concat(pLettere(f.d));
    if(lettere.some(function(x){ return x !== v; })) return null;
    var s = prova(function(){ return studiaRelazione(f, rel[i].op, v); });
    if(!s) return null;
    studi.push(s);
    info.push({f:f, op:rel[i].op, gN:pUni(f.n, v).length-1, gD:pUni(f.d, v).length-1});
  }
  var S = insieme(studi), car = {int:0, rat:0, irr:0, den:1, max:0, rad:0};
  studi.forEach(function(s){ s.lista.forEach(function(p){
    var r = p.r; car.max = Math.max(car.max, Math.abs(r.v));
    if(r.tipo === "irr"){ car.irr++; car.rad = Math.max(car.rad, Number(r.r)); } else if(r.q.d === 1n) car.int++; else { car.rat++; car.den = Math.max(car.den, Number(r.q.d)); }
  }); });
  return {S:S, studi:studi, info:info, car:car};
}
/* sottodomande numeriche sull'insieme soluzione */
function sottodomanda(piano){
  if(/quant[ie] (numeri |zeri |valori |soluzioni )?inter/.test(piano)) return "conta";
  if(/(più piccolo|minimo|minore) (numero |valore )?intero/.test(piano)) return /positiv/.test(piano) ? "minpos" : "min";
  if(/(più grande|massimo|maggiore) (numero |valore )?intero/.test(piano)) return "max";
  if(/(soluzione|radice|zero) maggiore|maggiore (delle |fra le )?(soluzioni|radici)/.test(piano)) return "maggiore";
  if(/(soluzione|radice|zero) minore|minore (delle |fra le )?(soluzioni|radici)/.test(piano)) return "minore";
  if(/somma (delle |degli |dei )?(soluzioni|radici|zeri)/.test(piano)) return "somma";
  if(/quant[ie] (soluzioni|radici|zeri)/.test(piano)) return "numero";
  return null;
}
function valoreSotto(sd, S){
  var t = tipoInsieme(S), I;
  switch(sd){
    case "conta": I = interiDi(S); return I ? I.length : null;
    case "min": return interoEstremo(S, 1, false);
    case "minpos": return interoEstremo(S, 1, true);
    case "max": return interoEstremo(S, -1, false);
    case "maggiore": return t === "punti" ? S.punti[S.punti.length-1].v : null;
    case "minore": return t === "punti" ? S.punti[0].v : null;
    case "somma": return t === "punti" ? S.punti.reduce(function(a, r){ return a + r.v; }, 0) : null;
    case "numero": return t === "punti" ? S.punti.length : null;
  }
  return null;
}
function texRelazione(info, v, F){ // forma normale in LaTeX: N op 0 oppure N/D op 0
  var OPT = {">":">", "<":"<", "≥":"\\ge", "≤":"\\le", "=":"=", "≠":"\\neq"};
  return F + " " + OPT[info.op] + " 0";
}
function opTex(op){ return {">":">", "<":"<", "≥":"\\ge", "≤":"\\le", "=":"=", "≠":"\\neq"}[op]; }
function opInverso(op){ return {">":"<", "<":">", "≥":"≤", "≤":"≥", "=":"=", "≠":"≠"}[op]; }
/* spiegazione e guida di una risoluzione */
function spiegaRisolvi(A, v, fine){
  var passi = [], guida = [];
  function intera(c){ var p = primitivo(c); if(qCmp(p.k, Q0) < 0) p = {z:p.z.map(function(x){ return -x; }), k:qNeg(p.k)}; return p; }
  if(A.info.length === 1){
    var I = A.info[0], cn = pUni(I.f.n, v), op = I.op;
    if(I.gD === 0 && I.gN === 1){
      var Nk = intera(cn), aa = Q(Nk.z[0]), bb = Q(Nk.z[1]);
      passi.push("Porto tutti i termini al primo membro e riduco: $" + polTex(pDaUni([aa, bb], v)) + " " + opTex(op) + " 0$, cioè $" + polTex(pDaUni([aa], v)) + v + " " + opTex(op) + " " + qTex(qNeg(bb)) + "$.");
      guida.push({s:"Porta i termini con la " + v + " al primo membro e i numeri al secondo, poi riduci i termini simili.", r:"$" + (qEq(aa, Q1) ? "" : qEq(aa, Q(-1)) ? "-" : qTex(aa)) + v + " " + opTex(op) + " " + qTex(qNeg(bb)) + "$", k:[qTxt(qNeg(bb))]});
      var val = qDiv(qNeg(bb), aa), neg = qCmp(aa, Q0) < 0, op3 = neg ? opInverso(op) : op;
      if(!qEq(aa, Q1)){
        passi.push("Divido entrambi i membri per $" + qTex(aa) + "$" + (neg && op !== "=" ? ", numero negativo, quindi il verso si inverte" : "") + ": $" + v + " " + opTex(op3) + " " + qTex(val) + "$.");
        guida.push({s:"Dividi per il coefficiente della " + v + (op !== "=" ? "; se è negativo il verso cambia." : "."), r:"$" + v + " " + opTex(op3) + " " + qTex(val) + "$", k:[qTxt(val)]});
      }
    } else if(I.gD === 0 && I.gN === 2){
      var N = intera(cn), A2 = N.z[0], B2 = N.z[1], C2 = N.z[2], op4 = op;
      passi.push("Porto tutto al primo membro e riduco a forma normale: $" + polTex(pDaUni([Q(A2), Q(B2), Q(C2)], v)) + " " + opTex(op) + " 0$.");
      if(A2 < 0n){ A2 = -A2; B2 = -B2; C2 = -C2; op4 = opInverso(op); passi.push("Il coefficiente di $" + v + "^2$ è negativo: moltiplico per $-1$ e cambio il verso, $" + polTex(pDaUni([Q(A2), Q(B2), Q(C2)], v)) + " " + opTex(op4) + " 0$."); }
      var D = B2*B2 - 4n*A2*C2;
      guida.push({s:"Porta tutto al primo membro, riduci a forma normale (con il coefficiente di " + v + "² positivo) e calcola il discriminante.", r:"$" + polTex(pDaUni([Q(A2), Q(B2), Q(C2)], v)) + " " + opTex(op4) + " 0$, $\\Delta = " + D + "$", k:[String(D)]});
      passi.push("Discriminante: $\\Delta = b^2-4ac = " + D + "$" + (D > 0n ? ", positivo" : D === 0n ? ", nullo" : ", negativo") + ".");
      var z = zeriUni([Q(A2), Q(B2), Q(C2)]) || [];
      if(z.length){
        var zt = z.map(function(x){ return radTex(x.r); });
        passi.push(z.length === 1 ? "Lo zero (doppio) del trinomio è $" + v + " = " + zt[0] + "$." : "Gli zeri del trinomio sono $" + v + "_1 = " + zt[0] + "$ e $" + v + "_2 = " + zt[1] + "$.");
        guida.push({s:"Trova gli zeri dell'equazione associata.", r:z.length === 1 ? "$" + v + " = " + zt[0] + "$ (zero doppio)" : "$" + v + "_1 = " + zt[0] + "$, $" + v + "_2 = " + zt[1] + "$", k:z.map(function(x){ return radTxt(x.r); })});
      } else guida.push({s:"Che cosa dice il discriminante negativo sul segno del trinomio?", r:"Con $\\Delta < 0$ il trinomio non si annulla e ha sempre il segno del primo coefficiente, cioè è sempre positivo.", k:["positiv","sempre"]});
      if(op4 !== "="){
        if(D > 0n) passi.push("Con il primo coefficiente positivo il trinomio è negativo fra gli zeri e positivo all'esterno: " + (op4 === "<" || op4 === "≤" ? "servono i valori interni" : "servono i valori esterni") + (op4 === "≤" || op4 === "≥" ? ", zeri compresi." : ", zeri esclusi."));
        else if(D === 0n) passi.push("Il trinomio è un quadrato: positivo ovunque tranne nello zero, dove vale $0$.");
        else passi.push("Con $\\Delta < 0$ il trinomio è sempre positivo.");
      }
    } else {
      var Ff = fattoriDi(pUni(I.f.n, v), v), Fd = fattoriDi(pUni(I.f.d, v), v);
      var nt = Ff ? scomposizioneTesto(Ff, v, true) : polTex(I.f.n), dt = I.gD > 0 && Fd ? scomposizioneTesto(Fd, v, true) : null;
      var F = dt ? "\\dfrac{" + nt + "}{" + dt + "}" : nt;
      passi.push((dt ? "Porto tutto al primo membro, scrivo un'unica frazione e scompongo numeratore e denominatore: " : "Porto tutto al primo membro e scompongo in fattori: ") + "$" + texRelazione(I, v, F) + "$.");
      guida.push({s:dt ? "Porta tutto al primo membro, scrivi un'unica frazione confrontata con 0 e scomponi numeratore e denominatore." : "Porta tutto al primo membro e scomponi in fattori il polinomio.", r:"$" + texRelazione(I, v, F) + "$", k:[]});
      if(dt){
        var zd = (zeriUni(pUni(I.f.d, v)) || []).map(function(x){ return radTex(x.r); });
        passi.push("Condizione di esistenza: il denominatore non si annulla, $" + zd.map(function(t){ return v + " \\neq " + t; }).join(",\\ ") + "$.");
        guida.push({s:"Scrivi la condizione di esistenza.", r:"$" + zd.map(function(t){ return v + " \\neq " + t; }).join(",\\ ") + "$", k:zd.map(function(t){ return t.replace(/\\dfrac\{(\d+)\}\{(\d+)\}/, "$1/$2"); })});
      }
      if(op !== "=") passi.push("Studio il segno di ogni fattore e lo riporto nello schema dei segni; prendo gli intervalli con il segno richiesto" + (op === "≥" || op === "≤" ? ", compresi gli zeri del numeratore" : "") + (dt ? " ed escludo gli zeri del denominatore." : "."));
      else passi.push("Per la legge di annullamento del prodotto le soluzioni sono gli zeri dei fattori" + (dt ? " che non annullano il denominatore." : "."));
    }
  } else {
    passi.push("Risolvo una alla volta le disequazioni del sistema:");
    A.studi.forEach(function(s, i){
      var Si = insieme([s]);
      passi.push("la " + (i+1) + "ª dà $" + insiemeTesto(Si, v, true) + "$;");
    });
    guida.push({s:"Risolvi ciascuna disequazione del sistema.", r:A.studi.map(function(s){ return "$" + insiemeTesto(insieme([s]), v, true) + "$"; }).join("; "), k:[]});
    passi.push("poi prendo la parte comune, cioè le soluzioni di tutte le disequazioni insieme.");
  }
  passi.push(fine.spieg);
  guida.push(fine.guida);
  return {spieg:passi.join(" "), guida:guida.slice(-6)};
}

/* ================= 10. registro delle famiglie ================= */
var FAMIGLIE = [];
function famiglia(def){ FAMIGLIE.push(def); }
function contesto(item){
  var q = String(item.q || "");
  var segs = segmentiDi(q);
  var piano = testoPiano(q.replace(/\$[^$]+\$/g, " § ")).toLowerCase();
  segs.forEach(function(sg){ sg.r = prova(function(){ return relazioniDi(sg.tex); }); sg.cifre = haCifreLibere(sg.tex); });
  var libero = item.tipo !== "scelta" && !item.num && !(Array.isArray(item.sol) && item.sol.length);
  return {item:item, q:q, segs:segs, piano:piano, libero:libero};
}
/* segmenti con numeri che non appartengono al compito: si aggiornano se contengono un lato
   dell'espressione principale (es. «la parabola $y=-x^2+4x$» e «$-x^2+4x>0$»), altrimenti no */
function collegati(ctx, principali){
  var lati = [];
  principali.forEach(function(sg){ var l = latiTex(sg.tex); if(l) lati = lati.concat(l.map(function(x){ return {sg:sg, i:l.indexOf(x), t:x}; })); else lati.push({sg:sg, i:-1, t:sg.tex}); });
  var out = [];
  for(var k=0; k<ctx.segs.length; k++){
    var sg = ctx.segs[k];
    if(principali.indexOf(sg) >= 0 || !sg.cifre) continue;
    var trovato = lati.filter(function(l){ return l.t.length >= 2 && /\d/.test(l.t) && sg.tex.indexOf(l.t) >= 0; })[0];
    if(!trovato) return null;
    out.push({k:k, lato:trovato});
  }
  return out;
}
function aggiornaCollegati(ctx, coll, nuoviTex){ // nuoviTex: {indice segmento principale: tex nuovo}
  var nuovi = {};
  coll.forEach(function(c){
    var vecchio = c.lato.sg.tex, nuovo = nuoviTex[ctx.segs.indexOf(c.lato.sg)];
    var lv = latiTex(vecchio), ln = latiTex(nuovo);
    var da = c.lato.t, a = c.lato.i >= 0 && ln ? ln[c.lato.i] : nuovo;
    if(lv && !ln) a = nuovo;
    nuovi[c.k] = ctx.segs[c.k].tex.split(da).join(a);
  });
  return nuovi;
}
function nuovoTesto(ctx, nuovi){
  var arr = ctx.segs.map(function(sg, k){ return nuovi[k] != null ? nuovi[k] : null; });
  return ricomponi(ctx.q, ctx.segs, arr);
}
/* esercizio finale: testo, risposta, spiegazione e guida ripuliti */
function esercizio(o){
  var it = {q:sanifica(o.q), tipo:o.tipo};
  if(o.tipo === "scelta"){ it.opz = o.opz.map(sanifica); it.ok = o.ok; }
  else { if(o.num) it.num = o.num; it.sol = o.sol.filter(function(x, i){ return x && o.sol.indexOf(x) === i; }); }
  it.spieg = sanifica(o.spieg);
  it.guida = o.guida.filter(Boolean).map(function(p){ return {s:sanifica(p.s), r:sanifica(p.r), k:(p.k||[]).map(String).filter(Boolean).slice(0, 3)}; });
  if(o.grafico) it.grafico = o.grafico;
  it.generato = o.famiglia;
  return it;
}
/* distrattori per un insieme di soluzioni */
function trasla(S, k){
  if(S.punti.some(function(r){ return r.tipo !== "q"; })) return null;
  return {punti:S.punti.map(function(r){ return radQ(qAdd(r.q, Q(k))); }), inP:S.inP, inI:S.inI};
}
function distrattoriInsieme(S, extra){
  var t = tipoInsieme(S), cand = [complemento(S), bordiScambiati(S), specchia(S), soloPrimo(S), trasla(S, 1), trasla(S, -1)];
  var vuoto = {punti:[], inP:[], inI:[false]}, tutto = {punti:[], inP:[], inI:[true]};
  if(t === "vuoto" || t === "tutto" || t === "tranne" || t === "punti") cand = cand.concat([vuoto, tutto]);
  if(S.punti.length === 1){
    var p = S.punti[0];
    cand = cand.concat([insiemeDaPezzo({da:p, a:null, daC:false}), insiemeDaPezzo({da:null, a:p, aC:false}), insiemeDaPezzo({da:p, a:p}), {punti:[p], inP:[false], inI:[true, true]}]);
  }
  (extra || []).forEach(function(p){
    cand.push(insiemeDaPezzo({da:p, a:null, daC:false}), {punti:[p], inP:[false], inI:[true, true]}, insiemeDaPezzo({da:null, a:p, aC:false}), insiemeDaPezzo({da:p, a:p}));
  });
  var visti = [chiaveInsieme(canonico(S))], out = [];
  cand.forEach(function(D){ if(!D) return; D = canonico(D); var k = chiaveInsieme(D); if(visti.indexOf(k) < 0){ visti.push(k); out.push(D); } });
  return out;
}
function intervalloX(punti){
  if(!punti.length) return [-5, 5];
  var a = Math.floor(punti[0].v) - 2, b = Math.ceil(punti[punti.length-1].v) + 2;
  if(b - a < 6){ var c = (a + b)/2; a = Math.floor(c - 3); b = Math.ceil(c + 3); }
  return [a, b];
}

/* ---------- risolvi ---------- */
famiglia({id:"risolvi", nome:"Equazioni e disequazioni", ordine:5, prova:function(ctx){
  var it = ctx.item, p = ctx.piano;
  var cand = ctx.segs.filter(function(sg){ return sg.r && !eDefinizione(sg.r.rel) && !eAssegnazione(sg.r.rel); });
  var main, relDi;
  if(cand.length === 1){ main = cand[0]; relDi = function(tex){ var r = relazioniDi(tex); return r ? r.rel : null; }; }
  else if(!cand.length){
    var es = ctx.segs.filter(function(sg){ return !sg.r && sg.cifre && parseSicuro(daLatex(sg.tex)); });
    var op = /non negativ/.test(p) ? "≥" : /non positiv/.test(p) ? "≤" : /positiv/.test(p) ? ">" : /negativ/.test(p) ? "<" : /\b(zeri|radici|soluzioni)\b/.test(p) && !/scompon/.test(p) ? "=" : null;
    if(es.length !== 1 || !op) return null;
    main = es[0];
    relDi = function(tex){ return [{sx:daLatex(tex).replace(/^\s*[A-Za-z]\([a-z]\)\s*=/, ""), op:op, dx:"0"}]; };
  } else return null;
  var rel = relDi(main.tex); if(!rel) return null;
  var v = letteraUnica(rel.map(function(r){ return r.sx + r.dx; })); if(!v) return null;
  var A = risolviRelazioni(rel, v); if(!A) return null;
  var sd = sottodomanda(p);
  // la risposta ricalcolata deve coincidere con quella dichiarata (se c'è)
  if(ctx.libero){ if(sd && valoreSotto(sd, A.S) == null) return null; it = {q:it.q, tipo:"aperta", num:sd ? {v:0, tol:0} : null}; }
  else if(it.tipo === "scelta"){
    if(sd) return null;
    var giuste = it.opz.map(function(o){ return stessoInsieme(A.S, leggiInsieme(testoOpzione(o), v)); });
    if(!giuste[it.ok] || giuste.filter(Boolean).length !== 1) return null;
  } else if(it.num){
    if(!sd && !(tipoInsieme(A.S) === "punti" && A.S.punti.length === 1)) return null;
    var val = sd ? valoreSotto(sd, A.S) : A.S.punti[0].v;
    if(val == null || !numOk(it, val)) return null;
    if(!sd) sd = "unica";
  } else {
    if(sd) return null;
    var ok = accettata(it, variantiInsieme(A.S, v)) || stessoInsieme(A.S, leggiInsieme(it.sol && it.sol[0] || "", v));
    if(!ok) return null;
  }
  var coll = collegati(ctx, [main]); if(!coll) return null;
  // figura: schema dei segni o grafico delle funzioni del testo
  var g = it.grafico, rifaiGrafico = null;
  if(g){
    if(Array.isArray(g)) return null;
    var tipo = g.tipo || "grafico";
    if(tipo === "segni"){
      rifaiGrafico = function(B, rel2){
        var spec = {}; for(var k in g) spec[k] = g[k];
        if(g.sistema){ spec.sistema = rel2.map(function(r){ return r.sx + " " + {"≥":">=", "≤":"<="}[r.op] || r.op; }); spec.sistema = rel2.map(function(r){ return r.sx + " " + ({"≥":">=", "≤":"<="}[r.op] || r.op) + " " + r.dx; }); return spec; }
        var I = B.info[0];
        if((g.num || []).length > 1){
          var Fn = fattoriDi(pUni(I.f.n, v), v); if(!Fn) return null;
          spec.num = []; if(qCmp(Fn.k, Q0) < 0) spec.num.push("-1");
          if(Fn.m) spec.num.push(Fn.m > 1 ? v + "^" + Fn.m : v);
          Fn.fatt.forEach(function(x){ for(var u=0; u<x.molt; u++) spec.num.push(polTesto(x.p)); });
        } else spec.num = [polTesto(I.f.n)];
        spec.den = I.gD > 0 ? ((g.den || []).length > 1 ? (fattoriDi(pUni(I.f.d, v), v) || {fatt:[]}).fatt.map(function(x){ return polTesto(x.p); }) : [polTesto(I.f.d)]) : [];
        return spec;
      };
      if(!g.sistema && A.info.length !== 1) return null;
    } else if(tipo === "grafico" && Array.isArray(g.serie)){
      var latiV = latiTex(main.tex) || [main.tex];
      var pol = latiV.map(function(l){ return polinomioDi(daLatex(l)); });
      var mappa = g.serie.map(function(s){
        if(s.f == null) return -1;
        var ps = polinomioDi(String(s.f).replace(/^[^=]*=/, ""));
        if(!ps) return -1;
        for(var i=0; i<pol.length; i++) if(pol[i] && pUguali(pol[i], ps)) return i;
        var tot = rPolinomio(A.info[0].f); if(tot && pUguali(tot, ps)) return 99;
        return -1;
      });
      if(mappa.indexOf(-1) >= 0) return null;
      rifaiGrafico = function(B, rel2, texN){
        var ln = latiTex(texN) || [texN];
        var spec = {}; for(var k in g) if(k !== "y") spec[k] = g[k];
        spec.serie = g.serie.map(function(s, i){ var c = {}; for(var k2 in s) c[k2] = s[k2]; var pp = mappa[i] === 99 ? rPolinomio(B.info[0].f) : polinomioDi(daLatex(ln[mappa[i]])); c.f = polTesto(pp); return c; });
        spec.x = intervalloX(B.studi.reduce(function(a, s){ return a.concat(s.lista.map(function(x){ return x.r; })); }, []).sort(function(a, b){ return a.v - b.v; }));
        return spec;
      };
    } else return null;
  }
  var firmaA = firmaInsieme(A.S) + "|" + A.info.map(function(i){ return i.gN + "/" + i.gD + i.op; }).join(",") + "|" + A.car.int + "," + A.car.rat + "," + A.car.irr;
  var maxDen = Math.max(A.car.den, A.car.rat ? 6 : 1), maxV = Math.max(15, A.car.max * 1.6);
  var valA = sd && sd !== "unica" ? valoreSotto(sd, A.S) : null;
  // per i polinomi di grado alto scritti per esteso («P op 0» oppure solo «P») si costruisce il
  // polinomio dagli zeri, perché cambiando i numeri a caso quasi mai gli zeri restano razionali
  var costruttivo = null, I0 = A.info[0];
  if(A.info.length === 1 && I0.gD === 0 && I0.gN >= 3 && !/[()]/.test(daLatex(main.tex))){
    var lati0 = latiTex(main.tex);
    if(!lati0 || (lati0.length === 2 && daLatex(lati0[1]).trim() === "0")){
      var cP = pUni(I0.f.n, v), cresc = crescenteTex(lati0 ? lati0[0] : main.tex);
      costruttivo = function(rng, scala){
        var c2 = polinomioSimile(cP.map(function(q){ return q; }), rng, scala); if(!c2) return null;
        var pt = polTex(pDaUni(c2, "x"), cresc).replace(/x/g, v);
        return lati0 ? pt + " " + main.tex.slice(main.tex.indexOf(lati0[0]) + lati0[0].length).replace(/^\s*/, "").replace(/0\s*$/, "0").replace(/^(\\[a-z]+|[<>=≤≥])\s*/, function(m){ return m.trim() + " "; }) : pt;
      };
    }
  }
  return {famiglia:"risolvi", genera:function(rng, scala){
    for(var t=0; t<(costruttivo ? 900 : 500); t++){
      var texN = costruttivo && t >= 150 ? costruttivo(rng, scala) : cambiaNumeri(main.tex, rng, scala);
      if(!texN || texN === main.tex) continue;
      var rel2 = prova(function(){ return relDi(texN); }); if(!rel2) continue;
      var B = risolviRelazioni(rel2, v); if(!B) continue;
      var firmaB = firmaInsieme(B.S) + "|" + B.info.map(function(i){ return i.gN + "/" + i.gD + i.op; }).join(",") + "|" + B.car.int + "," + B.car.rat + "," + B.car.irr;
      if(firmaB !== firmaA || B.car.den > maxDen || B.car.max > maxV || B.car.rad > Math.max(A.car.rad, 13)) continue;
      var valB = null;
      if(sd && sd !== "unica"){ valB = valoreSotto(sd, B.S); if(valB == null) continue; if(sd === "conta" && (valB < 1 || valB > 25)) continue; if(Math.abs(valB) > Math.max(30, Math.abs(valA||0)*3)) continue; }
      if(sd === "unica"){ valB = B.S.punti[0].v; if(B.S.punti[0].tipo !== "q" || (qIntero(B.S.punti[0].q) !== qIntero(A.S.punti[0].q) && !qDecimale(B.S.punti[0].q))) continue; }
      var gN = null;
      if(rifaiGrafico){ gN = prova(function(){ return rifaiGrafico(B, rel2, texN); }); if(!gN || (window.Laboratorio && window.Laboratorio.controlla(gN).length)) continue; }
      var idx = ctx.segs.indexOf(main), mappaTex = {}; mappaTex[idx] = texN;
      var nuovi = aggiornaCollegati(ctx, coll, mappaTex); nuovi[idx] = texN;
      var q2 = nuovoTesto(ctx, nuovi);
      var o = {q:q2, tipo:it.tipo, famiglia:"risolvi", grafico:gN};
      var irr = B.S.punti.some(function(r){ return r.tipo === "irr"; });
      var fine;
      if(it.tipo === "scelta"){
        var extra = [];
        if(B.info.length === 1 && B.info[0].gD === 0 && B.info[0].gN === 2){ var cq = pUni(B.info[0].f.n, v); extra.push(radQ(qDiv(qNeg(cq[1]), qMul(Q(2), cq[0])))); }
        extra.push(radQ(Q0), radQ(Q1));
        var dis = distrattoriInsieme(B.S, extra).map(function(D){ return insiemeOpzione(D, v); });
        if(dis.length < 3) continue;
        var oz = opzioni(insiemeOpzione(B.S, v), dis, rng); o.opz = oz.opz; o.ok = oz.ok;
        fine = {spieg:"La soluzione è " + oz.opz[oz.ok] + ".", guida:{s:"Scrivi la soluzione e scegli l'opzione corrispondente.", r:oz.opz[oz.ok], k:B.S.punti.slice(0, 2).map(radTxt)}};
      } else if(it.num){
        var n = Math.round(valB*1e6)/1e6, testoN = testoNumero(n);
        o.num = {v:n, tol:it.num.tol || 0}; if(it.num.u) o.num.u = it.num.u; o.sol = [testoN];
        var det = sd === "conta" ? "Gli interi dell'insieme sono " + interiDi(B.S).join(", ") + ": sono " + testoN + "." : sd === "unica" ? "La soluzione è $" + v + " = " + radTex(B.S.punti[0]) + "$." : "Insieme delle soluzioni: $" + insiemeTesto(B.S, v, true) + "$; la risposta è " + testoN + ".";
        fine = {spieg:det, guida:{s:"Dalle soluzioni ricava il numero richiesto.", r:det, k:[testoN]}};
      } else {
        o.sol = variantiInsieme(B.S, v);
        var tex = insiemeTesto(B.S, v, true), tt = tipoInsieme(B.S);
        var frase = tt === "vuoto" ? "nessuna soluzione" : tt === "tutto" ? "per ogni $" + v + "$ reale" : irr ? o.sol[0] : "$" + tex + "$";
        fine = {spieg:"Soluzione: " + frase + ".", guida:{s:"Scrivi l'insieme delle soluzioni.", r:frase, k:B.S.punti.slice(0, 2).map(radTxt)}};
      }
      var sp = spiegaRisolvi(B, v, fine);
      o.spieg = sp.spieg; o.guida = sp.guida;
      if(o.guida.length < 2) o.guida.unshift({s:"Porta tutti i termini al primo membro e riduci.", r:"$" + polTex(B.info[0].f.n) + " " + opTex(B.info[0].op) + " 0$", k:[]});
      return esercizio(o);
    }
    return null;
  }};
}});

/* polinomio con la stessa struttura di zeri e fattori (zeri interi o frazionari, molteplicità,
   fattori di secondo grado irriducibili) e, se possibile, con gli stessi termini mancanti */
function intCasuale(rng, a, b){ return a + Math.floor(rng() * (b - a + 1)); }
function polinomioSimile(c, rng, scala){
  var F = scomponiUni(c); if(F.resto) return null;
  var zp = c.map(qZero), orig = c.map(qTxt).join(",");
  for(var t=0; t<3000; t++){
    var k = F.k;
    if(qIntero(k) && (k.n > 1n || k.n < -1n)){ var kk = BigInt(intCasuale(rng, 2, Math.max(5, Number(k.n < 0n ? -k.n : k.n)))); k = Q(k.n < 0n ? -kk : kk); }
    var P = pCost(k), usati = {};
    if(F.m) P = pMul(P, pPow(pVar("x"), F.m));
    var ok = true;
    F.lin.forEach(function(l){
      if(!ok) return;
      var q = l.q === 1n ? 1n : BigInt(intCasuale(rng, 2, Math.max(3, Number(l.q)))), p, prove = 0;
      do {
        var M = Math.round(Math.max(5, Math.abs(Number(l.p)) + 2) * (scala || 1));
        p = BigInt(intCasuale(rng, 1, M)) * (l.p < 0n ? -1n : 1n);
        prove++;
      } while((mcdB(p, q) !== 1n || usati[p + "/" + q] || (p === 0n)) && prove < 30);
      if(prove >= 30){ ok = false; return; }
      usati[p + "/" + q] = 1;
      P = pMul(P, pPow(pDaUni([Q(q), Q(-p)], "x"), l.molt));
    });
    if(!ok) continue;
    F.quad.forEach(function(x){
      var A = x.A, B, C;
      if(x.B === 0n){
        var neg = x.C < 0n;
        for(var u=0; u<20; u++){ C = BigInt(intCasuale(rng, 1, Math.max(9, Number(neg ? -x.C : x.C) + 4))); if(!neg || liberoQuadrati(C*A).r !== 1n) break; }
        B = 0n; if(neg) C = -C;
      } else {
        var Dneg = x.B*x.B - 4n*x.A*x.C < 0n;
        for(var w=0; w<40; w++){
          B = BigInt(intCasuale(rng, 1, 9)) * (x.B < 0n ? -1n : 1n); C = BigInt(intCasuale(rng, 1, 12)) * (x.C < 0n ? -1n : 1n);
          var D = B*B - 4n*A*C;
          if(Dneg ? D < 0n : (D > 0n && liberoQuadrati(D).r !== 1n)) break;
        }
      }
      P = pMul(P, pPow(pDaUni([Q(A), Q(B), Q(C)], "x"), x.molt));
    });
    var c2 = pUni(P, "x");
    if(c2.length !== c.length) continue;
    if(t < 2000 && c2.some(function(q, i){ return qZero(q) !== zp[i]; })) continue;
    if(c2.some(function(q){ return Math.abs(qNum(q)) > 400; })) continue;
    if(c2.map(qTxt).join(",") === orig) continue;
    return c2;
  }
  return null;
}
/* il testo LaTeX di un polinomio scritto nello stesso ordine dell'originale */
function crescenteTex(tex){
  var p = polinomioDi(daLatex(tex)); if(!p) return false;
  var ks = Object.keys(p); if(ks.length < 2) return false;
  var primo = /^\s*-?\s*(\d+)?\s*([a-zA-Z])?/.exec(daLatex(tex));
  return !!(primo && primo[1] && !primo[2]);
}

/* ================= 11. altre famiglie algebriche ================= */
/* testo LaTeX di un albero (per mostrare i passaggi) */
function alberoTex(n){
  switch(n.k){
    case "num": return qTex(n.v);
    case "var": return n.v;
    case "par": return "(" + alberoTex(n.n) + ")";
    case "neg": return "-" + alberoTex(n.n);
    case "som": return n.a.map(function(x, i){ var t = alberoTex(x.n); return (x.s < 0 ? "-" : i ? "+" : "") + t; }).join("");
    case "pro": var a = alberoTex(n.a), b = alberoTex(n.b); return a + (/^[\d]/.test(b) || n.b.k === "num" ? "\\cdot " : "") + b;
    case "div": return n.due ? alberoTex(n.a) + ":" + alberoTex(n.b) : "\\dfrac{" + alberoTex(n.a).replace(/^\((.*)\)$/, "$1") + "}{" + alberoTex(n.b).replace(/^\((.*)\)$/, "$1") + "}";
    case "pot": return alberoTex(n.b) + "^{" + n.e + "}";
  }
  return "";
}
function polDi(n){ var r = valutaAlbero(n), p = rPolinomio(r); return p; }
function texPol(p){ return polTex(p); }
function cambiaEsponenti(tex, rng){
  var out = "", p = 0, re = /\^\{?(\d+)\}?/g, m;
  while((m = re.exec(tex))){ var e = intCasuale(rng, 2, Math.max(5, +m[1] + 2)); out += tex.slice(p, m.index) + "^" + (e > 9 ? "{" + e + "}" : e); p = m.index + m[0].length; }
  return out + tex.slice(p);
}
/* il segmento «principale» del compito: l'unico con numeri o lettere, senza relazioni */
function segmentiEspressione(ctx){
  return ctx.segs.filter(function(sg){
    if(sg.r && !eDefinizione(sg.r.rel)) return false;
    var plain = daLatex(sg.tex);
    if(sg.r) plain = sg.r.rel[0].dx;
    return /[a-zA-Z]/.test(plain) && !!parseSicuro(plain);
  });
}
function espressioneDi(sg){ return sg.r ? sg.r.rel[0].dx : daLatex(sg.tex); }
function texInterno(sg){ // la parte dopo «f(x)=» in una definizione
  if(!sg.r) return sg.tex;
  var l = latiTex(sg.tex); return l ? l[l.length-1] : sg.tex;
}
function rimpiazzaInterno(sg, nuovo){ if(!sg.r) return nuovo; var vecchio = texInterno(sg); return sg.tex.slice(0, sg.tex.lastIndexOf(vecchio)) + nuovo; }

/* ---------- esistenza ---------- */
famiglia({id:"esistenza", nome:"Condizione di esistenza", ordine:1, prova:function(ctx){
  var it = ctx.item;
  if(!/condizion[ei] di esistenza|dominio|valor[ei] esclus|campo di esistenza/.test(ctx.piano)) return null;
  var es = segmentiEspressione(ctx); if(es.length !== 1) return null;
  var sg = es[0], expr = espressioneDi(sg), v = letteraUnica([expr]); if(!v) return null;
  function studia(testo){
    var r = parseSicuro(testo); if(!r || pCostante(r.d)) return null;
    var z = zeriUni(pUni(r.d, v)); if(!z || !z.length) return null;
    return {z:z, S:{punti:z.map(function(x){ return x.r; }), inP:z.map(function(){ return false; }), inI:z.map(function(){ return true; }).concat([true])}};
  }
  var A = studia(expr); if(!A) return null;
  if(ctx.libero) it = {q:it.q, tipo:"aperta"};
  else if(it.num){ if(A.z.length !== 1 || !numOk(it, A.z[0].r.v)) return null; }
  else if(it.tipo === "scelta") return null;
  else if(!(accettata(it, variantiInsieme(A.S, v)) || stessoInsieme(A.S, leggiInsieme(it.sol[0] || "", v)))) return null;
  var firma = A.z.map(function(x){ return x.r.tipo === "q" ? (qIntero(x.r.q) ? "i" : "r") : "s"; }).join("");
  var coll = collegati(ctx, [sg]); if(!coll) return null;
  return {famiglia:"esistenza", genera:function(rng, scala){
    for(var t=0; t<400; t++){
      var interno = cambiaNumeri(texInterno(sg), rng, scala), texN = rimpiazzaInterno(sg, interno);
      if(texN === sg.tex) continue;
      var B = studia(sg.r ? latiTex(texN).slice(-1)[0] && daLatex(latiTex(texN).slice(-1)[0]) : daLatex(texN)); if(!B) continue;
      var f2 = B.z.map(function(x){ return x.r.tipo === "q" ? (qIntero(x.r.q) ? "i" : "r") : "s"; }).join("");
      if(f2 !== firma || B.z.some(function(x){ return Math.abs(x.r.v) > 20; })) continue;
      var idx = ctx.segs.indexOf(sg), m = {}; m[idx] = texN;
      var nuovi = aggiornaCollegati(ctx, coll, m); nuovi[idx] = texN;
      var r = parseSicuro(daLatex(texInterno({tex:texN, r:sg.r ? relazioniDi(texN) : null})));
      var Dtex = polTex(r.d), zt = B.z.map(function(x){ return radTex(x.r); });
      var o = {q:nuovoTesto(ctx, nuovi), tipo:"aperta", famiglia:"esistenza"};
      var ce = zt.map(function(z){ return v + " \\neq " + z; }).join(",\\ ");
      if(it.num){ var val = Math.round(B.z[0].r.v*1e6)/1e6; o.num = {v:val, tol:it.num.tol || 0}; o.sol = [testoNumero(val)]; }
      else { o.sol = variantiInsieme(B.S, v); if(B.z.length === 2){ var a = radTxt(B.z[0].r), b = radTxt(B.z[1].r); o.sol.push(v + " ≠ " + a + " e " + v + " ≠ " + b, v + " ≠ " + b + " e " + v + " ≠ " + a); } }
      o.spieg = "Una frazione esiste quando il denominatore non si annulla: $" + Dtex + " \\neq 0$. Gli zeri del denominatore sono " + zt.map(function(z){ return "$" + z + "$"; }).join(" e ") + ", quindi la condizione di esistenza è $" + ce + "$.";
      o.guida = [{s:"Scrivi la condizione che il denominatore deve rispettare.", r:"$" + Dtex + " \\neq 0$", k:["≠0", "!=0"]},
                 {s:"Trova i valori che annullano il denominatore.", r:zt.map(function(z){ return "$" + v + " = " + z + "$"; }).join(", "), k:B.z.map(function(x){ return radTxt(x.r); })},
                 {s:it.num ? "Scrivi il valore escluso." : "Scrivi la condizione di esistenza.", r:it.num ? "Il valore escluso è " + o.sol[0] : "$" + ce + "$", k:B.z.map(function(x){ return radTxt(x.r); })}];
      return esercizio(o);
    }
    return null;
  }};
}});

/* ---------- delta ---------- */
famiglia({id:"delta", nome:"Discriminante", ordine:2, prova:function(ctx){
  var it = ctx.item;
  if(!/discriminante/.test(ctx.piano) || !(it.num || ctx.libero)) return null;
  var es = segmentiEspressione(ctx); if(es.length !== 1) return null;
  var sg = es[0], v = letteraUnica([espressioneDi(sg)]); if(!v) return null;
  function delta(testo){ var p = polinomioDi(testo); if(!p) return null; var c = pUni(p, v); if(c.length !== 3) return null; return {c:c, D:qSub(qMul(c[1], c[1]), qMul(Q(4), qMul(c[0], c[2])))}; }
  var A = delta(espressioneDi(sg)); if(!A || (!ctx.libero && !numOk(it, qNum(A.D)))) return null;
  function classe(D){ var s = qCmp(D, Q0); if(s <= 0 || !qIntero(D)) return String(s); var r = liberoQuadrati(D.n); return r.r === 1n ? "q" : "1"; }
  var cl = classe(A.D);
  return {famiglia:"delta", genera:function(rng, scala){
    for(var t=0; t<400; t++){
      var interno = cambiaNumeri(texInterno(sg), rng, scala), texN = rimpiazzaInterno(sg, interno);
      if(texN === sg.tex) continue;
      var B = delta(daLatex(interno)); if(!B || classe(B.D) !== cl || Math.abs(qNum(B.D)) > 300) continue;
      var nuovi = {}; nuovi[ctx.segs.indexOf(sg)] = texN;
      var a = B.c[0], b = B.c[1], c = B.c[2], D = qNum(B.D);
      var par = function(q){ return qCmp(q, Q0) < 0 ? "(" + qTex(q) + ")" : qTex(q); };
      var o = {q:nuovoTesto(ctx, nuovi), tipo:"aperta", famiglia:"delta", num:{v:D, tol:0}, sol:[testoNumero(D)]};
      o.spieg = "Il discriminante è $\\Delta = b^2-4ac$ con $a=" + qTex(a) + "$, $b=" + qTex(b) + "$, $c=" + qTex(c) + "$: $\\Delta = " + par(b) + "^2-4\\cdot " + par(a) + "\\cdot " + par(c) + " = " + qTex(B.D) + "$" + (D > 0 ? ", positivo: l'equazione associata ha due soluzioni distinte." : D === 0 ? ": l'equazione associata ha una soluzione doppia." : ", negativo: l'equazione associata non ha soluzioni reali.");
      o.guida = [{s:"Scrivi la formula del discriminante.", r:"$\\Delta = b^2-4ac$", k:["b^2-4ac", "b²-4ac"]},
                 {s:"Individua i coefficienti a, b e c con il loro segno.", r:"$a=" + qTex(a) + "$, $b=" + qTex(b) + "$, $c=" + qTex(c) + "$", k:[qTxt(b), qTxt(c)]},
                 {s:"Sostituisci e calcola.", r:"$\\Delta = " + qTex(B.D) + "$", k:[qTxt(B.D)]}];
      return esercizio(o);
    }
    return null;
  }};
}});

/* ---------- sviluppa (calcolo letterale) ---------- */
function variantiPolinomio(p){ var a = polTesto(p), b = polTesto(p, {crescente:true}); return a === b ? [a] : [a, b]; }
function distrattoriPolinomio(p){
  var ks = terminiOrdinati(p), out = [];
  function con(k, f){ var q = {}; for(var x in p) q[x] = p[x]; f(q, k); return q; }
  if(ks.length >= 3) out.push(con(ks[1], function(q, k){ delete q[k]; }));
  if(ks.length >= 2) out.push(con(ks[ks.length-1], function(q, k){ q[k] = qNeg(q[k]); }));
  if(ks.length >= 2) out.push(con(ks[1], function(q, k){ q[k] = qMul(q[k], Q(2)); }));
  if(ks.length >= 2) out.push(con(ks[1], function(q, k){ q[k] = qNeg(q[k]); }));
  out.push(con(ks[0], function(q, k){ q[k] = qAdd(q[k], qCmp(q[k], Q0) > 0 ? Q1 : Q(-1)); }));
  out.push(con(ks[0], function(q, k){ q[k] = qNeg(q[k]); }));
  var visti = [polTesto(p)];
  return out.filter(function(q){ var t = polTesto(q); if(pNullo(q) || visti.indexOf(t) >= 0) return false; visti.push(t); return true; });
}
function passiSviluppo(albero){
  var top = albero.k === "par" ? albero.n : albero, passi = [];
  if(top.k === "som"){
    top.a.forEach(function(x){ var n = x.n; if(n.k === "pot" || n.k === "pro" || n.k === "par" || n.k === "div"){ var p = polDi(n); if(p) passi.push("$" + alberoTex(n) + " = " + polTex(p) + "$"); } });
    return {tipo:"somma", passi:passi};
  }
  if(top.k === "pot"){
    var base = polDi(top.b), ks = base ? terminiOrdinati(base) : [];
    if(ks.length === 2 && (top.e === 2 || top.e === 3)){
      var a = {}, b = {}; a[ks[0]] = base[ks[0]]; b[ks[1]] = base[ks[1]];
      if(top.e === 2) passi.push("È il quadrato di un binomio: $a^2+2ab+b^2$ con $a=" + polTex(a) + "$ e $b=" + polTex(b) + "$; quadrati $" + polTex(pPow(a, 2)) + "$ e $" + polTex(pPow(b, 2)) + "$, doppio prodotto $" + polTex(pScala(pMul(a, b), Q(2))) + "$.");
      else passi.push("È il cubo di un binomio: $a^3+3a^2b+3ab^2+b^3$ con $a=" + polTex(a) + "$ e $b=" + polTex(b) + "$.");
      return {tipo:"potenza", passi:passi};
    }
    if(ks.length === 1) return {tipo:"monomio", passi:["L'esponente esterno moltiplica gli esponenti di ogni lettera e si applica anche al coefficiente."]};
    return {tipo:"potenza", passi:["Sviluppo la potenza moltiplicando la base per sé stessa."]};
  }
  if(top.k === "pro"){
    var A = polDi(top.a), B = polDi(top.b);
    if(A && B && pTermini(A) === 1 && pTermini(B) === 1) return {tipo:"monomio", passi:["Moltiplico i coefficienti e sommo gli esponenti delle lettere uguali."]};
    if(A && B && pTermini(A) === 2 && pTermini(B) === 2 && pUguali(pMul(A, B), pAdd(pMul(pCostTermine(A, 0), pCostTermine(B, 0)), pMul(pCostTermine(A, 1), pCostTermine(B, 1))))) return {tipo:"prodotto", passi:["È una somma per differenza: il risultato è la differenza dei quadrati dei due termini."]};
    return {tipo:"prodotto", passi:["Moltiplico ogni termine del primo fattore per ogni termine del secondo e sommo i termini simili."]};
  }
  if(top.k === "div") return {tipo:"divisione", passi:["Divido i coefficienti e sottraggo gli esponenti delle lettere uguali."]};
  return {tipo:"altro", passi:[]};
}
function pCostTermine(p, i){ var ks = terminiOrdinati(p), q = {}; q[ks[i]] = p[ks[i]]; return q; }
famiglia({id:"sviluppa", nome:"Calcolo letterale", ordine:7, prova:function(ctx){
  var it = ctx.item, pi = ctx.piano;
  if(!/svilupp|semplific|calcol|svolg|esegui|riduci|prodotto|potenza|divisione|espressione|grado/.test(pi)) return null;
  if(/valore numerico|\bper\s+§/.test(pi)) return null;
  var es = ctx.segs.filter(function(sg){ return sg.cifre || /[a-zA-Z]/.test(sg.tex); });
  if(es.length !== 1 || es[0].r) return null;
  var sg = es[0], plain = daLatex(sg.tex);
  var albero = prova(function(){ return analizza(plain); }); if(!albero) return null;
  var p = polDi(albero); if(!p) return null;
  var grado = /grado/.test(pi);
  if(ctx.libero){ if(grado && pTermini(p) !== 1) return null; it = {q:it.q, tipo:"aperta", num:grado || pCostante(p) ? {v:0, tol:0} : null}; }
  else if(grado){ if(!it.num || pTermini(p) !== 1 || !numOk(it, pGradoTot(p))) return null; }
  else if(it.tipo === "scelta"){
    var giuste = it.opz.map(function(o){ var q = leggiPolinomioTesto(o); return !!q && pUguali(q, p); });
    if(!giuste[it.ok] || giuste.filter(Boolean).length !== 1) return null;
  } else if(it.num){ var c = pCostante(p); if(!c || !numOk(it, qNum(c))) return null; }
  else if(!(accettata(it, variantiPolinomio(p)) || (polinomioDi(daLatex(it.sol[0] || "")) && pUguali(polinomioDi(daLatex(it.sol[0])), p)))) return null;
  var scient = /10\^/.test(String(it.sol && it.sol[0] || "")) || /10\^/.test(sg.tex);
  function firma(q){ var k = Object.keys(q); return pTermini(q) + "|" + pGradoTot(q) + "|" + pLettere(q).join("") + "|" + k.every(function(x){ return qIntero(q[x]); }) + "|" + !!pCostante(q); }
  var fA = firma(p), maxC = Math.max(200, Object.keys(p).reduce(function(m, k){ return Math.max(m, Math.abs(qNum(p[k]))); }, 0) * 2);
  return {famiglia:"sviluppa", genera:function(rng, scala){
    for(var t=0; t<500; t++){
      var texN = grado ? cambiaEsponenti(cambiaNumeri(sg.tex, rng, scala), rng) : cambiaNumeri(sg.tex, rng, scala);
      if(texN === sg.tex) continue;
      var alb = prova(function(){ return analizza(daLatex(texN)); }); if(!alb) continue;
      var q = prova(function(){ return polDi(alb); }); if(!q) continue;
      if(!grado && (firma(q) !== fA || Object.keys(q).some(function(k){ return Math.abs(qNum(q[k])) > maxC; }))) continue;
      if(grado && pTermini(q) !== 1) continue;
      var nuovi = {}; nuovi[ctx.segs.indexOf(sg)] = texN;
      var o = {q:nuovoTesto(ctx, nuovi), tipo:it.tipo, famiglia:"sviluppa"};
      var ris = polTex(q), ps = passiSviluppo(alb);
      if(grado){
        var g = pGradoTot(q), m = monoDi(Object.keys(q)[0]), somma = Object.keys(m).map(function(x){ return m[x]; });
        o.num = {v:g, tol:0}; o.sol = [String(g)];
        o.spieg = "Il grado di un monomio è la somma degli esponenti delle lettere: $" + somma.join("+") + " = " + g + "$. Il coefficiente non conta.";
        o.guida = [{s:"Scrivi gli esponenti delle lettere del monomio.", r:Object.keys(m).map(function(x){ return "$" + x + "$: " + m[x]; }).join(", "), k:somma.map(String)},
                   {s:"Sommali.", r:"Grado: $" + somma.join("+") + " = " + g + "$", k:[String(g)]}];
        return esercizio(o);
      }
      if(it.tipo === "scelta"){
        var dis = distrattoriPolinomio(q).map(function(d){ return "$" + polTex(d) + "$"; });
        if(dis.length < 3) continue;
        var oz = opzioni("$" + ris + "$", dis, rng); o.opz = oz.opz; o.ok = oz.ok;
      } else if(it.num){
        var cq = qNum(pCostante(q)); o.num = {v:cq, tol:it.num.tol || 0};
        o.sol = scient ? [scientifica(cq).txt, testoNumero(cq)] : [testoNumero(cq)];
        if(it.num.u) o.num.u = it.num.u;
        if(scient){ o.num.tol = Math.max(it.num.tol || 0, Math.abs(cq) * 1e-9); ris = scientifica(cq).tex; }
      }
      else o.sol = variantiPolinomio(q);
      var finale = it.tipo === "scelta" ? o.opz[o.ok] : "$" + ris + "$";
      o.spieg = (ps.passi.length ? ps.passi.join(" ") + " " : "") + (ps.tipo === "somma" ? "Sommo i termini simili e ottengo " : "Risultato: ") + finale + ".";
      o.guida = [];
      if(ps.tipo === "somma" && ps.passi.length) o.guida.push({s:"Sviluppa ciascun termine (prodotti notevoli o proprietà distributiva).", r:ps.passi.join("; "), k:[]});
      else o.guida.push({s:ps.tipo === "potenza" ? "Riconosci il prodotto notevole e scrivi la formula." : ps.tipo === "monomio" ? "Scrivi la regola per operare con i monomi." : "Scrivi la regola che userai.", r:ps.passi[0] || "Applico la proprietà distributiva.", k:[]});
      o.guida.push({s:"Riduci i termini simili e scrivi il risultato.", r:it.tipo === "scelta" ? "Il risultato è " + finale : finale, k:Object.keys(q).slice(0, 2).map(function(k){ return qTxt(q[k]); })});
      return esercizio(o);
    }
    return null;
  }};
}});

/* ---------- scomponi ---------- */
function strutturaFattori(F){ return [qCmp(F.k, Q0), qEq(qAbs(F.k), Q1), F.m, F.fatt.map(function(x){ return (x.lin ? (x.lin.q === 1n ? "L" : "F") : (x.quad.B === 0n ? "Q0" : "Q")) + x.molt; }).sort().join(",")].join("|"); }
function distrattoriScomposizione(F, v, p){
  var out = [];
  function con(f){ var G = {k:F.k, m:F.m, fatt:F.fatt.map(function(x){ return {p:x.p, molt:x.molt, lin:x.lin, quad:x.quad}; })}; f(G); return G; }
  function negaRadice(x){ var c = pUni(x.p, v); return {p:pDaUni([c[0], qNeg(c[1])], v), molt:x.molt, lin:x.lin}; }
  out.push(con(function(G){ G.fatt = G.fatt.map(function(x){ return x.lin ? negaRadice(x) : x; }); }));
  out.push(con(function(G){ var i = G.fatt.findIndex(function(x){ return x.lin; }); if(i >= 0) G.fatt[i] = negaRadice(G.fatt[i]); }));
  out.push(con(function(G){ var i = G.fatt.findIndex(function(x){ return x.lin; }); if(i >= 0){ var c = pUni(G.fatt[i].p, v); G.fatt[i] = {p:pDaUni([c[0], qAdd(c[1], c[0])], v), molt:G.fatt[i].molt, lin:true}; } }));
  out.push(con(function(G){ var i = G.fatt.findIndex(function(x){ return x.quad; }); if(i >= 0){ var c = pUni(G.fatt[i].p, v); G.fatt[i] = {p:pDaUni([c[0], qNeg(c[1]), qNeg(c[2])], v), molt:1, quad:true}; } }));
  out.push(con(function(G){ var i = G.fatt.findIndex(function(x){ return x.molt > 1; }); if(i >= 0) G.fatt[i] = {p:G.fatt[i].p, molt:1, lin:G.fatt[i].lin, quad:G.fatt[i].quad}; }));
  out.push(con(function(G){ var idx = G.fatt.map(function(x, i){ return x.lin ? i : -1; }).filter(function(i){ return i >= 0; }); if(idx.length > 1){ var i = idx[1], c = pUni(G.fatt[i].p, v); G.fatt[i] = {p:pDaUni([c[0], qSub(c[1], c[0])], v), molt:G.fatt[i].molt, lin:true}; } }));
  out.push(con(function(G){ G.k = qNeg(G.k); }));
  out.push(con(function(G){ // due fattori lineari opposti (x−a)(x+a) diventano x²+a²
    for(var i=0; i<G.fatt.length; i++) for(var j=i+1; j<G.fatt.length; j++){
      var a = G.fatt[i], b = G.fatt[j]; if(!a.lin || !b.lin) continue;
      var ca = pUni(a.p, v), cb = pUni(b.p, v);
      if(qEq(ca[0], cb[0]) && qEq(ca[1], qNeg(cb[1]))){ var nuovo = {p:pDaUni([qMul(ca[0], ca[0]), Q0, qMul(ca[1], ca[1])], v), molt:1, quad:true}; G.fatt = G.fatt.filter(function(x, k){ return k !== i && k !== j; }).concat([nuovo]); return; }
    }
  }));
  var visti = [scomposizioneTesto(F, v, true)];
  return out.filter(function(G){
    var prod = pCost(G.k); if(G.m) prod = pMul(prod, pPow(pVar(v), G.m)); G.fatt.forEach(function(x){ prod = pMul(prod, pPow(x.p, x.molt)); });
    var t = scomposizioneTesto(G, v, true);
    if(pUguali(prod, p) || visti.indexOf(t) >= 0) return false; visti.push(t); return true;
  }).map(function(G){ return "$" + scomposizioneTesto(G, v, true) + "$"; });
}
famiglia({id:"scomponi", nome:"Scomposizione in fattori", ordine:4, prova:function(ctx){
  var it = ctx.item;
  if(!/scompo|in fattori|fattorizz|raccogli/.test(ctx.piano)) return null;
  var es = segmentiEspressione(ctx); if(es.length !== 1) return null;
  var sg = es[0], expr = espressioneDi(sg), v = letteraUnica([expr]); if(!v) return null;
  var p = polinomioDi(expr); if(!p || pGradoTot(p) < 2) return null;
  var F = fattoriDi(pUni(p, v), v); if(!F || F.fatt.length + (F.m ? 1 : 0) < 2 && !(F.fatt.length && !qEq(qAbs(F.k), Q1))) return null;
  if(ctx.libero) it = {q:it.q, tipo:"aperta"};
  else if(it.tipo === "scelta"){
    var giuste = it.opz.map(function(o){ var q = leggiPolinomioTesto(o); return !!q && pUguali(q, p); });
    if(!giuste[it.ok] || giuste.filter(Boolean).length !== 1) return null;
  } else if(it.num) return null;
  else if(!accettata(it, variantiScomposizione(F, v))) return null;
  var struttura = strutturaFattori(F), cP = pUni(p, v), cresc = crescenteTex(texInterno(sg));
  return {famiglia:"scomponi", genera:function(rng, scala){
    for(var t=0; t<60; t++){
      var c2 = polinomioSimile(cP, rng, scala); if(!c2) continue;
      var p2 = pDaUni(c2, "x"), F2 = fattoriDi(pUni(p2, "x"), "x");
      if(!F2 || strutturaFattori(F2) !== struttura) continue;
      if(F2.fatt.some(function(x){ return pUni(x.p, "x").some(function(q){ return Math.abs(qNum(q)) > 30; }); })) continue;
      var interno = polTex(p2, cresc).replace(/x/g, v), texN = rimpiazzaInterno(sg, interno);
      var P2 = pDaUni(c2, v), G = fattoriDi(c2, v);
      var nuovi = {}; nuovi[ctx.segs.indexOf(sg)] = texN;
      var o = {q:nuovoTesto(ctx, nuovi), tipo:it.tipo, famiglia:"scomponi"};
      var ris = scomposizioneTesto(G, v, true);
      if(it.tipo === "scelta"){
        var dis = distrattoriScomposizione(G, v, P2); if(dis.length < 3) continue;
        var oz = opzioni("$" + ris + "$", dis, rng); o.opz = oz.opz; o.ok = oz.ok;
      } else o.sol = variantiScomposizione(G, v);
      // spiegazione: raccoglimento, zeri, fattori
      var passi = [], guida = [], pre = prefissoTesto(G, v, true);
      if(pre && pre !== "-"){ var resto = pDaUni(c2, v); var div = pCost(G.k); if(G.m) div = pMul(div, pPow(pVar(v), G.m)); var qq = pDivMono(resto, Object.keys(div)[0], div[Object.keys(div)[0]]); passi.push("Raccolgo il fattore comune $" + pre + "$: resta $" + polTex(qq) + "$."); guida.push({s:"Raccogli il fattore comune a tutti i termini.", r:"$" + pre + "(" + polTex(qq) + ")$", k:[pre.replace(/[{}]/g, "")]}); }
      var lin = G.fatt.filter(function(x){ return x.lin; }), deg = c2.length - 1 - G.m;
      if(deg === 2 && lin.length === 2 && G.f.lin.length){
        var rr = G.f.lin.map(function(l){ return qTex(Q(l.p, l.q)); });
        passi.push("Il trinomio di secondo grado ha zeri $" + rr.join("$ e $") + "$, quindi si scompone nel prodotto dei binomi corrispondenti.");
        guida.push({s:"Trova gli zeri del trinomio (somma e prodotto, oppure la formula).", r:"Zeri: $" + rr.join("$, $") + "$", k:G.f.lin.map(function(l){ return qTxt(Q(l.p, l.q)); })});
      } else if(lin.length){
        var zz = G.f.lin.map(function(l){ return qTex(Q(l.p, l.q)); });
        passi.push("Cerco gli zeri fra i divisori del termine noto (e del primo coefficiente): " + zz.map(function(z){ return "$P(" + z + ")=0$"; }).join(", ") + "; con la regola di Ruffini divido per i binomi corrispondenti.");
        guida.push({s:"Cerca gli zeri del polinomio fra i divisori del termine noto e dividi con Ruffini.", r:"Zeri: $" + zz.join("$, $") + "$", k:G.f.lin.map(function(l){ return qTxt(Q(l.p, l.q)); })});
      }
      if(G.fatt.some(function(x){ return x.quad; })) passi.push("Il fattore di secondo grado che resta non ha zeri razionali e non si scompone ulteriormente.");
      var finale = it.tipo === "scelta" ? o.opz[o.ok] : "$" + ris + "$";
      passi.push("Risultato: " + finale + ".");
      guida.push({s:"Scrivi la scomposizione completa.", r:it.tipo === "scelta" ? "La scomposizione è " + finale : finale, k:[]});
      if(guida.length < 2) guida.unshift({s:"Riconosci il metodo di scomposizione adatto.", r:"Prodotto notevole oppure zeri del polinomio", k:[]});
      o.spieg = passi.join(" "); o.guida = guida;
      return esercizio(o);
    }
    return null;
  }};
}});

/* ---------- dividi (quoziente e resto) ---------- */
function dividiUni(a, b){ // coefficienti dal grado massimo; restituisce {q, r}
  a = a.slice(); var q = [], n = a.length - b.length;
  if(n < 0) return {q:[Q0], r:a};
  for(var i=0; i<=n; i++){
    var c = qDiv(a[i], b[0]); q.push(c);
    for(var j=0; j<b.length; j++) a[i+j] = qSub(a[i+j], qMul(c, b[j]));
  }
  var r = a.slice(n+1); while(r.length > 1 && qZero(r[0])) r = r.slice(1);
  return {q:q, r:r.length ? r : [Q0]};
}
function spezzaDivisione(tex){ // "(P):(D)" -> {P, D} testi LaTeX
  var l = 0;
  for(var i=0; i<tex.length; i++){
    var c = tex[i]; if(c === "(" || c === "{") l++; else if(c === ")" || c === "}") l--;
    if(l === 0 && (c === ":" || tex.slice(i, i+4) === "\\div")){
      var P = tex.slice(0, i).trim(), D = tex.slice(i + (c === ":" ? 1 : 4)).trim();
      return {P:P.replace(/^\\left\(|^\(|\)$|\\right\)$/g, ""), D:D.replace(/^\\left\(|^\(|\)$|\\right\)$/g, "")};
    }
  }
  return null;
}
famiglia({id:"dividi", nome:"Divisione fra polinomi", ordine:3, prova:function(ctx){
  var it = ctx.item, pi = ctx.piano;
  var cosa = /\bresto\b/.test(pi) && !/quoziente e (il )?resto|quoziente e resto/.test(pi) ? "resto" : /quoziente/.test(pi) ? "quoziente" : null;
  if(!cosa) return null;
  var parti = null, sgP = null, sgD = null;
  var conDue = ctx.segs.filter(function(sg){ return spezzaDivisione(sg.tex); });
  if(conDue.length === 1){ sgP = sgD = conDue[0]; parti = spezzaDivisione(conDue[0].tex); }
  else {
    var es = segmentiEspressione(ctx); if(es.length !== 2) return null;
    sgP = es[0]; sgD = es[1]; parti = {P:texInterno(sgP), D:texInterno(sgD)};
  }
  var v = letteraUnica([daLatex(parti.P), daLatex(parti.D)]); if(!v) return null;
  function calcola(P, D){
    var pp = polinomioDi(daLatex(P)), pd = polinomioDi(daLatex(D)); if(!pp || !pd) return null;
    var a = pUni(pp, v), b = pUni(pd, v); if(b.length < 2 || a.length < b.length) return null;
    var d = dividiUni(a, b); return {a:a, b:b, q:d.q, r:d.r};
  }
  var A = calcola(parti.P, parti.D); if(!A) return null;
  var risA = cosa === "resto" ? pDaUni(A.r, v) : pDaUni(A.q, v);
  if(ctx.libero) it = {q:it.q, tipo:"aperta", num:pCostante(risA) ? {v:0, tol:0} : null};
  else if(it.tipo === "scelta"){ var giuste = it.opz.map(function(o){ var q = leggiPolinomioTesto(o); return !!q && pUguali(q, risA); }); if(!giuste[it.ok] || giuste.filter(Boolean).length !== 1) return null; }
  else if(it.num){ var c = pCostante(risA); if(!c || !numOk(it, qNum(c))) return null; }
  else if(!(accettata(it, variantiPolinomio(risA)) || (polinomioDi(daLatex(it.sol[0] || "")) && pUguali(polinomioDi(daLatex(it.sol[0])), risA)))) return null;
  var g = it.grafico; if(g && (Array.isArray(g) || g.tipo !== "ruffini")) return null;
  var restoZero = A.r.every(qZero), lineare = A.b.length === 2 && qEq(A.b[0], Q1), cresc = crescenteTex(parti.P);
  var zp = A.a.map(qZero);
  function nuovoDividendo(rng, scala, a){ // stessi termini mancanti; se serve, resto nullo per x − a
    for(var t=0; t<200; t++){
      var c = A.a.map(function(q, i){ if(qZero(q)) return Q0; var M = Math.round(Math.max(9, Math.abs(qNum(q)) * 1.6) * (scala || 1)); return Q(intCasuale(rng, 1, M) * (qCmp(q, Q0) < 0 ? -1 : 1)); });
      if(restoZero){
        var j = c.length - 1; while(j >= 0 && zp[j]) j--;
        if(j <= 0) return null;
        var s = Q0; for(var i=0; i<c.length; i++) if(i !== j) s = qAdd(s, qMul(c[i], qPow(a, c.length-1-i)));
        var den = qPow(a, c.length-1-j); if(qZero(den)) continue;
        var cj = qDiv(qNeg(s), den);
        if(!qIntero(cj) || qZero(cj) || Math.abs(qNum(cj)) > 200 || (qCmp(cj, Q0) < 0) !== (qCmp(A.a[j], Q0) < 0)) continue;
        c[j] = cj;
      }
      return c;
    }
    return null;
  }
  return {famiglia:"dividi", genera:function(rng, scala){
    for(var t=0; t<400; t++){
      var Dn = cambiaNumeri(parti.D, rng, scala), Pn;
      var pd = polinomioDi(daLatex(Dn)); if(!pd) continue;
      var b = pUni(pd, v); if(b.length !== A.b.length) continue;
      if(restoZero){
        if(!lineare) return null;
        var a = qNeg(b[1]); var c = nuovoDividendo(rng, scala, a); if(!c) continue;
        Pn = polTex(pDaUni(c, "x"), cresc).replace(/x/g, v);
      } else Pn = cambiaNumeri(parti.P, rng, scala);
      var B = calcola(Pn, Dn); if(!B) continue;
      var ris = cosa === "resto" ? pDaUni(B.r, v) : pDaUni(B.q, v);
      if(B.r.every(qZero) !== restoZero) continue;
      if(B.q.concat(B.r).some(function(q){ return !qIntero(q) || Math.abs(qNum(q)) > 150; })) continue;
      if(Pn === parti.P && Dn === parti.D) continue;
      var nuovi = {};
      if(sgP === sgD){
        // per posizione: il divisore sta in fondo, il dividendo prima (una sostituzione «per testo»
        // del divisore x-2 colpirebbe anche un ...6x-2 del dividendo)
        var tx = sgP.tex, iP = tx.indexOf(parti.P), iD = tx.lastIndexOf(parti.D);
        if(iP < 0 || iD < iP + parti.P.length) continue;
        nuovi[ctx.segs.indexOf(sgP)] = tx.slice(0, iP) + Pn + tx.slice(iP + parti.P.length, iD) + Dn + tx.slice(iD + parti.D.length);
      }
      else { nuovi[ctx.segs.indexOf(sgP)] = rimpiazzaInterno(sgP, Pn); nuovi[ctx.segs.indexOf(sgD)] = rimpiazzaInterno(sgD, Dn); }
      var o = {q:nuovoTesto(ctx, nuovi), tipo:it.tipo, famiglia:"dividi"};
      var Qt = polTex(pDaUni(B.q, v)), Rt = polTex(pDaUni(B.r, v)), risT = polTex(ris);
      if(it.tipo === "scelta"){
        var dis = distrattoriPolinomio(ris).map(function(d){ return "$" + polTex(d) + "$"; });
        if(pCostante(ris)) dis = [1, -1, 2].map(function(k){ return "$" + qTex(qAdd(pCostante(ris), Q(k))) + "$"; }).concat(["$" + qTex(qNeg(pCostante(ris))) + "$"]).filter(function(x){ return x !== "$" + risT + "$"; });
        var oz = opzioni("$" + risT + "$", dis, rng); o.opz = oz.opz; o.ok = oz.ok;
      } else if(it.num){ var cv = qNum(pCostante(ris)); o.num = {v:cv, tol:it.num.tol || 0}; o.sol = [testoNumero(cv)]; }
      else o.sol = variantiPolinomio(ris);
      var passi = [], guida = [];
      if(B.b.length === 2 && qEq(B.b[0], Q1)){
        var aa = qNeg(B.b[1]), coeff = B.a.map(qTex).join(",\\ ");
        passi.push("Il divisore è $" + polTex(pDaUni(B.b, v)) + "$: uso la regola di Ruffini con $a=" + qTex(aa) + "$ e i coefficienti completi del dividendo $" + coeff + "$.");
        passi.push("Lo schema dà i coefficienti del quoziente $" + B.q.map(qTex).join(",\\ ") + "$ e il resto $" + Rt + "$.");
        passi.push("Controllo con il teorema del resto: $P(" + qTex(aa) + ") = " + Rt + "$.");
        guida.push({s:"Scrivi i coefficienti del dividendo (con gli zeri dei termini mancanti) e il numero a del divisore.", r:"Coefficienti $" + coeff + "$; $a = " + qTex(aa) + "$", k:[qTxt(aa)]});
        guida.push({s:"Esegui lo schema di Ruffini: abbassa, moltiplica, somma.", r:"Riga del risultato: $" + B.q.concat(B.r).map(qTex).join(",\\ ") + "$", k:[qTxt(B.r[B.r.length-1])]});
      } else {
        passi.push("Il divisore ha grado " + (B.b.length-1) + ": eseguo la divisione in colonna, ordinando i polinomi e completando il dividendo con i termini mancanti.");
        passi.push("Mi fermo quando il resto ha grado minore del divisore: quoziente $" + Qt + "$, resto $" + Rt + "$.");
        guida.push({s:"Dividi il primo termine del dividendo per il primo termine del divisore, moltiplica e sottrai; ripeti.", r:"Quoziente $" + Qt + "$", k:[]});
      }
      var finale = it.tipo === "scelta" ? o.opz[o.ok] : "$" + risT + "$";
      passi.push((cosa === "resto" ? "Il resto è " : "Il quoziente è ") + finale + ".");
      guida.push({s:cosa === "resto" ? "Scrivi il resto." : "Scrivi il quoziente.", r:(cosa === "resto" ? "Resto: " : "Quoziente: ") + (it.num ? o.sol[0] : finale), k:[]});
      o.spieg = passi.join(" "); o.guida = guida;
      if(g){ o.grafico = {}; for(var k in g) o.grafico[k] = g[k]; o.grafico.polinomio = polTesto(pDaUni(B.a, v)); o.grafico.radice = qTxt(qNeg(B.b[1])); delete o.grafico.coefficienti; }
      return esercizio(o);
    }
    return null;
  }};
}});

/* ---------- valuta (valore numerico) ---------- */
function eChiamata(tex){ var m = /^\s*([a-zA-Z])\s*\(\s*(-?\s*[\d.]+)\s*\)\s*$/.exec(daLatex(tex)); return m ? {f:m[1], x:m[2].replace(/\s/g, "")} : null; }
famiglia({id:"valuta", nome:"Valore numerico", ordine:3.5, prova:function(ctx){
  var it = ctx.item;
  if(!it.num && it.tipo !== "scelta" && !ctx.libero) return null;
  if(!/valore|vale|quanto|posizione|calcola|trova|dove si trova/.test(ctx.piano)) return null;
  var espr = null, ass = [], chiamata = null, altri = 0;
  ctx.segs.forEach(function(sg){
    var ch = eChiamata(sg.tex);
    if(ch){ chiamata = {sg:sg, c:ch}; return; }
    if(sg.r && eAssegnazione(sg.r.rel)){ ass.push(sg); return; }
    if(sg.r && eDefinizione(sg.r.rel)){ if(espr) altri++; espr = sg; return; }
    if(!sg.r && /[a-zA-Z]/.test(daLatex(sg.tex)) && sg.cifre && parseSicuro(daLatex(sg.tex))){ if(espr) altri++; espr = sg; return; }
    if(sg.cifre) altri++;
  });
  if(!espr || altri || (!ass.length && !chiamata)) return null;
  function valore(exprTex, assTex, chiamataTex){
    var e = espr.r ? daLatex(latiTex(exprTex).slice(-1)[0]) : daLatex(exprTex);
    var p = polinomioDi(e); if(!p) return null;
    var val = {}, lettere = pLettere(p);
    assTex.forEach(function(t){ relazioniDi(t).rel.forEach(function(r){ var c = pCostante(polinomioDi(r.dx)); val[r.sx.trim()] = c; }); });
    if(chiamataTex){ var ch = eChiamata(chiamataTex), c = pCostante(polinomioDi(ch.x)); if(lettere.length !== 1) return null; val[lettere[0]] = c; }
    if(lettere.some(function(x){ return !val[x]; })) return null;
    return {p:p, val:val, ris:pValutaEsatto(p, val)};
  }
  var A = prova(function(){ return valore(espr.tex, ass.map(function(s){ return s.tex; }), chiamata && chiamata.sg.tex); });
  if(!A) return null;
  if(it.tipo === "scelta") return null;
  if(ctx.libero) it = {q:it.q, tipo:"aperta", num:{v:0, tol:0}};
  else if(!numOk(it, qNum(A.ris))) return null;
  var intero = qIntero(A.ris);
  return {famiglia:"valuta", genera:function(rng, scala){
    for(var t=0; t<400; t++){
      var eN = espr.r ? rimpiazzaInterno(espr, cambiaNumeri(texInterno(espr), rng, scala)) : cambiaNumeri(espr.tex, rng, scala);
      var aN = ass.map(function(s){ return cambiaNumeri(s.tex, rng, scala); });
      var cN = chiamata ? cambiaNumeri(chiamata.sg.tex, rng, scala) : null;
      var B = prova(function(){ return valore(eN, aN, cN); }); if(!B) continue;
      if(qIntero(B.ris) !== intero || (!intero && !qDecimale(B.ris)) || Math.abs(qNum(B.ris)) > Math.max(300, Math.abs(qNum(A.ris))*4)) continue;
      if(qCmp(B.ris, Q0) !== qCmp(A.ris, Q0)) continue;
      if(eN === espr.tex && aN.join() === ass.map(function(s){ return s.tex; }).join() && cN === (chiamata && chiamata.sg.tex)) continue;
      var nuovi = {}; nuovi[ctx.segs.indexOf(espr)] = eN; ass.forEach(function(s, i){ nuovi[ctx.segs.indexOf(s)] = aN[i]; }); if(chiamata) nuovi[ctx.segs.indexOf(chiamata.sg)] = cN;
      var ris = qNum(B.ris), testoR = qDecimale(B.ris) || qTxt(B.ris);
      var o = {q:nuovoTesto(ctx, nuovi), tipo:"aperta", famiglia:"valuta", num:{v:ris, tol:it.num.tol || 0}, sol:[testoR]};
      if(it.num.u) o.num.u = it.num.u;
      var corpo = espr.r ? texInterno({tex:eN, r:true}) : eN, sost = corpo;
      Object.keys(B.val).forEach(function(x){ sost = sostituisciLettera(sost, x, qTex(B.val[x])); });
      var vals = Object.keys(B.val).map(function(x){ return "$" + x + " = " + qTex(B.val[x]) + "$"; }).join(" e ");
      o.spieg = "Sostituisco " + vals + " al posto delle lettere, sempre fra parentesi: $" + sost + "$. Svolgo prima le potenze, poi prodotti e quozienti, infine le somme: il valore è $" + qTex(B.ris) + "$.";
      o.guida = [{s:"Sostituisci i valori al posto delle lettere, mettendoli fra parentesi.", r:"$" + sost + "$", k:Object.keys(B.val).map(function(x){ return qTxt(B.val[x]); })},
                 {s:"Calcola, rispettando l'ordine delle operazioni.", r:"Il valore è $" + qTex(B.ris) + "$", k:[testoR]}];
      return esercizio(o);
    }
    return null;
  }};
}});

/* ================= 12. problemi numerici con unità di misura ================= */
/* unità: fattore verso il Sistema Internazionale e dimensioni [lunghezza, tempo, massa, angolo] */
var L_ = [1,0,0,0], T_ = [0,1,0,0], M_ = [0,0,1,0], A_ = [0,0,0,1], V_ = [1,-1,0,0], ACC = [1,-2,0,0], F_ = [1,-2,1,0], K_ = [0,-2,1,0], E_ = [2,-2,1,0];
var UNITA = [
  ["km/h", 1/3.6, V_], ["m/s²", 1, ACC], ["m/s^2", 1, ACC], ["m/s", 1, V_], ["N/m", 1, K_], ["N m", 1, E_], ["N·m", 1, E_], ["Nm", 1, E_],
  ["chilometri", 1000, L_], ["centimetri", 0.01, L_], ["millimetri", 0.001, L_], ["metri", 1, L_], ["metro", 1, L_],
  ["secondi", 1, T_], ["secondo", 1, T_], ["minuti", 60, T_], ["minuto", 60, T_], ["ore", 3600, T_], ["ora", 3600, T_],
  ["newton", 1, F_], ["joule", 1, E_], ["chilogrammi", 1, M_], ["grammi", 0.001, M_], ["gradi", 1, A_],
  ["km", 1000, L_], ["cm", 0.01, L_], ["mm", 0.001, L_], ["kg", 1, M_], ["min", 60, T_],
  ["m", 1, L_], ["s", 1, T_], ["h", 3600, T_], ["g", 0.001, M_], ["N", 1, F_], ["J", 1, E_], ["°", 1, A_]
];
var NOMI_SI = [[L_, "m"], [T_, "s"], [V_, "m/s"], [ACC, "m/s²"], [M_, "kg"], [F_, "N"], [K_, "N/m"], [E_, "J"], [A_, "°"]];
function stessaDim(a, b){ for(var i=0; i<4; i++) if(Math.abs(a[i] - b[i]) > 1e-9) return false; return true; }
function nomeSI(d){ for(var i=0; i<NOMI_SI.length; i++) if(stessaDim(NOMI_SI[i][0], d)) return NOMI_SI[i][1]; return ""; }
function unitaIn(testo){ // unità all'inizio di un testo
  var t = testo.replace(/^\s*(?:\\,|\;|&nbsp;)?\s*/, "");
  for(var i=0; i<UNITA.length; i++){
    var u = UNITA[i][0];
    if(t.slice(0, u.length) === u && !/[a-zA-Zàèéìòù²]/.test(t.charAt(u.length) || "")) return {u:u, f:UNITA[i][1], dim:UNITA[i][2]};
  }
  return null;
}
function datiProblema(ctx){
  var q = ctx.q, dati = [];
  for(var k=0; k<ctx.segs.length; k++){
    var sg = ctx.segs[k], tex = sg.tex.trim();
    if(!/\d/.test(tex)) continue;
    var m = /^(?:(\\?[a-zA-Z]+(?:_\{?[a-zA-Z0-9]+\}?)?)\s*=\s*)?(\d+(?:\{,\}\d+|[.,]\d+)?)\s*(\^\{?\\circ\}?|°)?$/.exec(tex);
    if(!m){ if(/^\^\{?\d\}?$/.test(tex)) continue; return null; }
    var numTxt = m[2], val = parseFloat(numTxt.replace("{,}", ".").replace(",", "."));
    var dec = (numTxt.replace("{,}", ".").replace(",", ".").split(".")[1] || "").length;
    var dopo = q.slice(sg.j, sg.j + 24).replace(/\$\^\{?2\}?\$/g, "²").replace(/\$\^\{?3\}?\$/g, "³");
    var un = m[3] ? {u:"°", f:1, dim:A_} : unitaIn(dopo);
    var nome = m[1] || null, fisso = val === 0 || nome === "g" || (un && un.u.indexOf("m/s") === 0 && un.dim === ACC && (Math.abs(val - 9.8) < 1e-9 || Math.abs(val - 9.81) < 1e-9));
    dati.push({sg:k, tex:tex, numTxt:numTxt, val:val, dec:dec, stile:/\{,\}/.test(numTxt) ? "graffa" : /,/.test(numTxt) ? "virgola" : dec ? "punto" : "intero",
               un:un, dim:un ? un.dim : [0,0,0,0], si:val * (un ? un.f : 1), nome:nome, fisso:fisso});
  }
  return dati;
}
function unitaRisposta(ctx){
  var it = ctx.item, u = it.num && it.num.u ? unitaIn(String(it.num.u)) : null;
  if(u) return u;
  var t = ctx.q.replace(/\$\^\{?2\}?\$/g, "²").replace(/<[^>]+>/g, " ");
  var m = /\b(?:in|di quant[ie]|quant[ie])\s+(km\/h|m\/s²|m\/s|N\/m|N m|newton|metri|chilometri|centimetri|secondi|minuti|ore|joule|gradi|kg|km|cm|m|s|N|J)\b/.exec(t);
  if(m) return unitaIn(m[1]);
  return null;
}
var ESP = [-2, -1, -0.5, 0.5, 1, 2], COST = [1, 0.5, 2];
function valutaFormula(F, si){
  if(F.tipo === "mono"){ var v = F.c; for(var i=0; i<si.length; i++) if(F.e[i]) v *= Math.pow(si[i], F.e[i]); return v; }
  var s = F.c0; for(var j=0; j<si.length; j++) s += F.k[j] * si[j]; return s;
}
function cercaFormule(dati, ans, bersaglio, tol, piano){
  piano = piano || "";
  var n = dati.length, out = [], usabili = dati.map(function(d){ return d.fisso ? [0, -1, -0.5, 0.5, 1] : ESP; });
  var siD = dati.map(function(d){ return d.si; }), fAns = ans ? ans.f : 1;
  // monomi
  (function giro(i, e){
    if(i === n){
      if(!e.some(function(x, j){ return x && !dati[j].fisso; })) return;
      if(ans){ var d = [0,0,0,0]; for(var j=0; j<n; j++) for(var c=0; c<4; c++) d[c] += e[j] * dati[j].dim[c]; if(!stessaDim(d, ans.dim)) return; }
      else if(e.some(function(x){ return Math.abs(x) !== 1 && x !== 0; }) || dati.some(function(dd){ return dd.dim.some(function(x){ return x; }); })) return;
      COST.forEach(function(c0){
        if(!ans && c0 !== 1) return;
        var F = {tipo:"mono", c:c0, e:e.slice()}, v = valutaFormula(F, siD) / fAns;
        if(isFinite(v) && Math.abs(v - bersaglio) <= tol + 1e-9 * Math.abs(bersaglio)) out.push(F);
      });
      return;
    }
    usabili[i].forEach(function(x){ if(dati[i].fisso || x !== 0) giro(i + 1, e.concat([x])); });
  })(0, []);
  // combinazioni lineari (angoli, oppure grandezze tutte della stessa dimensione)
  // somme e differenze solo per gli angoli o quando il testo lo dice (perimetro, somma, rispetto alla riva...):
  // altrimenti una combinazione qualsiasi può riprodurre per caso la risposta
  var libere = dati.filter(function(d){ return !d.fisso; }), angoli = ans && stessaDim(ans.dim, A_);
  var additivo = angoli || /perimetr|somma|differenz|in tutto|totale|complessiv|rispetto alla riva|verso della corrente|controcorrente|contro corrente|insieme/.test(piano);
  var meta = angoli || /perimetr|metà|bisettric|isoscel/.test(piano);
  if(/raddopp|triplic|dimezz|quadrupl|doppio|triplo/.test(piano)) additivo = false;
  if(ans && additivo && libere.length <= 3 && dati.every(function(d){ return d.fisso || stessaDim(d.dim, ans.dim); })){
    var C0 = angoli ? [0, 90, 180, 360] : [0], KK = meta ? [-2, -1, -0.5, 0.5, 1, 2] : [-1, 1];
    (function giroL(i, k){
      if(i === n){
        C0.forEach(function(c0){ var F = {tipo:"lin", c0:c0, k:k.slice()}, v = valutaFormula(F, siD) / fAns; if(Math.abs(v - bersaglio) <= tol + 1e-9 * Math.abs(bersaglio)) out.push(F); });
        return;
      }
      if(dati[i].fisso){ giroL(i + 1, k.concat([0])); return; }
      KK.forEach(function(x){ giroL(i + 1, k.concat([x])); });
    })(0, []);
  }
  return out;
}
function simboliDati(dati, ans){
  var cont = {}, usati = {};
  function base(d){
    if(d.nome) return d.nome;
    var D = d.dim;
    if(stessaDim(D, L_)) return "s"; if(stessaDim(D, T_)) return "t"; if(stessaDim(D, V_)) return "v"; if(stessaDim(D, ACC)) return "a";
    if(stessaDim(D, F_)) return "F"; if(stessaDim(D, K_)) return "k"; if(stessaDim(D, M_)) return "m"; if(stessaDim(D, E_)) return "E"; if(stessaDim(D, A_)) return "\\alpha";
    return "n";
  }
  dati.forEach(function(d){ var b = base(d); cont[b] = (cont[b] || 0) + 1; });
  var sim = dati.map(function(d){ var b = base(d); if(cont[b] > 1){ usati[b] = (usati[b] || 0) + 1; return b + "_" + usati[b]; } return b; });
  var r = ans ? base({dim:ans.dim}) : "x"; if(sim.indexOf(r) >= 0) r = r + "_{r}";
  return {dati:sim, ris:r};
}
function formulaTex(F, sim){
  if(F.tipo === "lin"){
    var t = F.c0 ? String(F.c0) : "";
    F.k.forEach(function(k, i){ if(!k) return; var a = Math.abs(k), coef = a === 1 ? "" : a === 0.5 ? "\\tfrac{1}{2}" : String(a); t += (k < 0 ? "-" : t ? "+" : "") + coef + sim[i]; });
    return t;
  }
  var num = [], den = [], rad = [];
  if(F.c === 2) num.push("2"); if(F.c === 0.5) den.push("2");
  F.e.forEach(function(e, i){
    if(!e) return; var s = sim[i], a = Math.abs(e);
    var pezzo = a === 1 ? s : a === 2 ? s + "^2" : s;
    if(a === 0.5){ (e > 0 ? rad : rad).push({s:s, su:e > 0}); return; }
    (e > 0 ? num : den).push(pezzo);
  });
  var corpo = (num.length ? num.join("\\cdot ") : "1"), frac = den.length ? "\\dfrac{" + corpo + "}{" + den.join("\\cdot ") + "}" : corpo;
  if(rad.length){
    var rn = rad.filter(function(x){ return x.su; }).map(function(x){ return x.s; }), rd = rad.filter(function(x){ return !x.su; }).map(function(x){ return x.s; });
    var radice = "\\sqrt{" + (rd.length ? "\\dfrac{" + (rn.join("\\cdot ") || "1") + "}{" + rd.join("\\cdot ") + "}" : rn.join("\\cdot ")) + "}";
    frac = (frac === "1" ? "" : frac + "\\cdot ") + radice;
  }
  return frac;
}
function niceDato(d, rng, scala){
  if(d.dec){
    for(var t=0; t<30; t++){ var x = +(d.val * (0.5 + 1.5 * rng() * (scala || 1))).toFixed(d.dec); if(x > 0 && x !== d.val && Math.round(x * Math.pow(10, d.dec)) % 10 !== 0) return x; }
    return d.val;
  }
  // passo «tondo» come l'originale: 90 -> multipli di 10, 150 -> di 10, 72 -> di 2, 37 -> di 1
  var passo = 1, angolo = stessaDim(d.dim, A_);
  [2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000].forEach(function(p){ if(d.val % p === 0 && p <= d.val / 5) passo = p; });
  var lo = angolo ? 0.7 : 0.5, ampiezza = angolo ? 0.6 : 1.5;
  for(var u=0; u<30; u++){ var y = Math.round(d.val * (lo + ampiezza * rng() * (scala || 1)) / passo) * passo; if(y > 0 && y !== d.val) return y; }
  return d.val;
}
famiglia({id:"problema", nome:"Problemi con dati numerici", ordine:8, prova:function(ctx){
  var it = ctx.item; if(!it.num) return null;
  var dati = datiProblema(ctx); if(!dati) return null;
  var liberi = dati.filter(function(d){ return !d.fisso; });
  if(!liberi.length || liberi.length > 4 || dati.length > 5) return null;
  var ans = unitaRisposta(ctx);
  if(!ans && dati.some(function(d){ return stessaDim(d.dim, A_); }) && /misur|angol|gradi/.test(ctx.piano)) ans = {u:"°", f:1, dim:A_};
  var decA = decimaliDi(it.num.v), tol = Math.max(it.num.tol || 0, decA ? 0.5 * Math.pow(10, -decA) : 0);
  var trovate = cercaFormule(dati, ans, it.num.v, tol, ctx.piano);
  if(!trovate.length) return null;
  // le formule trovate devono dare lo stesso risultato anche con dati diversi
  var rng0 = rng32(97);
  for(var prova3=0; prova3<3; prova3++){
    var si = dati.map(function(d){ return d.fisso ? d.si : d.si * (0.6 + rng0()); });
    var vals = trovate.map(function(F){ return valutaFormula(F, si); });
    if(vals.some(function(v){ return Math.abs(v - vals[0]) > 1e-7 * Math.max(1, Math.abs(vals[0])); })) return null;
  }
  var F = trovate[0], fAns = ans ? ans.f : 1;
  var esatta = Math.abs(valutaFormula(F, dati.map(function(d){ return d.si; })) / fAns - it.num.v) < 1e-9 * Math.max(1, Math.abs(it.num.v));
  var sim = simboliDati(dati, ans), formula = sim.ris + " = " + formulaTex(F, sim.dati);
  return {famiglia:"problema", genera:function(rng, scala){
    for(var t=0; t<500; t++){
      var nuovi = dati.map(function(d){ return d.fisso ? d.val : niceDato(d, rng, scala); });
      if(nuovi.every(function(v, i){ return v === dati[i].val; })) continue;
      if(dati.some(function(d, i){ return stessaDim(d.dim, A_) && (nuovi[i] <= 0 || nuovi[i] >= 180); })) continue;
      var si = dati.map(function(d, i){ return nuovi[i] * (d.un ? d.un.f : 1); });
      var v = valutaFormula(F, si) / fAns;
      if(!isFinite(v) || (v > 0) !== (it.num.v > 0) || Math.abs(v) > Math.abs(it.num.v) * 20 + 50) continue;
      if(ans && stessaDim(ans.dim, A_) && (v <= 0 || v >= 360)) continue;
      var d = Math.max(decA, esatta ? 0 : decA), arrot = +v.toFixed(d);
      if(esatta && Math.abs(v - arrot) > 1e-9 * Math.max(1, Math.abs(v))){ if(t < 350) continue; d = Math.max(decA, 2); arrot = +v.toFixed(d); }
      // testo con i dati nuovi
      var mappa = {};
      dati.forEach(function(dd, i){
        if(dd.fisso) return;
        var tex = mappa[dd.sg] != null ? mappa[dd.sg] : ctx.segs[dd.sg].tex, j = tex.lastIndexOf(dd.numTxt); // il numero è in fondo al segmento
        mappa[dd.sg] = tex.slice(0, j) + scriviNumero(nuovi[i], dd.dec, dd.stile) + tex.slice(j + dd.numTxt.length);
      });
      var o = {q:nuovoTesto(ctx, mappa), tipo:"aperta", famiglia:"problema"};
      var tolN = esatta && Math.abs(v - arrot) < 1e-9 * Math.max(1, Math.abs(v)) ? (it.num.tol || 0) : Math.max(it.num.tol || 0, 0.5 * Math.pow(10, -d));
      o.num = {v:arrot, tol:tolN}; if(it.num.u) o.num.u = it.num.u;
      var testoR = testoNumero(arrot), uR = ans ? ans.u : (it.num.u || "");
      o.sol = [testoR + (uR && uR !== "°" ? " " + uR : "")]; if(o.sol[0] !== testoR) o.sol.push(testoR);
      var datiTxt = dati.map(function(dd, i){ return "$" + sim.dati[i] + " = " + texNumero(nuovi[i]) + "$" + (dd.un ? (dd.un.u === "°" ? "°" : " " + dd.un.u) : ""); });
      var conv = dati.map(function(dd, i){ return dd.un && dd.un.f !== 1 ? "$" + texNumero(nuovi[i]) + "$ " + dd.un.u + " $= " + texNumero(+(nuovi[i] * dd.un.f).toFixed(4)) + "$ " + nomeSI(dd.dim) : null; }).filter(Boolean);
      var sost = sim.ris + " = " + formulaTex(F, si.map(function(x){ return texNumero(+x.toFixed(6)); }).map(function(x){ return /^-/.test(x) ? "(" + x + ")" : x; }));
      var vSI = valutaFormula(F, si);
      o.spieg = "Dati: " + datiTxt.join(", ") + "." + (conv.length ? " Nel Sistema Internazionale: " + conv.join(", ") + "." : "") +
        " La grandezza richiesta si ottiene con la relazione $" + formula + "$. Sostituisco: $" + sost + " = " + texNumero(+vSI.toFixed(6)) + "$" + (ans ? (ans.f !== 1 ? " " + nomeSI(ans.dim) + ", cioè $" + texNumero(arrot) + "$ " + ans.u : (ans.u === "°" ? "°" : " " + ans.u)) : "") + ".";
      o.guida = [{s:"Individua i dati del problema e, se serve, convertili nel Sistema Internazionale.", r:datiTxt.join(", ") + (conv.length ? "; " + conv.join(", ") : ""), k:dati.filter(function(dd){ return !dd.fisso; }).slice(0, 2).map(function(dd){ return testoNumero(nuovi[dati.indexOf(dd)]); })},
                 {s:"Scrivi la relazione che lega i dati alla grandezza richiesta.", r:"$" + formula + "$", k:[]},
                 {s:"Sostituisci i valori e calcola.", r:"$" + sost + "$, quindi " + testoR + (uR ? (uR === "°" ? "°" : " " + uR) : ""), k:[testoR]}];
      return esercizio(o);
    }
    return null;
  }};
}});

/* ================= 13. esercizi descritti da un modello ================= */
function compilaFormula(src, nomi){
  var L = typeof window !== "undefined" && window.Laboratorio;
  if(L && L.compila){ var c = L.compila(String(src), nomi); return function(sc){ return c.f(sc); }; }
  var p = polinomioDi(String(src)); if(!p) throw errore("formula non valida");
  return function(sc){ return pValuta(p, sc); };
}
function valoriParametro(d){
  if(Array.isArray(d)) return d.map(Number);
  if(d && Array.isArray(d.valori)) return d.valori.map(Number);
  if(d && isFinite(d.min) && isFinite(d.max)){ var passo = d.passo > 0 ? d.passo : 1, out = []; for(var x=d.min; x<=d.max + 1e-9 && out.length < 2000; x += passo) out.push(+x.toFixed(6)); return out; }
  return null;
}
function riempi(testo, sc, risposta, dec){
  var dentro = false;
  return String(testo || "").replace(/\$|\{=([^}]+)\}|\{([a-zA-Z_]\w*)\}/g, function(m, espr, nome){
    if(m === "$"){ dentro = !dentro; return m; }
    var v;
    if(espr) v = prova(function(){ return compilaFormula(espr, Object.keys(sc))(sc); });
    else if(nome === "risposta") v = risposta;
    else v = sc[nome];
    if(v == null || !isFinite(v)) return m;
    var t = testoNumero(nome === "risposta" && dec != null ? +v.toFixed(dec) : +v.toFixed(6));
    return dentro ? t.replace(",", "{,}") : t;
  });
}
function modelloDa(md){
  if(!md || typeof md !== "object" || !md.testo || !md.risposta || !md.parametri) return null;
  var nomi = Object.keys(md.parametri), dom = {};
  for(var i=0; i<nomi.length; i++){ var v = valoriParametro(md.parametri[nomi[i]]); if(!v || !v.length) return null; dom[nomi[i]] = v; }
  var f = prova(function(){ return compilaFormula(md.risposta, nomi); }); if(!f) return null;
  var vincoli = (md.vincoli || []).map(function(s){ var r = spezzaRelazioni(String(s).replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥")); return r && r.length === 1 ? {a:compilaFormula(r[0].sx, nomi), b:compilaFormula(r[0].dx, nomi), op:r[0].op} : null; });
  if(vincoli.some(function(x){ return !x; })) return null;
  var dec = md.decimali != null ? +md.decimali : null;
  return {dom:dom, f:f, vincoli:vincoli, dec:dec, md:md};
}
function istanzaModello(M, rng){
  for(var t=0; t<500; t++){
    var sc = {};
    Object.keys(M.dom).forEach(function(n){ var v = M.dom[n]; sc[n] = v[Math.floor(rng() * v.length)]; });
    var ok = M.vincoli.every(function(x){ var a = x.a(sc), b = x.b(sc); return x.op === "<" ? a < b : x.op === ">" ? a > b : x.op === "≤" ? a <= b + 1e-12 : x.op === "≥" ? a >= b - 1e-12 : x.op === "≠" ? Math.abs(a - b) > 1e-12 : Math.abs(a - b) < 1e-12; });
    if(!ok) continue;
    var r = M.f(sc); if(!isFinite(r)) continue;
    var dec = M.dec != null ? M.dec : (Math.abs(r - Math.round(r)) < 1e-9 ? 0 : 2);
    return {sc:sc, r:+r.toFixed(dec), dec:dec};
  }
  return null;
}
function esercizioDaModello(M, rng){
  var I = istanzaModello(M, rng); if(!I) return null;
  var md = M.md, u = md.unita ? " " + md.unita : "", rt = testoNumero(I.r);
  var o = {q:riempi(md.testo, I.sc, I.r, I.dec), tipo:"aperta", famiglia:"modello", num:{v:I.r, tol:md.tolleranza != null ? +md.tolleranza : (I.dec ? 0.5 * Math.pow(10, -I.dec) : 0)}, sol:[rt + u, rt]};
  if(md.unita) o.num.u = String(md.unita);
  o.spieg = md.spiegazione ? riempi(md.spiegazione, I.sc, I.r, I.dec) : "Sostituendo i dati nella relazione $" + String(md.risposta).replace(/\*/g, "\\cdot ") + "$ si ottiene " + rt + u + ".";
  o.guida = Array.isArray(md.guida) && md.guida.length >= 2 ? md.guida.map(function(p){ return {s:riempi(p.s, I.sc, I.r, I.dec), r:riempi(p.r, I.sc, I.r, I.dec), k:(p.k || []).map(function(k){ return riempi(k, I.sc, I.r, I.dec); })}; })
    : [{s:"Individua i dati e la relazione che li lega alla grandezza richiesta.", r:"$" + String(md.risposta).replace(/\*/g, "\\cdot ") + "$", k:[]}, {s:"Sostituisci i dati e calcola.", r:"Risultato: " + rt + u, k:[rt]}];
  var ult = o.guida[o.guida.length - 1]; if(String(ult.r).indexOf(rt) < 0) ult.r += " (" + rt + u + ")";
  return esercizio(o);
}
famiglia({id:"modello", nome:"Modello scritto dall'insegnante", ordine:0, prova:function(ctx){
  var M = modelloDa(ctx.item.modello); if(!M) return null;
  return {famiglia:"modello", genera:function(rng){ return esercizioDaModello(M, rng); }};
}});

/* ================= 14. riconoscimento, batterie, testo semplice ================= */
function ordinate(){ return FAMIGLIE.slice().sort(function(a, b){ return (a.ordine == null ? 5 : a.ordine) - (b.ordine == null ? 5 : b.ordine); }); }
function riconosci(item){
  if(!item || typeof item !== "object") return {famiglia:null, motivo:"esercizio non valido"};
  if(!item.q && !item.modello) return {famiglia:null, motivo:"manca il testo dell'esercizio"};
  var ctx = item.q ? contesto(item) : {item:item, q:"", segs:[], piano:"", libero:true};
  var lista = ordinate();
  for(var i=0; i<lista.length; i++){
    var m = null;
    try{ m = lista[i].prova(ctx); }catch(e){ m = null; }
    if(m){ m.nome = lista[i].nome; return m; }
  }
  var motivo;
  if(!ctx.segs.length) motivo = "nel testo non c'è un'espressione o un dato numerico da cambiare";
  else if(item.tipo === "scelta") motivo = "domanda a scelta multipla teorica, oppure con opzioni che il motore non sa calcolare";
  else if(ctx.libero && !ctx.segs.some(function(sg){ return sg.r; })) motivo = "per un problema con dati numerici serve anche la risposta (per esempio «Risposta: 12 m/s»)";
  else motivo = "tipo di esercizio non riconosciuto, oppure la risposta indicata non coincide con quella calcolata";
  return {famiglia:null, motivo:motivo};
}
/* un esercizio generato deve passare il correttore con la propria risposta */
function controllaEsercizio(it){
  if(!it || !it.q || !it.spieg || !Array.isArray(it.guida) || it.guida.length < 2) return false;
  if(it.tipo === "scelta"){
    if(!Array.isArray(it.opz) || it.opz.length !== 4 || !(it.ok >= 0 && it.ok < 4)) return false;
    if(it.opz.some(function(o, i){ return it.opz.indexOf(o) !== i; })) return false;
  } else {
    if(!Array.isArray(it.sol) || !it.sol.length) return false;
    if(CFG.corretta){
      if(!CFG.corretta(it, it.sol[0]) || CFG.corretta(it, "")) return false;
      if(it.num && !CFG.corretta(it, String(it.num.v))) return false;
    }
  }
  if(it.grafico && typeof window !== "undefined" && window.Laboratorio && window.Laboratorio.controlla(it.grafico).length) return false;
  return true;
}
function slugGen(s){ return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/<[^>]+>|\$[^$]*\$/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "esercizi"; }
/* batteria di esercizi simili.
   opz: quanti (10, 20, 30), livelli (default: quanti/10), difficolta ("uguale" | "crescente"),
   seme, perLivello (gli esercizi hanno _livello: ogni livello si genera dai suoi), titolo, materia, anno */
function simili(items, opz){
  opz = opz || {};
  var seme = opz.seme != null ? (opz.seme >>> 0) : ((Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0);
  var rng = rng32(seme);
  var semi = (items || []).map(function(it, i){ var r = riconosci(it); return {i:i, item:it, r:r, livello:it && it._livello != null ? it._livello : 0, generati:0}; });
  var buoni = semi.filter(function(s){ return !!s.r.genera; });
  var rapporto = semi.map(function(s){ return s; });
  if(!buoni.length) return {errore:"Nessuno degli esercizi è stato riconosciuto.", rapporto:rapporto.map(riga), seme:seme};
  var livelliIn = [], nLiv, perLiv = [];
  if(opz.perLivello){
    semi.forEach(function(s){ if(livelliIn.indexOf(s.livello) < 0) livelliIn.push(s.livello); });
    livelliIn.sort(function(a, b){ return a - b; });
    nLiv = livelliIn.length;
    livelliIn.forEach(function(L){ perLiv.push(semi.filter(function(s){ return s.livello === L; }).length); });
  } else {
    var quanti = Math.max(1, Math.min(60, opz.quanti || 10));
    nLiv = Math.max(1, Math.min(6, opz.livelli || Math.ceil(quanti / 10)));
    for(var l=0; l<nLiv; l++) perLiv.push(Math.ceil(quanti / nLiv));
  }
  var visti = {}, livelli = [], fam = {};
  semi.forEach(function(s){ if(s.item && s.item.q) visti[testoPiano(s.item.q)] = 1; });
  for(var L=0; L<nLiv; L++){
    var scala = opz.difficolta === "crescente" ? [1, 1.4, 1.9, 2.4, 2.8, 3.2][L] : 1;
    var pool = opz.perLivello ? buoni.filter(function(s){ return s.livello === livelliIn[L]; }) : buoni;
    if(!pool.length) continue;
    if(opz.perLivello) perLiv[L] = Math.min(perLiv[L], pool.length * 3); // al massimo tre «gemelli» per esercizio
    var lista = [], k = 0, giri = 0;
    while(lista.length < perLiv[L] && giri < perLiv[L] * 4 + 8){
      var s = pool[k % pool.length]; k++; giri++;
      var nuovo = null;
      try{ nuovo = s.r.genera(rng, scala); }catch(e){ nuovo = null; }
      if(!nuovo || !controllaEsercizio(nuovo)) continue;
      var chiave = testoPiano(nuovo.q); if(visti[chiave]) continue; visti[chiave] = 1;
      s.generati++; fam[s.r.famiglia] = 1;
      lista.push(nuovo);
    }
    if(lista.length) livelli.push({n:"Livello " + (livelli.length + 1) + (opz.difficolta === "crescente" && nLiv > 1 ? [" - Base", " - Intermedio", " - Avanzato", " - Avanzato+", " - Esperto", " - Esperto+"][L] : " - Esercizi simili"),
                                   d:"Esercizi generati dal motore a partire da quelli caricati: stessa forma, numeri nuovi, risposta calcolata.", items:lista});
  }
  if(!livelli.length) return {errore:"Non sono riuscito a generare esercizi nuovi da quelli riconosciuti.", rapporto:rapporto.map(riga), seme:seme};
  var titolo = opz.titolo || ("Esercizi simili: " + testoPiano(buoni[0].item.q || "").replace(/\$[^$]*\$/g, "…").slice(0, 50));
  return {
    seme:seme,
    rapporto:rapporto.map(riga),
    argomento:{
      id:"gen-" + slugGen(titolo) + "-" + seme.toString(36), titolo:titolo,
      sommario:"Batteria generata automaticamente (" + Object.keys(fam).map(function(f){ return NOMI_FAM[f] || f; }).join(", ") + "): stessa forma degli esercizi di partenza, numeri nuovi e risposte calcolate dal motore.",
      materia:opz.materia || "matematica", anno:opz.anno || 1, importato:true, generato:{seme:seme, famiglie:Object.keys(fam)},
      pillole:[], formule:[], esempi:[], laboratorio:[], risorse:[], livelli:livelli
    }
  };
  function riga(s){ return {i:s.i, q:s.item && (s.item.q || (s.item.modello && s.item.modello.testo)) || "", famiglia:s.r.famiglia || null, nome:s.r.nome || null, motivo:s.r.motivo || null, generati:s.generati}; }
}
var NOMI_FAM = {};
FAMIGLIE.forEach(function(f){ NOMI_FAM[f.id] = f.nome.toLowerCase(); });
/* testo semplice: un esercizio per riga; «Risposta: …» (o «R: …», «→ …») in fondo alla riga è facoltativa */
function leggiTesto(testo){
  var out = [];
  String(testo || "").split(/\r?\n/).forEach(function(riga){
    riga = riga.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim();
    if(!riga) return;
    var risposta = null, m = /\s*(?:risposta|soluzione|risultato|\bR)\s*[:=]\s*(.+)$/i.exec(riga) || /\s+(?:→|⇒)\s*(.+)$/.exec(riga);
    if(m){ risposta = m[1].trim(); riga = riga.slice(0, m.index).trim(); }
    var it = {q:avvolgiMatematica(riga), tipo:"aperta"};
    if(risposta){
      var n = /^(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z°/²·\s]*)$/.exec(risposta);
      if(n){
        var v = parseFloat(n[1].replace(",", ".")), dec = decimaliDi(n[1].replace(",", "."));
        it.num = {v:v, tol:dec ? 0.5 * Math.pow(10, -dec) : 0}; if(n[2].trim()) it.num.u = n[2].trim();
      }
      it.sol = [risposta];
    }
    out.push(it);
  });
  return out;
}

/* ================= 15. modello proposto da Claude (claude.ai) ================= */
function richiestaModello(item){
  return "Sei un insegnante di matematica e fisica di liceo scientifico. Trasforma questo esercizio in un MODELLO PARAMETRICO, cioè lo stesso esercizio con i numeri sostituiti da parametri.\n" +
    "ESERCIZIO: " + testoPiano(item.q) + "\n" +
    (item.num ? "RISPOSTA: " + item.num.v + (item.num.u ? " " + item.num.u : "") + "\n" : item.sol ? "RISPOSTA: " + item.sol[0] + "\n" : "") +
    (item.spieg ? "SPIEGAZIONE: " + testoPiano(item.spieg) + "\n" : "") +
    "\nRispondi SOLO con un oggetto JSON con questi campi:\n" +
    "{\"testo\": testo dell'esercizio con {nome} al posto di ogni dato numerico (LaTeX fra $...$ come nell'originale),\n" +
    " \"parametri\": {nome: {\"min\": numero, \"max\": numero, \"passo\": numero}} con intervalli realistici,\n" +
    " \"originali\": {nome: valore nell'esercizio originale},\n" +
    " \"vincoli\": [\"espressione >= espressione\", ...] per scartare dati senza senso (facoltativo),\n" +
    " \"risposta\": formula che calcola la risposta dai parametri (operatori + - * / ^, sqrt(), parentesi),\n" +
    " \"unita\": unità di misura della risposta o \"\", \"decimali\": numero di decimali della risposta,\n" +
    " \"spiegazione\": spiegazione breve che usa {nome} per i dati e {risposta} per il risultato,\n" +
    " \"guida\": [{\"s\": suggerimento senza la soluzione, \"r\": passaggio svolto con {nome}/{risposta}, \"k\": [parole chiave]}] da 2 a 4 passi, l'ultimo con {risposta}}\n" +
    "La risposta deve essere un numero. Italiano, dai del tu.";
}
function modelloDaRisposta(testo, item){
  var m = String(testo || "").match(/\{[\s\S]*\}/); if(!m) return null;
  var md = prova(function(){ return JSON.parse(m[0]); }); if(!md) return null;
  var M = modelloDa(md); if(!M) return null;
  if(item && item.num && md.originali){
    var r = prova(function(){ return M.f(md.originali); });
    if(r == null || !isFinite(r) || Math.abs(r - item.num.v) > Math.max(item.num.tol || 0, 0.5 * Math.pow(10, -decimaliDi(item.num.v)), 1e-9)) return null;
  }
  return md;
}

/* ================= 16. API ================= */
var API = {
  versione:1,
  configura:function(c){ if(c && c.corretta) CFG.corretta = c.corretta; if(c && c.normalizza) CFG.normalizza = c.normalizza; },
  riconosci:function(item){ var r = riconosci(item); return {famiglia:r.famiglia || null, nome:r.nome || null, motivo:r.motivo || null}; },
  simili:simili, leggiTesto:leggiTesto, avvolgiMatematica:avvolgiMatematica,
  richiestaModello:richiestaModello, modelloDaRisposta:modelloDaRisposta,
  famiglie:function(){ return ordinate().map(function(f){ return {id:f.id, nome:f.nome}; }); },
  /* per verifica.js */
  _interni:{espressione:espressione, rPolinomio:rPolinomio, polTesto:polTesto, insiemeDaTesto:insiemeDaTesto, spezzaRelazioni:spezzaRelazioni, daLatex:daLatex, insiemeTesto:insiemeTesto, scomponiUni:scomponiUni, pUni:pUni, riconosciInterno:riconosci, rng32:rng32, controllaEsercizio:controllaEsercizio}
};
if(typeof window !== "undefined") window.Generatore = API;
if(typeof module !== "undefined" && module.exports) module.exports = API;
})();
