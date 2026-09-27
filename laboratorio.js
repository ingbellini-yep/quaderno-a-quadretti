/* =====================================================================
   QUADERNO A QUADRETTI — LABORATORIO
   ---------------------------------------------------------------------
   Motori grafici condivisi da tutte le materie. Nessuna libreria esterna:
   SVG, un lettore di espressioni scritto qui (niente eval) e CSS iniettato.

   1. MOTORE DEI GRAFICI - Laboratorio.grafico(host, spec)
      Funzioni y(x) scritte come espressioni ("20+10t"), come segmenti o
      come punti; griglia con tacche arrotondate, etichette dirette,
      mirino con lettura dei valori (puntatore e frecce da tastiera),
      triangolo della pendenza, area sotto il grafico, punti notevoli e
      tabella dei valori.

   2. MOTORE DEL MOTO - Laboratorio.moto(host, spec)
      Corpi che si muovono lungo una rotaia secondo la loro legge oraria
      s(t): stroboscopia a intervalli regolari, vettore velocità,
      fotocellule che registrano i tempi di passaggio, cursori per i
      parametri, incontri fra corpi e grafici s-t e v-t che si disegnano
      insieme al moto.

   3. TRACCIATORE - Laboratorio.tracciatore(host, spec)
      Lo studente scrive fino a quattro equazioni e le vede disegnate,
      con le intersezioni calcolate.

   Le scene si descrivono nei file dei contenuti: campo "laboratorio"
   dell'argomento (elenco di scene) e campo "grafico" di esempi ed
   esercizi (un grafico o un elenco di grafici affiancati).
   Nuovi tipi di scena (moto accelerato, molla, leva, piano inclinato...)
   si aggiungono con Laboratorio.registra("tipo", function(host, spec){...}).

   SCHEMA DI UN GRAFICO  {tipo:"grafico", ...}
     titolo:   didascalia (facoltativa)
     assi:     {x:"t", y:"s"}        nomi delle grandezze sugli assi
     unita:    {x:"s", y:"m"}        unità di misura (facoltative)
     x:        [0, 10]               intervallo orizzontale
     y:        [0, 60]               intervallo verticale (se manca: automatico, zero compreso)
     serie:    [ {nome:"A", f:"20+10t"}                     espressione nella variabile di x
               | {nome:"A", segmenti:[[x1,y1,x2,y2], ...]}  tratti (es. velocità a gradini)
               | {nome:"A", punti:[[x,y], ...]} ]          spezzata per punti
               al massimo 4 serie; "dominio":[a,b] limita un'espressione
     punti:    [ {x:20, y:400, testo:"incontro"} ]
     pendenza: {serie:0, da:2, a:6}  triangolo con Δx e Δy
     area:     {serie:0, da:0, a:10, testo:"Δs = 120 m"}  area fra la curva e l'asse x
     altezza:  pixel (facoltativo)

   SCHEMA DI UNA SCENA DI MOTO  {tipo:"moto", ...}
     titolo, testo: intestazione della scena (il testo accetta HTML e $LaTeX$)
     durata:   secondi simulati
     pista:    [min, max] posizioni rappresentate sulla rotaia
     unita:    "m" (unità delle posizioni)
     corpi:    [ {nome:"A", legge:"s0+v*t"}              legge oraria con parametri
               | {nome:"B", s0:0, t0:0, tratti:[{dt:4, v:3}, {dt:3, v:0}]} ]  moto a tratti
     parametri:[ {id:"v", nome:"velocità v", min:-10, max:10, passo:0.5, val:4, u:"m/s"} ]
     strobo:   intervallo della stroboscopia in secondi (0 = nessuna)
     traguardi:[ {s:100, nome:"F1"} ]  fotocellule
     st, vt:   {y:[min,max]} intervalli fissi dei due grafici
     vmax:     velocità che corrisponde alla freccia più lunga

   SCHEMA DEL TRACCIATORE  {tipo:"tracciatore", ...}
     titolo, testo, assi, unita, x, equazioni:["s = 20 + 10t", "s = 100 - 5t"]

   ESPRESSIONI: + - * / ^ e parentesi; moltiplicazione sottintesa (2t,
   3(t+1)); virgola decimale; sin cos tan sqrt abs exp ln log; pi, e.
   Un eventuale primo membro ("s =", "s(t) =") viene ignorato.
   ===================================================================== */

(function(){
"use strict";

var NS = "http://www.w3.org/2000/svg";
var NOMI = ["A","B","C","D"];
var MAX_SERIE = 4;
var conta = 0;

/* ================= numeri all'italiana ================= */
function formatta(x, dec){
  if(x==null || !isFinite(x)) return "—";
  var s = Number(x).toFixed(dec==null?2:dec);
  if(/^-0(\.0+)?$/.test(s)) s = s.slice(1);
  s = s.replace(".", ",");
  return s.charAt(0)==="-" ? "−"+s.slice(1) : s;
}
function formattaCorto(x, maxDec){
  if(x==null || !isFinite(x)) return "—";
  var s = Number(x).toFixed(maxDec==null?2:maxDec);
  if(s.indexOf(".")>=0) s = s.replace(/0+$/,"").replace(/\.$/,"");
  if(s==="-0") s = "0";
  s = s.replace(".", ",");
  return s.charAt(0)==="-" ? "−"+s.slice(1) : s;
}
function decimaliPer(passo){ return Math.max(0, Math.min(6, -Math.floor(Math.log(passo)/Math.LN10 + 1e-9))); }
function passoBello(ampiezza, n){
  if(!(ampiezza>0)) return 1;
  var grezzo = ampiezza/Math.max(1,n), p = Math.pow(10, Math.floor(Math.log(grezzo)/Math.LN10)), f = grezzo/p;
  return (f<1.5?1:f<3?2:f<7?5:10)*p;
}
function tacche(min, max, n){
  var passo = passoBello(max-min, n), v = [];
  for(var k=Math.ceil(min/passo-1e-9); k*passo <= max+passo*1e-9; k++) v.push(+(k*passo).toFixed(10));
  return {passo:passo, valori:v};
}
function intervalloBello(min, max, n, zero){
  if(zero!==false){ min = Math.min(min,0); max = Math.max(max,0); }
  if(!(max>min)){ var d = Math.abs(max)||1; min -= d; max += d; }
  var amp = max-min;
  if(max>0) max += amp*0.06;
  if(min<0) min -= amp*0.06;
  var passo = passoBello(max-min, n);
  return [Math.floor(min/passo+1e-9)*passo, Math.ceil(max/passo-1e-9)*passo];
}

/* ================= lettore di espressioni ================= */
var FUNZIONI = {sin:Math.sin, sen:Math.sin, cos:Math.cos, tan:Math.tan, tg:Math.tan, sqrt:Math.sqrt,
  radq:Math.sqrt, abs:Math.abs, exp:Math.exp, ln:Math.log, log:function(x){ return Math.log(x)/Math.LN10; }};
var COSTANTI = {pi:Math.PI, "π":Math.PI, e:Math.E};

function Errore(msg){ var e = new Error(msg); e.espressione = true; return e; }

function preparaTesto(src){
  var s = String(src==null?"":src).trim();
  var i = s.indexOf("=");
  if(i>=0){
    if(s.indexOf("=", i+1)>=0) throw Errore("C'è più di un segno «=».");
    s = s.slice(i+1);
  }
  s = s.replace(/[−–—]/g,"-").replace(/[×·∙⋅]/g,"*").replace(/:/g,"/")
       .replace(/²/g,"^2").replace(/³/g,"^3")
       .replace(/[₀-₉]/g, function(c){ return String(c.charCodeAt(0)-0x2080); })
       .replace(/(\d),(\d)/g,"$1.$2");
  if(!s.trim()) throw Errore("L'espressione è vuota.");
  return s;
}
function scomponi(nome, noti){
  if(noti[nome]) return [{t:"id", v:nome}];
  if(/^\d+$/.test(nome)) return [{t:"n", v:parseFloat(nome)}];
  for(var l=nome.length-1; l>=1; l--){
    var testa = nome.slice(0,l);
    if(noti[testa]){
      var resto = scomponi(nome.slice(l), noti);
      if(resto) return [{t:"id", v:testa}].concat(resto);
    }
  }
  return null;
}
function tokenizza(s, noti){
  var tk = [], i = 0, m;
  while(i < s.length){
    var c = s.charAt(i), r = s.slice(i);
    if(/\s/.test(c)){ i++; continue; }
    if((m = /^(\d+\.?\d*|\.\d+)/.exec(r))){ tk.push({t:"n", v:parseFloat(m[1])}); i += m[1].length; continue; }
    if((m = /^[A-Za-zα-ωΑ-Ω_][A-Za-z0-9α-ωΑ-Ω_]*/.exec(r))){
      var parti = scomponi(m[0], noti);
      if(!parti) throw Errore("Non conosco «"+m[0]+"»: "+elencoNoti(noti)+".");
      tk = tk.concat(parti); i += m[0].length; continue;
    }
    if("+-*/^()".indexOf(c)>=0){ tk.push({t:c}); i++; continue; }
    throw Errore("Il carattere «"+c+"» non si può usare in un'espressione.");
  }
  return tk;
}
function elencoNoti(noti){
  var v = Object.keys(noti).filter(function(k){ return noti[k]==="v"; });
  return v.length ? "le lettere ammesse sono "+v.join(", ") : "qui non sono ammesse lettere";
}
function compila(src, variabili){
  var testo = preparaTesto(src), noti = {}, usate = {};
  (variabili||[]).forEach(function(v){ noti[v] = "v"; });
  Object.keys(COSTANTI).forEach(function(k){ if(!noti[k]) noti[k] = "c"; });
  Object.keys(FUNZIONI).forEach(function(k){ if(!noti[k]) noti[k] = "f"; });
  var tk = tokenizza(testo, noti), p = 0;
  function prendi(t){ var x = tk[p]; if(x && x.t===t){ p++; return x; } return null; }
  function espr(){
    var a = termine();
    for(;;){
      if(prendi("+")) a = (function(a,b){ return function(s){ return a(s)+b(s); }; })(a, termine());
      else if(prendi("-")) a = (function(a,b){ return function(s){ return a(s)-b(s); }; })(a, termine());
      else return a;
    }
  }
  function termine(){
    var a = unario();
    for(;;){
      if(prendi("*")) a = (function(a,b){ return function(s){ return a(s)*b(s); }; })(a, unario());
      else if(prendi("/")) a = (function(a,b){ return function(s){ return a(s)/b(s); }; })(a, unario());
      else {
        var x = tk[p];
        if(x && (x.t==="n" || x.t==="id" || x.t==="(")) a = (function(a,b){ return function(s){ return a(s)*b(s); }; })(a, potenza());
        else return a;
      }
    }
  }
  function unario(){
    if(prendi("-")){ var a = unario(); return function(s){ return -a(s); }; }
    if(prendi("+")) return unario();
    return potenza();
  }
  function potenza(){
    var b = primario();
    if(prendi("^")){ var e = unario(); return function(s){ return Math.pow(b(s), e(s)); }; }
    return b;
  }
  function primario(){
    var x = tk[p];
    if(!x) throw Errore(p ? "L'espressione è incompleta: manca l'ultimo termine." : "L'espressione è vuota.");
    if(x.t==="n"){ p++; var v = x.v; return function(){ return v; }; }
    if(x.t==="("){
      p++; var e = espr();
      if(!prendi(")")) throw Errore("Manca una parentesi chiusa «)».");
      return e;
    }
    if(x.t==="id"){
      p++;
      var tipo = noti[x.v], nome = x.v;
      if(tipo==="f"){
        if(!prendi("(")) throw Errore("Dopo «"+nome+"» serve la parentesi: "+nome+"(…).");
        var arg = espr();
        if(!prendi(")")) throw Errore("Manca una parentesi chiusa «)».");
        var fn = FUNZIONI[nome];
        return function(s){ return fn(arg(s)); };
      }
      if(tipo==="c"){ var c = COSTANTI[nome]; return function(){ return c; }; }
      usate[nome] = true;
      return function(s){ return s[nome]; };
    }
    if(x.t===")") throw Errore("C'è una parentesi chiusa «)» di troppo o in un punto sbagliato.");
    throw Errore("Dopo «"+(tk[p-1] ? (tk[p-1].v!=null ? tk[p-1].v : tk[p-1].t) : x.t)+"» manca un termine.");
  }
  var radice = espr();
  if(p < tk.length){
    var r = tk[p];
    throw Errore(r.t===")" ? "C'è una parentesi chiusa «)» di troppo." : "Non riesco a leggere l'espressione da «"+(r.v!=null?r.v:r.t)+"» in poi.");
  }
  return {f:radice, usate:Object.keys(usate)};
}
/* funzione di una variabile, con eventuali parametri fissati */
function funzione(src, variabile, parametri){
  var nomi = [variabile].concat(Object.keys(parametri||{}));
  var c = compila(src, nomi), sc = {};
  Object.keys(parametri||{}).forEach(function(k){ sc[k] = parametri[k]; });
  return function(x){ sc[variabile] = x; var y = c.f(sc); return (typeof y==="number" && isFinite(y)) ? y : NaN; };
}
function prova(src, variabili){
  try{ return {ok:true, f:compila(src, variabili).f}; }
  catch(e){ return {ok:false, errore:e.message}; }
}
/* se f è lineare restituisce "s = 20 + 5t", altrimenti null */
function testoLineare(f, y, x, dec){
  var a = f(0), b = f(1)-f(0), prova1 = f(3.7), prova2 = f(-11.3);
  if(!isFinite(a) || !isFinite(b)) return null;
  if(Math.abs(prova1-(a+3.7*b)) > 1e-7*(1+Math.abs(prova1)) || Math.abs(prova2-(a-11.3*b)) > 1e-7*(1+Math.abs(prova2))) return null;
  var A = formattaCorto(a, dec==null?2:dec), B = formattaCorto(Math.abs(b), dec==null?2:dec), t;
  if(Math.abs(b) < 1e-12) t = A;
  else {
    var mono = (B==="1" ? "" : B) + x;
    if(Math.abs(a) < 1e-12) t = (b<0?"−":"") + mono;
    else t = A + (b<0 ? " − " : " + ") + mono;
  }
  return y + " = " + t;
}

/* ================= stile ================= */
var CSS = [
":root{--lab-s1:#2a78d6;--lab-s2:#eb6834;--lab-s3:#1baf7a;--lab-s4:#4a3aa7}",
"@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--lab-s1:#3987e5;--lab-s2:#d95926;--lab-s3:#199e70;--lab-s4:#9085e9}}",
":root[data-theme=\"dark\"]{--lab-s1:#3987e5;--lab-s2:#d95926;--lab-s3:#199e70;--lab-s4:#9085e9}",
".lab-scena{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;min-width:0}",
"[class^=\"lab-\"][hidden],[class*=\" lab-\"][hidden]{display:none!important}",
".lab-scena+.lab-scena{margin-top:26px;padding-top:24px;border-top:1px solid var(--line,#ddd)}",
".lab-host{min-width:0}",
".lab-host+.lab-host{margin-top:26px;padding-top:24px;border-top:1px solid var(--line,#ddd)}",
".lab-testa h3{font-size:18px;margin:0 0 4px;letter-spacing:-.02em}",
".lab-testa p{margin:0;color:var(--ink-2,#444);font-size:14.5px;max-width:72ch}",
".lab-banco{position:relative;border:1px solid var(--line,#ddd);border-radius:14px;background:var(--surface-2,#f6f6f6);padding:8px 10px 4px;overflow:hidden}",
".lab-banco svg{display:block;width:100%;height:auto}",
".lab-letture{display:flex;flex-wrap:wrap;gap:8px}",
".lab-lett{display:flex;flex-wrap:wrap;max-width:100%;align-items:baseline;gap:4px 10px;padding:8px 12px;border:1px solid var(--line,#ddd);border-radius:10px;background:var(--surface,#fff);min-width:0}",
".lab-lett .n{font-size:12.5px;color:var(--muted,#666);display:inline-flex;align-items:center;gap:6px}",
".lab-lett b{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-weight:500;font-size:14.5px;font-variant-numeric:tabular-nums;white-space:nowrap}",
".lab-lett .legge{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:12.5px;color:var(--ink-2,#444);white-space:nowrap}",
".lab-tondo{width:10px;height:10px;border-radius:50%;display:inline-block;flex:none}",
".lab-comandi{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}",
".lab-comandi label{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink-2,#444)}",
".lab-istante{flex:1 1 220px;max-width:440px}",
".lab-istante input[type=range]{flex:1;min-width:0;width:auto}",
".lab-scena input[type=range]{accent-color:var(--accent,#2a78d6)}",
".lab-scena select,.lab-traccia input[type=number]{font:inherit;font-size:13.5px;padding:4px 8px;border:1px solid var(--line-strong,#bbb);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#111)}",
".lab-parametri{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px 22px;padding:12px 14px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface,#fff)}",
".lab-par{display:grid;grid-template-columns:minmax(0,1fr) 78px;align-items:center;gap:2px 10px;font-size:13.5px;color:var(--ink-2,#444)}",
".lab-par>span{grid-column:1/3}",
".lab-par output{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;color:var(--ink,#111)}",
".lab-par input{width:100%}",
".lab-eventi{margin:0;padding:0;list-style:none;display:grid;gap:4px;font-size:13.5px;color:var(--ink-2,#444)}",
".lab-eventi b{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-weight:500;color:var(--ink,#111)}",
".lab-grafici{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;min-width:0}",
".lab-fig{margin:0;border:1px solid var(--line,#ddd);border-radius:14px;background:var(--surface,#fff);padding:10px 10px 8px;min-width:0;display:grid;gap:6px}",
".lab-cap{font-size:13.5px;font-weight:600;color:var(--ink,#111);padding:2px 4px 0}",
".lab-plot{position:relative;min-width:0}",
".lab-svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}",
".lab-svg:focus-visible{outline:2px solid var(--accent,#2a78d6);outline-offset:3px;border-radius:6px}",
".lab-svg text{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:11px;fill:var(--muted,#666);font-variant-numeric:tabular-nums}",
".lab-svg .lab-tit{font-family:\"Asap\",system-ui,sans-serif;font-size:12px;font-weight:600;fill:var(--ink-2,#444)}",
".lab-svg .lab-eti{font-family:\"Asap\",system-ui,sans-serif;font-size:12.5px;font-weight:700;fill:var(--ink,#111)}",
".lab-svg .lab-nota{font-family:\"Asap\",system-ui,sans-serif;font-size:12px;fill:var(--ink-2,#444);paint-order:stroke;stroke:var(--surface,#fff);stroke-width:4px;stroke-linejoin:round}",
".lab-griglia line{stroke:var(--line,#e3e3e3);stroke-width:1}",
".lab-zero{stroke:var(--line-strong,#bbb);stroke-width:1.25}",
".lab-mirino{stroke:var(--ink-2,#444);stroke-width:1;opacity:.55}",
".lab-tip{position:absolute;top:0;left:0;pointer-events:none;z-index:3;background:var(--surface,#fff);border:1px solid var(--line-strong,#bbb);border-radius:10px;padding:6px 10px;font-size:12.5px;box-shadow:0 8px 22px -12px rgba(20,20,40,.35);display:grid;gap:3px;min-width:120px}",
".lab-tip .x{color:var(--muted,#666);font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:11.5px}",
".lab-tip .r{display:flex;align-items:center;gap:7px;white-space:nowrap}",
".lab-tip .r b{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-weight:500;color:var(--ink,#111)}",
".lab-tip .r span{color:var(--muted,#666)}",
".lab-chiave{display:inline-block;width:16px;height:0;border-top:2.5px solid;border-radius:2px;flex:none}",
".lab-leg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--ink-2,#444);padding:0 4px}",
".lab-leg span{display:inline-flex;align-items:center;gap:7px}",
".lab-leg code{font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:12px;color:var(--muted,#666)}",
".lab-tab{font-size:13px;padding:0 4px}",
".lab-tab summary{cursor:pointer;color:var(--accent,#2a78d6);width:max-content}",
".lab-tab table{border-collapse:collapse;margin-top:6px;font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:12.5px;font-variant-numeric:tabular-nums}",
".lab-tab th,.lab-tab td{padding:3px 12px 3px 0;text-align:right;border-bottom:1px solid var(--line,#e3e3e3)}",
".lab-tab th{font-family:\"Asap\",system-ui,sans-serif;font-weight:600;color:var(--ink-2,#444)}",
".lab-traccia{display:grid;gap:8px}",
".lab-riga{display:grid;grid-template-columns:auto 22px minmax(0,1fr) auto;gap:10px;align-items:center}",
".lab-riga input[type=text]{width:100%;min-width:0;padding:8px 11px;border:1.5px solid var(--line-strong,#bbb);border-radius:10px;background:var(--surface,#fff);color:var(--ink,#111);font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:14.5px}",
".lab-riga input[type=text]:focus{outline:none;border-color:var(--accent,#2a78d6)}",
".lab-riga input[aria-invalid=true]{border-color:var(--err,#c33)}",
".lab-riga .nome{font-weight:700;font-size:14px;color:var(--ink,#111)}",
".lab-errore{grid-column:3/5;margin:-2px 0 2px;font-size:12.5px;color:var(--err,#c33)}",
".lab-limiti{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13.5px;color:var(--ink-2,#444)}",
".lab-limiti input[type=number]{width:84px}",
".lab-es{margin:2px 0 18px;max-width:620px}",
".lab-es .lab-grafici{grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))}",
".esempio .lab-es{margin:14px 18px 0;max-width:none}",
".lab-avviso{font-size:13px;color:var(--muted,#666);padding:10px 12px;border:1px dashed var(--line-strong,#bbb);border-radius:10px}",
].join("\n");
function iniettaStile(){
  if(typeof document==="undefined" || document.getElementById("lab-stile")) return;
  var st = document.createElement("style"); st.id = "lab-stile"; st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);
}

/* ================= utilità DOM ================= */
function mk(tag, cls, testo){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(testo!=null) e.textContent = testo;
  return e;
}
function colore(i){ return "var(--lab-s"+((i||0)%MAX_SERIE+1)+")"; }
function attr(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"); }
function nomeAsse(nome, unita){ return unita ? nome+" ("+unita+")" : nome; }
function vivo(el){ return !!(el && el.isConnected); }
function osservaLarghezza(el, fn){
  var ultima = el.clientWidth;
  if(typeof ResizeObserver==="undefined") return;
  var ro = new ResizeObserver(function(){
    if(!vivo(el)){ ro.disconnect(); return; }
    var w = el.clientWidth;
    if(Math.abs(w-ultima) >= 4){ ultima = w; fn(); }
  });
  ro.observe(el);
}
function testata(root, spec){
  if(!spec.titolo && !spec.testo) return;
  var t = mk("div","lab-testa");
  if(spec.titolo) t.appendChild(mk("h3", null, spec.titolo));
  if(spec.testo){ var p = mk("p"); p.innerHTML = spec.testo; t.appendChild(p); }
  root.appendChild(t);
}

/* ================= serie ================= */
function valoreSegmenti(seg){
  return function(x){
    for(var i=seg.length-1; i>=0; i--){
      var g = seg[i], a = Math.min(g[0],g[2]), b = Math.max(g[0],g[2]);
      if(x >= a-1e-9 && x <= b+1e-9) return g[2]===g[0] ? g[3] : g[1]+(g[3]-g[1])*(x-g[0])/(g[2]-g[0]);
    }
    return NaN;
  };
}
function valorePunti(pt){
  var q = pt.slice().sort(function(a,b){ return a[0]-b[0]; });
  return function(x){
    if(!q.length || x < q[0][0]-1e-9 || x > q[q.length-1][0]+1e-9) return NaN;
    for(var i=q.length-1; i>=1; i--){
      if(x >= q[i-1][0]-1e-9){
        var a = q[i-1], b = q[i];
        return b[0]===a[0] ? b[1] : a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
      }
    }
    return q[0][1];
  };
}
function variabileDi(spec){ return spec.variabile || (spec.assi && spec.assi.x) || "x"; }
function preparaSerie(spec){
  var v = variabileDi(spec), lista = (spec.serie||[]).slice(0, MAX_SERIE);
  return lista.map(function(s, i){
    var o = {nome: s.nome!=null ? String(s.nome) : (lista.length>1 ? NOMI[i] : ""), colore: s.colore!=null ? s.colore : i,
             dominio: s.dominio || null, legenda: s.legenda || null};
    if(typeof s.valore==="function"){ o.valore = s.valore; o.continua = true; }
    else if(s.f!=null){ o.valore = funzione(s.f, v, s.parametri||{}); o.continua = true; if(!o.legenda) o.legenda = s.f; }
    else if(s.segmenti){ o.segmenti = s.segmenti; o.valore = valoreSegmenti(s.segmenti); }
    else if(s.punti){ o.punti = s.punti; o.valore = valorePunti(s.punti); }
    else o.valore = function(){ return NaN; };
    return o;
  });
}
function tracciati(o, x0, x1, n){
  if(o.segmenti) return o.segmenti.map(function(g){ return [[g[0],g[1]],[g[2],g[3]]]; });
  if(o.punti) return [o.punti.slice().sort(function(a,b){ return a[0]-b[0]; })];
  var a = x0, b = x1;
  if(o.dominio){ a = Math.max(a, o.dominio[0]); b = Math.min(b, o.dominio[1]); }
  var out = [], cur = [];
  if(!(b>a)) return out;
  for(var k=0; k<=n; k++){
    var x = a+(b-a)*k/n, y = o.valore(x);
    if(isFinite(y)) cur.push([x,y]); else if(cur.length){ out.push(cur); cur = []; }
  }
  if(cur.length) out.push(cur);
  return out;
}
/* istanti in cui due funzioni si incontrano, in [a,b] */
function incroci(f, g, a, b, n){
  var r = [], dPrec = null, xPrec = null;
  n = n || 600;
  for(var k=0; k<=n; k++){
    var x = a+(b-a)*k/n, d = f(x)-g(x);
    if(!isFinite(d)){ dPrec = null; continue; }
    if(Math.abs(d) < 1e-9*(1+Math.abs(f(x)))){
      if(!r.length || x-r[r.length-1] > (b-a)/n*1.5) r.push(x);
    } else if(dPrec!==null && dPrec*d < 0){
      var lo = xPrec, hi = x, dl = dPrec;
      for(var i=0; i<60; i++){ var m = (lo+hi)/2, dm = f(m)-g(m); if(dl*dm <= 0) hi = m; else { lo = m; dl = dm; } }
      var z = (lo+hi)/2;
      if(!r.length || z-r[r.length-1] > (b-a)/n*1.5) r.push(z);
    }
    dPrec = d; xPrec = x;
  }
  return r;
}

/* ================= MOTORE DEI GRAFICI ================= */
function grafico(host, spec){
  iniettaStile();
  var id = ++conta;
  var fig = mk("figure","lab-fig");
  host.appendChild(fig);
  var cap = null;
  if(spec.titolo){ cap = mk("figcaption","lab-cap", spec.titolo); fig.appendChild(cap); }
  var zona = mk("div","lab-plot"); fig.appendChild(zona);
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class","lab-svg"); svg.setAttribute("tabindex","0"); svg.setAttribute("role","img");
  zona.appendChild(svg);
  var tip = mk("div","lab-tip"); tip.hidden = true; tip.setAttribute("aria-hidden","true"); zona.appendChild(tip);
  var leg = mk("div","lab-leg"); fig.appendChild(leg);
  var tab = mk("details","lab-tab"); fig.appendChild(tab);

  var st = {fino:null, cursore:null, area:null, punti:null, mirino:null};
  var serie, X, Y, W, H, M, passoX, passoY, decX, decY, gDin, gMir, clipFino, gFantasmi;
  var ax = (spec.assi && spec.assi.x) || variabileDi(spec), ay = (spec.assi && spec.assi.y) || "y";
  var ux = spec.unita && spec.unita.x, uy = spec.unita && spec.unita.y;

  function px(x){ return M.l + (x-X[0])/(X[1]-X[0])*(W-M.l-M.r); }
  function py(y){ return H-M.b - (y-Y[0])/(Y[1]-Y[0])*(H-M.t-M.b); }
  function dallaX(cx){ return X[0] + (cx-M.l)/(W-M.l-M.r)*(X[1]-X[0]); }

  function calcola(){
    serie = preparaSerie(spec);
    X = spec.x ? spec.x.slice() : [0,10];
    if(spec.y) Y = spec.y.slice();
    else {
      var lo = Infinity, hi = -Infinity;
      serie.forEach(function(o){ tracciati(o, X[0], X[1], 300).forEach(function(tr){ tr.forEach(function(p){ if(p[1]<lo) lo = p[1]; if(p[1]>hi) hi = p[1]; }); }); });
      (spec.punti||[]).forEach(function(p){ lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); });
      if(!isFinite(lo)){ lo = 0; hi = 1; }
      Y = intervalloBello(lo, hi, 5, spec.zero);
    }
  }
  function misura(){
    W = Math.max(240, Math.round(zona.clientWidth || 560));
    H = spec.altezza || Math.round(Math.max(210, Math.min(330, W*0.6)));
    var ty = tacche(Y[0], Y[1], H > 260 ? 6 : 5);
    var larg = 0;
    ty.valori.forEach(function(v){ larg = Math.max(larg, formatta(v, decimaliPer(ty.passo)).length); });
    M = {l: Math.max(40, 14 + larg*7), r: 34, t: 22, b: 40};
  }

  function disegna(){
    misura();
    var tx = tacche(X[0], X[1], Math.max(4, Math.min(10, Math.floor((W-M.l-M.r)/64))));
    var ty = tacche(Y[0], Y[1], H > 260 ? 6 : 5);
    passoX = tx.passo; passoY = ty.passo; decX = decimaliPer(passoX); decY = decimaliPer(passoY);
    var h = [];
    h.push('<defs><clipPath id="lab-c'+id+'"><rect x="'+M.l+'" y="'+(M.t-2)+'" width="'+(W-M.l-M.r)+'" height="'+(H-M.t-M.b+4)+'"/></clipPath>'+
           '<clipPath id="lab-f'+id+'"><rect class="lab-fino" x="0" y="0" width="'+W+'" height="'+H+'"/></clipPath></defs>');
    h.push('<g class="lab-griglia">');
    tx.valori.forEach(function(v){ h.push('<line x1="'+px(v)+'" x2="'+px(v)+'" y1="'+M.t+'" y2="'+(H-M.b)+'"/>'); });
    ty.valori.forEach(function(v){ h.push('<line x1="'+M.l+'" x2="'+(W-M.r)+'" y1="'+py(v)+'" y2="'+py(v)+'"/>'); });
    h.push('</g>');
    if(Y[0] < 0 && Y[1] > 0) h.push('<line class="lab-zero" x1="'+M.l+'" x2="'+(W-M.r)+'" y1="'+py(0)+'" y2="'+py(0)+'"/>');
    else h.push('<line class="lab-zero" x1="'+M.l+'" x2="'+(W-M.r)+'" y1="'+(H-M.b)+'" y2="'+(H-M.b)+'"/>');
    if(X[0] < 0 && X[1] > 0) h.push('<line class="lab-zero" x1="'+px(0)+'" x2="'+px(0)+'" y1="'+M.t+'" y2="'+(H-M.b)+'"/>');
    else h.push('<line class="lab-zero" x1="'+M.l+'" x2="'+M.l+'" y1="'+M.t+'" y2="'+(H-M.b)+'"/>');
    tx.valori.forEach(function(v){ h.push('<text x="'+px(v)+'" y="'+(H-M.b+16)+'" text-anchor="middle">'+formatta(v, decX)+'</text>'); });
    ty.valori.forEach(function(v){ h.push('<text x="'+(M.l-7)+'" y="'+(py(v)+3.5)+'" text-anchor="end">'+formatta(v, decY)+'</text>'); });
    h.push('<text class="lab-tit" x="'+(W-M.r)+'" y="'+(H-6)+'" text-anchor="end">'+attr(nomeAsse(ax, ux))+'</text>');
    h.push('<text class="lab-tit" x="'+(M.l-7)+'" y="12" text-anchor="start">'+attr(nomeAsse(ay, uy))+'</text>');

    h.push('<g clip-path="url(#lab-c'+id+')">');
    h.push('<g class="lab-sotto"></g>');
    if(spec.area) h.push(poligonoArea(spec.area));
    var percorsi = serie.map(function(o){
      return tracciati(o, X[0], X[1], Math.round((W-M.l-M.r)*1.5)).map(function(tr){
        return tr.map(function(p, k){ return (k?"L":"M")+px(p[0]).toFixed(1)+","+py(p[1]).toFixed(1); }).join("");
      }).join("");
    });
    h.push('<g class="lab-fantasmi" opacity="0">');
    percorsi.forEach(function(d, i){ h.push('<path d="'+d+'" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:'+colore(serie[i].colore)+'"/>'); });
    h.push('</g><g clip-path="url(#lab-f'+id+')">');
    percorsi.forEach(function(d, i){ h.push('<path d="'+d+'" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="stroke:'+colore(serie[i].colore)+'"/>'); });
    h.push('</g>');
    if(spec.pendenza) h.push(triangolo(spec.pendenza));
    h.push('</g>');
    (spec.punti||[]).forEach(function(p){ h.push(puntoSvg(p)); });
    h.push(etichetteDirette());
    h.push('<g class="lab-din"></g>');
    h.push('<g class="lab-mir" display="none"><line class="lab-mirino" y1="'+M.t+'" y2="'+(H-M.b)+'"/><g></g></g>');

    svg.setAttribute("viewBox", "0 0 "+W+" "+H);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.innerHTML = h.join("");
    svg.setAttribute("aria-label", descrizione());
    gDin = svg.querySelector(".lab-din");
    gMir = svg.querySelector(".lab-mir");
    clipFino = svg.querySelector(".lab-fino");
    gFantasmi = svg.querySelector(".lab-fantasmi");
    legenda();
    aggiorna();
    if(st.mirino!=null) mostraMirino(st.mirino);
  }
  function descrizione(){
    if(spec.descrizione) return spec.descrizione;
    var d = "Grafico di "+ay+" in funzione di "+ax+", per "+ax+" da "+formattaCorto(X[0])+" a "+formattaCorto(X[1])+(ux?" "+ux:"");
    var nomi = serie.map(function(o){ return (o.nome ? o.nome+": " : "") + (o.legenda ? ay+" = "+o.legenda : ""); }).filter(function(s){ return s.replace(/: $/,""); });
    return d + (nomi.length ? ". " + nomi.join("; ") : "") + ". I valori sono nella tabella sotto il grafico.";
  }
  function etichetteDirette(){
    if(serie.length < 2 || spec.etichette===false) return "";
    var fin = serie.map(function(o){
      var tr = tracciati(o, X[0], X[1], 200), ult = null;
      tr.forEach(function(t){ t.forEach(function(p){ if(p[0]>=X[0]-1e-9 && p[0]<=X[1]+1e-9 && p[1]>=Y[0] && p[1]<=Y[1]) ult = p; }); });
      return ult;
    });
    for(var i=0; i<fin.length; i++) for(var j=i+1; j<fin.length; j++){
      if(fin[i] && fin[j] && Math.abs(py(fin[i][1])-py(fin[j][1])) < 15 && Math.abs(px(fin[i][0])-px(fin[j][0])) < 30) return "";
    }
    return fin.map(function(p, i){
      if(!p || !serie[i].nome) return "";
      var x = px(p[0]), y = py(p[1]), fuori = x > W-M.r-4;
      return '<text class="lab-eti" x="'+(fuori ? x+6 : x+6)+'" y="'+(y+4)+'" text-anchor="start">'+attr(serie[i].nome)+'</text>';
    }).join("");
  }
  function puntoSvg(p){
    var x = px(p.x), y = py(p.y), c = p.serie!=null ? colore(serie[p.serie] ? serie[p.serie].colore : p.serie) : "var(--ink,#111)";
    var s = '<circle cx="'+x+'" cy="'+y+'" r="4.5" stroke-width="2" style="fill:'+c+';stroke:var(--surface,#fff)"/>';
    if(p.testo){
      var dx = x > W-M.r-110 ? -9 : 9, anc = dx < 0 ? "end" : "start", dy = y < M.t+18 ? 16 : -9;
      s += '<text class="lab-nota" x="'+(x+dx)+'" y="'+(y+dy)+'" text-anchor="'+anc+'">'+attr(p.testo)+'</text>';
    }
    return s;
  }
  function triangolo(t){
    var o = serie[t.serie||0]; if(!o) return "";
    var y1 = o.valore(t.da), y2 = o.valore(t.a);
    if(!isFinite(y1) || !isFinite(y2)) return "";
    var A = [px(t.da), py(y1)], B = [px(t.a), py(y1)], C = [px(t.a), py(y2)];
    var dx = t.a-t.da, dy = y2-y1;
    var s = '<path d="M'+A[0]+','+A[1]+'L'+B[0]+','+B[1]+'L'+C[0]+','+C[1]+'" fill="none" stroke-width="1.25" style="stroke:var(--ink-2,#444)"/>';
    var sotto = dy >= 0;
    s += '<text class="lab-nota" x="'+((A[0]+B[0])/2)+'" y="'+(B[1]+(sotto?16:-7))+'" text-anchor="middle">Δ'+attr(ax)+' = '+formattaCorto(dx, 3)+(ux?" "+attr(ux):"")+'</text>';
    s += '<text class="lab-nota" x="'+(B[0]+7)+'" y="'+((B[1]+C[1])/2+4)+'" text-anchor="start">Δ'+attr(ay)+' = '+formattaCorto(dy, 3)+(uy?" "+attr(uy):"")+'</text>';
    return s;
  }
  function poligonoArea(a){
    var o = serie[a.serie||0]; if(!o || !(a.a > a.da)) return "";
    var xs = [], k, n = 80;
    for(k=0; k<=n; k++) xs.push(a.da+(a.a-a.da)*k/n);
    if(o.segmenti) o.segmenti.forEach(function(g){ [g[0],g[2]].forEach(function(x){ if(x>a.da && x<a.a){ xs.push(x-1e-7); xs.push(x+1e-7); } }); });
    xs.sort(function(p,q){ return p-q; });
    var pts = [[px(a.da), py(0)]];
    xs.forEach(function(x){ var y = o.valore(x); if(isFinite(y)) pts.push([px(x), py(y)]); });
    pts.push([px(a.a), py(0)]);
    var s = '<polygon points="'+pts.map(function(p){ return p[0].toFixed(1)+","+p[1].toFixed(1); }).join(" ")+'" style="fill:'+colore(o.colore)+'" fill-opacity=".14"/>';
    if(a.testo){
      var xm = (a.da+a.a)/2, ym = o.valore(xm)/2;
      s += '<text class="lab-nota" x="'+px(xm)+'" y="'+(py(ym)+4)+'" text-anchor="middle">'+attr(a.testo)+'</text>';
    }
    return s;
  }
  function legenda(){
    leg.innerHTML = "";
    if(serie.length < 2 || spec.legenda===false){ leg.hidden = true; return; }
    leg.hidden = false;
    serie.forEach(function(o){
      var s = mk("span"), k = mk("i","lab-chiave");
      k.style.borderColor = colore(o.colore);
      s.appendChild(k); s.appendChild(document.createTextNode(o.nome || ""));
      if(o.legenda){ s.appendChild(mk("code", null, ay+" = "+o.legenda)); }
      leg.appendChild(s);
    });
  }
  function tabella(){
    tab.innerHTML = "";
    var sm = mk("summary", null, "Tabella dei valori"); tab.appendChild(sm);
    var tb = mk("table"), tr = mk("tr");
    tr.appendChild(mk("th", null, nomeAsse(ax, ux)));
    serie.forEach(function(o){ tr.appendChild(mk("th", null, (serie.length>1 && o.nome ? o.nome+": " : "")+nomeAsse(ay, uy))); });
    tb.appendChild(tr);
    var tx = tacche(X[0], X[1], 10), dec = decimaliPer(tx.passo);
    tx.valori.forEach(function(x){
      var r = mk("tr");
      r.appendChild(mk("td", null, formatta(x, dec)));
      serie.forEach(function(o){ r.appendChild(mk("td", null, formattaCorto(o.valore(x), 3))); });
      tb.appendChild(r);
    });
    tab.appendChild(tb);
  }

  /* parte che cambia durante le animazioni */
  function aggiorna(){
    if(!clipFino) return;
    var animato = st.fino != null;
    clipFino.setAttribute("width", animato ? Math.max(0, px(Math.min(Math.max(st.fino, X[0]), X[1]))) : W);
    gFantasmi.setAttribute("opacity", animato ? ".22" : "0");
    var h = [];
    if(st.area) h.push(poligonoArea(st.area));
    if(st.cursore != null && st.cursore >= X[0] && st.cursore <= X[1]){
      var cx = px(st.cursore);
      h.push('<line class="lab-mirino" x1="'+cx+'" x2="'+cx+'" y1="'+M.t+'" y2="'+(H-M.b)+'"/>');
      serie.forEach(function(o){
        var y = o.valore(st.cursore);
        if(isFinite(y) && y >= Y[0] && y <= Y[1]) h.push('<circle cx="'+cx+'" cy="'+py(y)+'" r="4.5" stroke-width="2" style="fill:'+colore(o.colore)+';stroke:var(--surface,#fff)"/>');
      });
    }
    (st.punti||[]).forEach(function(p){ h.push(puntoSvg(p)); });
    gDin.innerHTML = h.join("");
  }

  /* mirino con lettura dei valori */
  function mostraMirino(x){
    x = Math.min(Math.max(x, X[0]), X[1]);
    var q = passoX/10; x = Math.round(x/q)*q;
    st.mirino = x;
    var cx = px(x);
    gMir.setAttribute("display", "");
    var linea = gMir.querySelector("line"); linea.setAttribute("x1", cx); linea.setAttribute("x2", cx);
    var pallini = [];
    tip.innerHTML = "";
    tip.appendChild(mk("div","x", ax+" = "+formatta(x, decX+1)+(ux?" "+ux:"")));
    serie.forEach(function(o){
      var y = o.valore(x);
      if(isFinite(y) && y >= Y[0] && y <= Y[1]) pallini.push('<circle cx="'+cx+'" cy="'+py(y)+'" r="4.5" stroke-width="2" style="fill:'+colore(o.colore)+';stroke:var(--surface,#fff)"/>');
      var r = mk("div","r"), k = mk("i","lab-chiave"); k.style.borderColor = colore(o.colore);
      r.appendChild(k);
      r.appendChild(mk("b", null, ay+" = "+(isFinite(y) ? formatta(y, Math.min(4, decY+1)) : "—")+(uy&&isFinite(y)?" "+uy:"")));
      if(o.nome && serie.length>1) r.appendChild(mk("span", null, o.nome));
      tip.appendChild(r);
    });
    gMir.querySelector("g").innerHTML = pallini.join("");
    tip.hidden = false;
    var scala = (svg.getBoundingClientRect().width || W)/W;
    var left = cx*scala + 14, tw = tip.offsetWidth || 140;
    if(left + tw > zona.clientWidth) left = cx*scala - tw - 14;
    tip.style.transform = "translate("+Math.max(0,left)+"px,"+(M.t*scala+4)+"px)";
  }
  function nascondiMirino(){ st.mirino = null; if(gMir) gMir.setAttribute("display","none"); tip.hidden = true; }
  svg.addEventListener("pointermove", function(ev){
    var r = svg.getBoundingClientRect(), cx = (ev.clientX - r.left)*W/r.width;
    if(cx < M.l-10 || cx > W-M.r+10){ nascondiMirino(); return; }
    mostraMirino(dallaX(cx));
  });
  svg.addEventListener("pointerleave", nascondiMirino);
  svg.addEventListener("blur", nascondiMirino);
  svg.addEventListener("focus", function(){ mostraMirino(st.cursore!=null ? st.cursore : (X[0]+X[1])/2); });
  svg.addEventListener("keydown", function(ev){
    if(st.mirino==null) return;
    var q = passoX/10*(ev.shiftKey?10:1);
    if(ev.key==="ArrowRight"){ ev.preventDefault(); mostraMirino(st.mirino+q); }
    else if(ev.key==="ArrowLeft"){ ev.preventDefault(); mostraMirino(st.mirino-q); }
    else if(ev.key==="Home"){ ev.preventDefault(); mostraMirino(X[0]); }
    else if(ev.key==="End"){ ev.preventDefault(); mostraMirino(X[1]); }
    else if(ev.key==="Escape"){ nascondiMirino(); }
  });

  calcola(); disegna(); tabella();
  osservaLarghezza(zona, disegna);

  return {
    elemento: fig,
    imposta: function(o){ for(var k in o) st[k] = o[k]; aggiorna(); },
    ridisegna: function(nuova){ if(nuova) spec = nuova; ax = (spec.assi && spec.assi.x) || variabileDi(spec); ay = (spec.assi && spec.assi.y) || "y"; calcola(); disegna(); tabella(); },
    serie: function(){ return serie; },
    intervallo: function(){ return {x:X.slice(), y:Y.slice()}; }
  };
}

/* ================= MOTORE DEL MOTO ================= */
function corpo(c, i, par, durata){
  var o = {nome: c.nome || NOMI[i], colore: c.colore!=null ? c.colore : i};
  if(c.tratti){
    var t0 = c.t0||0, s = c.s0||0, t = t0, nodi = [[t0, s]], seg = [];
    c.tratti.forEach(function(tr){
      var t2 = t+tr.dt, s2 = s+tr.v*tr.dt;
      seg.push([t, tr.v, t2, tr.v]); nodi.push([t2, s2]); t = t2; s = s2;
    });
    var fine = t;
    o.s = function(x){
      if(x <= nodi[0][0]) return nodi[0][1];
      for(var k=1; k<nodi.length; k++){
        if(x <= nodi[k][0]){ var a = nodi[k-1], b = nodi[k]; return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]); }
      }
      return nodi[nodi.length-1][1];
    };
    o.v = function(x){
      if(x < t0 || x > fine) return 0;
      for(var k=0; k<seg.length; k++){ if(x < seg[k][2] || k===seg.length-1) return seg[k][1]; }
      return 0;
    };
    var pS = nodi.slice(), sV = seg.slice();
    if(t0 > 0){ pS.unshift([0, nodi[0][1]]); sV.unshift([0,0,t0,0]); }
    if(fine < durata){ pS.push([durata, nodi[nodi.length-1][1]]); sV.push([fine,0,durata,0]); }
    o.serieS = {punti:pS}; o.serieV = {segmenti:sV};
  } else {
    var f = funzione(c.legge, "t", par), h = Math.max(1e-5, durata*1e-6);
    o.s = f;
    o.v = function(x){ return (f(x+h)-f(x-h))/(2*h); };
    o.serieS = {valore:f}; o.serieV = {valore:o.v};
    o.legge = testoLineare(f, "s", "t");
  }
  o.serieS.nome = o.serieV.nome = o.nome;
  o.serieS.colore = o.serieV.colore = o.colore;
  if(o.legge){ o.serieS.legenda = o.legge.replace(/^s = /,""); }
  return o;
}

function moto(host, spec){
  iniettaStile();
  var root = mk("div","lab-scena lab-moto");
  host.appendChild(root);
  testata(root, spec);
  var durata = spec.durata || 10, U = spec.unita || "m", UT = "s", UV = U+"/"+UT;
  var par = {};
  (spec.parametri||[]).forEach(function(p){ par[p.id] = p.val; });
  var corpi = [], incontri = [], passaggi = [];
  var t = 0, inCorsa = false, raf = 0, ultimo = 0;
  var dt0 = spec.strobo!=null ? spec.strobo : passoBello(durata, 10);
  var conStrobo = dt0 > 0;

  /* banco con la rotaia */
  var banco = mk("div","lab-banco"); root.appendChild(banco);
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class","lab-svg lab-rotaia"); svg.setAttribute("role","img");
  banco.appendChild(svg);
  var gMobile;

  /* letture */
  var letture = mk("div","lab-letture"); root.appendChild(letture);
  var lettT = mk("div","lab-lett"), bT = mk("b");
  lettT.appendChild(mk("span","n","Tempo")); lettT.appendChild(bT); letture.appendChild(lettT);
  var lettC = [];

  /* comandi */
  var comandi = mk("div","lab-comandi"); root.appendChild(comandi);
  var bVai = mk("button","btn piccolo","Avvia"); bVai.type = "button";
  var bCapo = mk("button","btn neutro piccolo","Da capo"); bCapo.type = "button";
  var lT = mk("label","lab-istante"); lT.appendChild(document.createTextNode("Istante"));
  var rT = mk("input"); rT.type = "range"; rT.min = 0; rT.max = durata; rT.step = durata/500; rT.value = 0;
  rT.setAttribute("aria-label","Istante di tempo mostrato"); lT.appendChild(rT);
  var lV = mk("label"); lV.appendChild(document.createTextNode("Riproduzione"));
  var sV = mk("select");
  var predef = durata <= 12 ? 1 : durata <= 30 ? 2 : durata <= 90 ? 5 : 10;
  [0.5,1,2,5,10].forEach(function(k){
    var o = mk("option", null, "×"+formattaCorto(k, 1)+(k===1?" (tempo reale)":""));
    o.value = k; if(k===predef) o.selected = true; sV.appendChild(o);
  });
  lV.appendChild(sV);
  var lS = mk("label"), cS = mk("input"); cS.type = "checkbox"; cS.checked = conStrobo;
  lS.appendChild(cS); lS.appendChild(document.createTextNode("Stroboscopia ogni "+formattaCorto(dt0 || 1, 2)+" s"));
  comandi.appendChild(bVai); comandi.appendChild(bCapo); comandi.appendChild(lT); comandi.appendChild(lV);
  if(dt0 > 0) comandi.appendChild(lS);

  /* parametri */
  if(spec.parametri && spec.parametri.length){
    var box = mk("div","lab-parametri"); root.appendChild(box);
    spec.parametri.forEach(function(p){
      var l = mk("label","lab-par"), nome = mk("span"); nome.innerHTML = p.nome || p.id;
      var r = mk("input"); r.type = "range"; r.min = p.min; r.max = p.max; r.step = p.passo || (p.max-p.min)/100; r.value = p.val;
      var out = mk("output");
      var dec = decimaliPer(p.passo || 1);
      function scrivi(){ out.textContent = formatta(par[p.id], dec)+(p.u ? " "+p.u : ""); }
      scrivi();
      r.addEventListener("input", function(){ par[p.id] = parseFloat(r.value); scrivi(); ricostruisci(); });
      l.appendChild(nome); l.appendChild(r); l.appendChild(out); box.appendChild(l);
    });
  }

  var eventi = mk("ul","lab-eventi"); root.appendChild(eventi);

  /* grafici */
  var zonaG = mk("div","lab-grafici"); root.appendChild(zonaG);
  var vuoleST = !spec.grafici || spec.grafici.indexOf("st")>=0, vuoleVT = !spec.grafici || spec.grafici.indexOf("vt")>=0;
  var gS = null, gV = null;

  function specST(){
    return {titolo:"Spazio-tempo", assi:{x:"t", y:"s"}, unita:{x:UT, y:U}, x:[0,durata], y:spec.st && spec.st.y,
            serie:corpi.map(function(c){ return c.serieS; }),
            descrizione:"Grafico spazio-tempo: posizione s dei corpi in funzione del tempo t, da 0 a "+formattaCorto(durata)+" s."};
  }
  function specVT(){
    return {titolo:"Velocità-tempo", assi:{x:"t", y:"v"}, unita:{x:UT, y:UV}, x:[0,durata], y:spec.vt && spec.vt.y,
            serie:corpi.map(function(c){ return c.serieV; }), etichette:true,
            descrizione:"Grafico velocità-tempo: velocità v dei corpi in funzione del tempo t, da 0 a "+formattaCorto(durata)+" s. L'area fra la linea e l'asse dei tempi è lo spostamento."};
  }

  function ricostruisci(){
    corpi = spec.corpi.slice(0, MAX_SERIE).map(function(c, i){ return corpo(c, i, par, durata); });
    incontri = [];
    for(var i=0; i<corpi.length; i++) for(var j=i+1; j<corpi.length; j++){
      incroci(corpi[i].s, corpi[j].s, 0, durata, 800).forEach(function(tc){
        incontri.push({t:tc, s:corpi[i].s(tc), a:corpi[i].nome, b:corpi[j].nome});
      });
    }
    passaggi = (spec.traguardi||[]).map(function(g, k){
      return {g:g, nome:g.nome || ("F"+(k+1)), tempi:corpi.map(function(c){
        var r = incroci(c.s, function(){ return g.s; }, 0, durata, 800); return r.length ? r[0] : null;
      })};
    });
    if(gS) gS.ridisegna(specST()); else if(vuoleST) gS = grafico(zonaG, specST());
    if(gV) gV.ridisegna(specVT()); else if(vuoleVT) gV = grafico(zonaG, specVT());
    costruisciLetture();
    disegnaPista();
    aggiorna();
  }
  function costruisciLetture(){
    lettC.forEach(function(x){ letture.removeChild(x.el); });
    lettC = corpi.map(function(c){
      var el = mk("div","lab-lett"), n = mk("span","n"), k = mk("i","lab-tondo");
      k.style.background = colore(c.colore);
      n.appendChild(k); n.appendChild(document.createTextNode(c.nome));
      var bs = mk("b"), bv = mk("b");
      el.appendChild(n); el.appendChild(bs); el.appendChild(bv);
      if(c.legge) el.appendChild(mk("span","legge", c.legge));
      letture.appendChild(el);
      return {el:el, s:bs, v:bv};
    });
  }

  var P = {};   // geometria della pista
  function disegnaPista(){
    var W = Math.max(300, Math.round(banco.clientWidth - 20 || 640));
    var n = corpi.length, corsia = 50, alto = spec.traguardi && spec.traguardi.length ? 26 : 10, righello = 34;
    var H = alto + n*corsia + righello;
    var pista = spec.pista || (function(){
      var lo = Infinity, hi = -Infinity;
      corpi.forEach(function(c){ for(var k=0; k<=100; k++){ var y = c.s(durata*k/100); lo = Math.min(lo,y); hi = Math.max(hi,y); } });
      return intervalloBello(lo, hi, 6, false);
    })();
    var sx = 36, dx = 22;
    P = {W:W, H:H, alto:alto, corsia:corsia, pista:pista, x0:sx+dx, x1:W-dx};
    var h = [];
    var tk = tacche(pista[0], pista[1], Math.max(4, Math.min(12, Math.floor((P.x1-P.x0)/70))));
    var dec = decimaliPer(tk.passo), yR = alto + n*corsia + 4;
    for(var i=0; i<n; i++){
      var y = alto + i*corsia + 30;
      h.push('<text class="lab-eti" x="4" y="'+(y+2)+'">'+attr(corpi[i].nome)+'</text>');
      h.push('<rect x="'+sx+'" y="'+y+'" width="'+(W-sx)+'" height="7" rx="3.5" style="fill:var(--line-strong,#bbb)"/>');
      for(var fx=sx+8; fx<W-4; fx+=12) h.push('<circle cx="'+fx+'" cy="'+(y+3.5)+'" r="1.1" style="fill:var(--surface-2,#f6f6f6)"/>');
    }
    h.push('<line x1="'+sx+'" x2="'+W+'" y1="'+yR+'" y2="'+yR+'" style="stroke:var(--line-strong,#bbb)"/>');
    var fine = tk.passo/5;
    for(var v=Math.ceil(pista[0]/fine-1e-9)*fine; v<=pista[1]+1e-9; v+=fine){
      var X = xs(v), maggiore = Math.abs(v/tk.passo - Math.round(v/tk.passo)) < 1e-6;
      h.push('<line x1="'+X+'" x2="'+X+'" y1="'+yR+'" y2="'+(yR+(maggiore?8:4))+'" style="stroke:var(--line-strong,#bbb)"/>');
      if(maggiore) h.push('<text x="'+X+'" y="'+(yR+21)+'" text-anchor="middle">'+formatta(v, dec)+'</text>');
    }
    h.push('<text class="lab-tit" x="4" y="'+(yR+21)+'">s ('+attr(U)+')</text>');
    (spec.traguardi||[]).forEach(function(g, k){
      var X = xs(g.s);
      h.push('<line x1="'+X+'" x2="'+X+'" y1="16" y2="'+(yR)+'" stroke-width="1" style="stroke:var(--ink-2,#444)" opacity=".55"/>');
      h.push('<rect x="'+(X-4)+'" y="12" width="8" height="9" rx="2" style="fill:var(--ink-2,#444)"/>');
      h.push('<text class="lab-tit" x="'+(X+8)+'" y="20">'+attr(g.nome || ("F"+(k+1)))+'</text>');
    });
    h.push('<g class="lab-mobile"></g>');
    svg.setAttribute("viewBox", "0 0 "+W+" "+H);
    svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.innerHTML = h.join("");
    svg.setAttribute("aria-label", "Rotaia con "+(n===1?"un carrello":n+" carrelli")+": posizioni da "+formattaCorto(pista[0])+" a "+formattaCorto(pista[1])+" "+U+". Le letture numeriche sono sotto la rotaia.");
    gMobile = svg.querySelector(".lab-mobile");
  }
  function xs(s){ return P.x0 + (s-P.pista[0])/(P.pista[1]-P.pista[0])*(P.x1-P.x0); }

  function vmax(){
    if(spec.vmax) return spec.vmax;
    var m = 0;
    corpi.forEach(function(c){ for(var k=0; k<=60; k++){ m = Math.max(m, Math.abs(c.v(durata*k/60))); } });
    return m || 1;
  }
  function carrello(x, y, c, opaco, pieno){
    var w = 30, h = 14, s = '';
    if(pieno){
      s += '<rect x="'+(x-w/2)+'" y="'+(y-h)+'" width="'+w+'" height="'+h+'" rx="4" stroke-width="2" style="fill:'+colore(c.colore)+';stroke:var(--surface-2,#f6f6f6)" opacity="'+opaco+'"/>';
      s += '<rect x="'+(x-1.5)+'" y="'+(y-h-11)+'" width="3" height="11" rx="1" style="fill:'+colore(c.colore)+'" opacity="'+opaco+'"/>';
    } else {
      /* immagine stroboscopica: la sola bandierina, sottile, così i segni non si sovrappongono */
      s += '<rect x="'+(x-1.25)+'" y="'+(y-h-9)+'" width="2.5" height="'+(h+9)+'" rx="1.25" style="fill:'+colore(c.colore)+'" opacity=".38"/>';
    }
    return s;
  }
  function aggiornaPista(){
    if(!gMobile) return;
    var h = [], vm = vmax();
    corpi.forEach(function(c, i){
      var y = P.alto + i*P.corsia + 30, s = c.s(t), fuori = s < P.pista[0] || s > P.pista[1];
      if(cS.checked && dt0 > 0){
        for(var k=0; k*dt0 <= t+1e-9; k++){
          var sk = c.s(k*dt0);
          if(sk >= P.pista[0] && sk <= P.pista[1]) h.push(carrello(xs(sk), y, c, 1, false));
        }
      }
      var X = xs(Math.min(Math.max(s, P.pista[0]), P.pista[1]));
      h.push(carrello(X, y, c, fuori ? .35 : 1, true));
      if(fuori){
        var verso = s > P.pista[1] ? 1 : -1;
        h.push('<path d="M'+(X+verso*20)+','+(y-12)+'l'+(verso*6)+',5l'+(-verso*6)+',5" fill="none" stroke-width="1.5" style="stroke:var(--ink-2,#444)"/>');
      }
      var v = c.v(t);
      if(Math.abs(v) > vm*1e-3){
        var L = Math.max(8, Math.min(1, Math.abs(v)/vm)*64), d = v > 0 ? 1 : -1, ya = y-31, xa = X + d*4;
        h.push('<path d="M'+xa+','+ya+'h'+(d*L)+'" stroke-width="2" stroke-linecap="round" style="stroke:'+colore(c.colore)+'"/>'+
               '<path d="M'+(xa+d*L)+','+ya+'l'+(-d*7)+',-4.5v9z" style="fill:'+colore(c.colore)+'"/>');
      }
    });
    gMobile.innerHTML = h.join("");
  }

  function aggiorna(){
    bT.textContent = "t = "+formatta(t, 2)+" s";
    corpi.forEach(function(c, i){
      if(!lettC[i]) return;
      lettC[i].s.textContent = "s = "+formatta(c.s(t), 1)+" "+U;
      lettC[i].v.textContent = "v = "+formatta(c.v(t), 1)+" "+UV;
    });
    aggiornaPista();
    var raggiunti = incontri.filter(function(x){ return x.t <= t+1e-9; });
    if(gS) gS.imposta({fino:t, cursore:t, punti:raggiunti.map(function(x){ return {x:x.t, y:x.s, testo:"incontro"}; })});
    if(gV) gV.imposta({fino:t, cursore:t, area: corpi.length===1 && t > 0 ? {serie:0, da:0, a:t} : null});
    rT.value = t;
    var r = [];
    raggiunti.forEach(function(x){ r.push({pre:x.a+" e "+x.b+" nella stessa posizione: ", val:"t = "+formatta(x.t, 2)+" s, s = "+formatta(x.s, 1)+" "+U}); });
    passaggi.forEach(function(p){
      var parti = corpi.map(function(c, i){ var tp = p.tempi[i]; return c.nome+" "+(tp!=null && tp <= t+1e-9 ? formatta(tp, 2)+" s" : "—"); });
      r.push({pre:"Fotocellula "+p.nome+" ("+formattaCorto(p.g.s)+" "+U+"): ", val:parti.join(" · ")});
    });
    if(corpi.length===1 && gV && t > 0) r.push({pre:"Area sotto il grafico v-t da 0 a "+formatta(t, 2)+" s: ", val:"Δs = "+formatta(corpi[0].s(t)-corpi[0].s(0), 1)+" "+U});
    eventi.innerHTML = "";
    r.forEach(function(x){ var li = mk("li"); li.appendChild(document.createTextNode(x.pre)); li.appendChild(mk("b", null, x.val)); eventi.appendChild(li); });
    eventi.hidden = !r.length;
  }

  function ciclo(ts){
    if(!vivo(root)){ inCorsa = false; return; }
    var dt = Math.min(0.1, (ts-ultimo)/1000); ultimo = ts;
    t += dt*parseFloat(sV.value);
    if(t >= durata){ t = durata; ferma(); }
    aggiorna();
    if(inCorsa) raf = requestAnimationFrame(ciclo);
  }
  function avvia(){
    if(t >= durata-1e-9) t = 0;
    inCorsa = true; bVai.textContent = "Pausa";
    ultimo = performance.now(); raf = requestAnimationFrame(ciclo);
  }
  function ferma(){ inCorsa = false; bVai.textContent = t >= durata-1e-9 ? "Rivedi" : "Riprendi"; cancelAnimationFrame(raf); }
  bVai.addEventListener("click", function(){ if(inCorsa) ferma(); else avvia(); });
  bCapo.addEventListener("click", function(){ ferma(); t = 0; bVai.textContent = "Avvia"; aggiorna(); });
  rT.addEventListener("input", function(){ if(inCorsa) ferma(); t = parseFloat(rT.value); if(t===0) bVai.textContent = "Avvia"; aggiorna(); });
  cS.addEventListener("change", aggiorna);

  ricostruisci();
  osservaLarghezza(banco, function(){ disegnaPista(); aggiornaPista(); });

  return {
    elemento: root,
    istante: function(x){ if(x==null) return t; if(inCorsa) ferma(); t = Math.min(Math.max(x,0), durata); aggiorna(); },
    avvia: avvia, ferma: ferma,
    parametro: function(id, val){ par[id] = val; ricostruisci(); }
  };
}

/* ================= TRACCIATORE DI EQUAZIONI ================= */
function tracciatore(host, spec){
  iniettaStile();
  var root = mk("div","lab-scena lab-traccia");
  host.appendChild(root);
  testata(root, spec);
  var v = variabileDi(spec), ay = (spec.assi && spec.assi.y) || "y";
  var ux = spec.unita && spec.unita.x, uy = spec.unita && spec.unita.y;
  var righe = [], X = (spec.x || [0,10]).slice();
  var elenco = mk("div","lab-traccia"); root.appendChild(elenco);
  var sotto = mk("div","lab-limiti"); root.appendChild(sotto);
  var bAgg = mk("button","btn neutro piccolo","Aggiungi un'equazione"); bAgg.type = "button";
  var lDa = mk("label"), iDa = mk("input"); iDa.type = "number"; iDa.value = X[0]; iDa.step = "any";
  lDa.appendChild(document.createTextNode(v+" da")); lDa.appendChild(iDa);
  var lA = mk("label"), iA = mk("input"); iA.type = "number"; iA.value = X[1]; iA.step = "any";
  lA.appendChild(document.createTextNode("a")); lA.appendChild(iA);
  sotto.appendChild(bAgg); sotto.appendChild(lDa); sotto.appendChild(lA);
  var zona = mk("div"); root.appendChild(zona);
  var eventi = mk("ul","lab-eventi"); eventi.setAttribute("aria-live","polite"); root.appendChild(eventi);
  var g = null, attesa = 0;

  function slotLibero(){ for(var k=0; k<MAX_SERIE; k++){ if(!righe.some(function(r){ return r.slot===k; })) return k; } return -1; }
  function aggiungi(testo){
    var slot = slotLibero(); if(slot < 0) return;
    var r = {slot:slot, el:mk("div","lab-riga")};
    var k = mk("i","lab-chiave"); k.style.borderColor = colore(slot);
    var n = mk("span","nome", NOMI[slot]);
    var inp = mk("input"); inp.type = "text"; inp.value = testo || ""; inp.spellcheck = false; inp.autocomplete = "off";
    inp.setAttribute("aria-label","Equazione "+NOMI[slot]); inp.placeholder = ay+" = …";
    var tog = mk("button","btn ghost piccolo","Togli"); tog.type = "button";
    var err = mk("div","lab-errore"); err.hidden = true; err.id = "lab-err-"+(++conta);
    inp.setAttribute("aria-describedby", err.id);
    r.el.appendChild(k); r.el.appendChild(n); r.el.appendChild(inp); r.el.appendChild(tog); r.el.appendChild(err);
    r.inp = inp; r.err = err;
    inp.addEventListener("input", function(){ clearTimeout(attesa); attesa = setTimeout(ridisegna, 220); });
    tog.addEventListener("click", function(){ righe = righe.filter(function(x){ return x!==r; }); elenco.removeChild(r.el); ridisegna(); });
    righe.push(r); righe.sort(function(a,b){ return a.slot-b.slot; });
    elenco.innerHTML = ""; righe.forEach(function(x){ elenco.appendChild(x.el); });
    bAgg.disabled = righe.length >= MAX_SERIE;
    return r;
  }
  function ridisegna(){
    var a = parseFloat(String(iDa.value).replace(",", ".")), b = parseFloat(String(iA.value).replace(",", "."));
    if(isFinite(a) && isFinite(b) && b > a) X = [a,b];
    var serie = [], fn = [];
    righe.forEach(function(r){
      var tx = r.inp.value.trim();
      if(!tx){ r.err.hidden = true; r.inp.removeAttribute("aria-invalid"); return; }
      try{
        var f = funzione(tx, v, {});
        r.err.hidden = true; r.inp.removeAttribute("aria-invalid");
        serie.push({nome:NOMI[r.slot], colore:r.slot, valore:f, legenda:tx.replace(/^[^=]*=\s*/,"")});
        fn.push({nome:NOMI[r.slot], f:f});
      }catch(e){
        r.err.textContent = e.message; r.err.hidden = false; r.inp.setAttribute("aria-invalid","true");
      }
    });
    bAgg.disabled = righe.length >= MAX_SERIE;
    var pt = [], testi = [];
    for(var i=0; i<fn.length; i++) for(var j=i+1; j<fn.length; j++){
      incroci(fn[i].f, fn[j].f, X[0], X[1], 1000).slice(0, 4).forEach(function(x){
        var y = fn[i].f(x);
        pt.push({x:x, y:y});
        testi.push({pre:fn[i].nome+" e "+fn[j].nome+" si intersecano in ", val:v+" = "+formattaCorto(x, 3)+(ux?" "+ux:"")+", "+ay+" = "+formattaCorto(y, 3)+(uy?" "+uy:"")});
      });
    }
    var sp = {assi:spec.assi, unita:spec.unita, variabile:v, x:X, y:spec.y, serie:serie, punti:pt, legenda:false, altezza:spec.altezza};
    if(g) g.ridisegna(sp); else g = grafico(zona, sp);
    eventi.innerHTML = "";
    if(!serie.length){ var li0 = mk("li", null, "Scrivi almeno un'equazione, per esempio "+ay+" = 20 + 10"+v+"."); eventi.appendChild(li0); }
    else if(fn.length > 1 && !testi.length){ eventi.appendChild(mk("li", null, "Nessuna intersezione per "+v+" fra "+formattaCorto(X[0])+" e "+formattaCorto(X[1])+".")); }
    testi.forEach(function(x){ var li = mk("li"); li.appendChild(document.createTextNode(x.pre)); li.appendChild(mk("b", null, x.val)); eventi.appendChild(li); });
  }
  (spec.equazioni && spec.equazioni.length ? spec.equazioni : [""]).slice(0, MAX_SERIE).forEach(function(e){ aggiungi(e); });
  bAgg.addEventListener("click", function(){ var r = aggiungi(""); if(r) r.inp.focus(); ridisegna(); });
  iDa.addEventListener("change", ridisegna); iA.addEventListener("change", ridisegna);
  ridisegna();
  return {elemento: root, ridisegna: ridisegna};
}

/* ================= registro delle scene ================= */
var TIPI = {
  grafico: function(host, spec){
    if(spec.scena){ var root = mk("div","lab-scena"); host.appendChild(root); testata(root, spec); var s = {}; for(var k in spec) if(k!=="titolo" && k!=="testo") s[k] = spec[k]; s.titolo = spec.didascalia; return grafico(root, s); }
    return grafico(host, spec);
  },
  moto: moto,
  tracciatore: tracciatore
};
function registra(tipo, fn){ TIPI[tipo] = fn; }
function monta(host, spec){
  iniettaStile();
  if(Array.isArray(spec)){
    var box = mk("div","lab-grafici"); host.appendChild(box);
    return spec.map(function(s){ return monta(box, s); });
  }
  var tipo = (spec && spec.tipo) || "grafico", fn = TIPI[tipo];
  try{
    if(!fn) throw new Error("tipo di scena sconosciuto «"+tipo+"»");
    return fn(host, spec);
  }catch(e){
    var a = mk("div","lab-avviso", "Questa figura non si può disegnare: "+e.message);
    host.appendChild(a);
    if(typeof console!=="undefined") console.error(e);
    return null;
  }
}

/* ================= controlli sulle descrizioni (usati da verifica.js) ================= */
function controlla(spec){
  var p = [];
  function intervallo(v, nome){ if(v!=null && !(Array.isArray(v) && v.length===2 && isFinite(v[0]) && isFinite(v[1]) && v[1]>v[0])) p.push(nome+" non valido"); }
  function espr(src, nomi, a, b, dove){
    try{
      var c = compila(src, nomi), sc = {}, buoni = 0;
      for(var k=0; k<=40; k++){
        nomi.forEach(function(n){ sc[n] = 1; });
        sc[nomi[0]] = a+(b-a)*k/40;
        (spec.parametri||[]).forEach(function(q){ sc[q.id] = q.val; });
        if(isFinite(c.f(sc))) buoni++;
      }
      if(buoni < 36) p.push(dove+": «"+src+"» non è definita su gran parte dell'intervallo");
    }catch(e){ p.push(dove+": «"+src+"» - "+e.message); }
  }
  if(Array.isArray(spec)){ spec.forEach(function(s){ p = p.concat(controlla(s)); }); return p; }
  if(!spec || typeof spec!=="object") return ["descrizione mancante"];
  var tipo = spec.tipo || "grafico";
  if(!TIPI[tipo]) return ["tipo sconosciuto «"+tipo+"»"];
  if(tipo==="grafico"){
    intervallo(spec.x, "x"); intervallo(spec.y, "y");
    var X = spec.x || [0,10], v = variabileDi(spec);
    if(!Array.isArray(spec.serie) || !spec.serie.length || spec.serie.length > MAX_SERIE) p.push("da 1 a "+MAX_SERIE+" serie");
    (spec.serie||[]).forEach(function(s, i){
      if(s.f!=null) espr(s.f, [v], s.dominio ? s.dominio[0] : X[0], s.dominio ? s.dominio[1] : X[1], "serie "+i);
      else if(s.segmenti){ if(!s.segmenti.every(function(g){ return g.length===4 && g.every(isFinite); })) p.push("serie "+i+": segmenti non validi"); }
      else if(s.punti){ if(!s.punti.every(function(g){ return g.length===2 && g.every(isFinite); })) p.push("serie "+i+": punti non validi"); }
      else p.push("serie "+i+": manca f, segmenti o punti");
    });
    (spec.punti||[]).forEach(function(q, i){ if(!isFinite(q.x) || !isFinite(q.y)) p.push("punto "+i+" non valido"); });
    [["pendenza",spec.pendenza],["area",spec.area]].forEach(function(z){
      if(z[1] && !(spec.serie && spec.serie[z[1].serie||0] && z[1].a > z[1].da)) p.push(z[0]+" non valida");
    });
  } else if(tipo==="moto"){
    if(!(spec.durata > 0)) p.push("durata non valida");
    intervallo(spec.pista, "pista");
    var nomi = ["t"].concat((spec.parametri||[]).map(function(q){ return q.id; }));
    (spec.parametri||[]).forEach(function(q){
      if(!q.id || !(q.max > q.min) || !(q.val >= q.min && q.val <= q.max) || !(q.passo > 0)) p.push("parametro «"+q.id+"» non valido");
    });
    if(!Array.isArray(spec.corpi) || !spec.corpi.length || spec.corpi.length > MAX_SERIE) p.push("da 1 a "+MAX_SERIE+" corpi");
    (spec.corpi||[]).forEach(function(c, i){
      if(c.tratti){ if(!c.tratti.length || !c.tratti.every(function(tr){ return tr.dt > 0 && isFinite(tr.v); })) p.push("corpo "+i+": tratti non validi"); }
      else if(c.legge!=null) espr(c.legge, nomi, 0, spec.durata||10, "corpo "+i);
      else p.push("corpo "+i+": manca legge o tratti");
    });
    (spec.traguardi||[]).forEach(function(g, i){ if(!isFinite(g.s)) p.push("traguardo "+i+" non valido"); });
    if(spec.st) intervallo(spec.st.y, "st.y");
    if(spec.vt) intervallo(spec.vt.y, "vt.y");
  } else if(tipo==="tracciatore"){
    intervallo(spec.x, "x");
    var X2 = spec.x || [0,10];
    (spec.equazioni||[]).forEach(function(e, i){ espr(e, [variabileDi(spec)], X2[0], X2[1], "equazione "+i); });
    if((spec.equazioni||[]).length > MAX_SERIE) p.push("troppe equazioni");
  }
  return p;
}

var API = {
  versione: 1,
  compila: compila, funzione: funzione, prova: prova, incroci: incroci,
  formatta: formatta, formattaCorto: formattaCorto, testoLineare: testoLineare,
  grafico: grafico, moto: moto, tracciatore: tracciatore,
  monta: monta, registra: registra, controlla: controlla,
  tipi: function(){ return Object.keys(TIPI); }
};
if(typeof window!=="undefined") window.Laboratorio = API;
if(typeof module!=="undefined" && module.exports) module.exports = API;
})();
