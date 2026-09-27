/* =====================================================================
   QUADERNO A QUADRETTI — BARRA DEI SIMBOLI
   ---------------------------------------------------------------------
   Tasti cliccabili per scrivere potenze, radici, frazioni e confronti
   nei campi di testo, senza cercare i caratteri sulla tastiera.

   COME SI USA
   - Ogni campo con l'attributo data-simboli (input o textarea) mostra la
     barra sotto di sé quando riceve il fuoco e la nasconde quando lo perde.
     Il valore dell'attributo sceglie dove metterla: vuoto = subito dopo il
     campo; "dopo:.selettore" = dopo il contenitore indicato; "dentro:.selettore"
     = in fondo al contenitore indicato (utile nelle righe a griglia).
   - I tasti inseriscono il testo al posto del cursore; se c'è del testo
     selezionato, potenze e radici lo racchiudono: selezionato "x+1",
     il tasto √ produce √(x+1).
   - «xⁿ» e «ⁿ√» chiedono l'esponente o l'indice: un numero (4) oppure una
     lettera (n). Cifre e n diventano apici (x⁴, xⁿ, ⁴√), il resto si
     scrive come ^(…).
   - Quello che i tasti scrivono è compreso sia dal correttore (x² vale x^2,
     √(2) vale √2 e sqrt(2), ≥ vale >=) sia dal lettore di espressioni del
     laboratorio.

   COME SI ESTENDE
   Simboli.registra({
     id:"logaritmi", nome:"Esponenziali e logaritmi", ordine:40,
     anni:[3,4,5],             // facoltativo: anni in cui il gruppo è visibile subito
     materie:["matematica"],   // facoltativo: materie in cui è visibile subito
     simboli:[ {etichetta:"log", titolo:"Logaritmo", avvolgi:["log(", ")"]}, ... ]
   });
   Un simbolo ha:
     etichetta   testo del tasto (può contenere <sup>, <sub>, <i>)
     titolo      descrizione per il suggerimento e per i lettori di schermo
     inserisci   testo da inserire al cursore
     avvolgi     [prima, dopo]: racchiude la selezione, o mette il cursore in mezzo
     potenza     testo dell'apice da applicare (es. "²"): con una selezione di più
                 caratteri produce (selezione)²
     frazione    true: (selezione)/(…) con il cursore al denominatore
     chiedi      {etichetta:"Esponente", tipo:"esponente"|"indice"}: mostra un campo
                 per l'esponente o l'indice e poi si comporta come potenza o radice
   I gruppi fuori contesto restano raggiungibili con il tasto «Altri simboli».
   Il contesto (materia e anno) lo fornisce la pagina con Simboli.contesto(fn).
   ===================================================================== */

(function(){
"use strict";

var GRUPPI = [];
var fornisciContesto = function(){ return {}; };
var APICI = {"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","n":"ⁿ","+":"⁺","-":"⁻"};

function registra(g){
  if(!g || !g.id || !Array.isArray(g.simboli)) return;
  GRUPPI = GRUPPI.filter(function(x){ return x.id !== g.id; });
  GRUPPI.push(g);
  GRUPPI.sort(function(a, b){ return (a.ordine||0) - (b.ordine||0); });
  if(barra) costruisci(ultimoContesto);
}
function contesto(fn){ if(typeof fn === "function") fornisciContesto = fn; }
function inContesto(g, c){
  if(g.anni && (!c || g.anni.indexOf(Number(c.anno)) < 0)) return false;
  if(g.materie && (!c || g.materie.indexOf(c.materia) < 0)) return false;
  return true;
}
/* "4" -> "⁴", "n" -> "ⁿ"; null se non si può scrivere come apice */
function apice(s){
  s = String(s).trim();
  if(!s || !/^[0-9n+\-]+$/.test(s)) return null;
  return s.split("").map(function(c){ return APICI[c]; }).join("");
}

/* ---------- gruppi di base ---------- */
registra({id:"potenze", nome:"Potenze e radici", ordine:10, simboli:[
  {etichetta:"<i>x</i><sup>2</sup>", titolo:"Elevato al quadrato", potenza:"²"},
  {etichetta:"<i>x</i><sup>3</sup>", titolo:"Elevato al cubo", potenza:"³"},
  {etichetta:"<i>x</i><sup><i>n</i></sup>", titolo:"Elevato a un esponente da indicare (numero o lettera)", chiedi:{etichetta:"Esponente", tipo:"esponente"}},
  {etichetta:"√<span class=\"sb-radicando\"><i>x</i></span>", titolo:"Radice quadrata", avvolgi:["√(", ")"]},
  {etichetta:"∛<span class=\"sb-radicando\"><i>x</i></span>", titolo:"Radice cubica", avvolgi:["∛(", ")"]},
  {etichetta:"<sup><i>n</i></sup>√<span class=\"sb-radicando\"><i>x</i></span>", titolo:"Radice con indice da indicare (numero o lettera)", chiedi:{etichetta:"Indice", tipo:"indice"}}
]});
registra({id:"frazioni", nome:"Frazioni", ordine:20, simboli:[
  {etichetta:"<span class=\"sb-fraz\"><i>a</i><i>b</i></span>", titolo:"Frazione: numeratore e denominatore fra parentesi", frazione:true}
]});
registra({id:"confronti", nome:"Uguaglianze e disuguaglianze", ordine:30, simboli:[
  {etichetta:"=", titolo:"Uguale", inserisci:"="},
  {etichetta:">", titolo:"Maggiore", inserisci:">"},
  {etichetta:"<", titolo:"Minore", inserisci:"<"},
  {etichetta:"≥", titolo:"Maggiore o uguale", inserisci:"≥"},
  {etichetta:"≤", titolo:"Minore o uguale", inserisci:"≤"}
]});
/* ---------- gruppi per gli anni successivi (visibili subito dal 3º anno) ---------- */
registra({id:"logaritmi", nome:"Esponenziali e logaritmi", ordine:40, anni:[3,4,5], simboli:[
  {etichetta:"<i>e</i><sup><i>x</i></sup>", titolo:"Esponenziale in base e", avvolgi:["e^(", ")"]},
  {etichetta:"<i>a</i><sup><i>x</i></sup>", titolo:"Potenza con esponente da scrivere", avvolgi:["^(", ")"]},
  {etichetta:"log", titolo:"Logaritmo decimale", avvolgi:["log(", ")"]},
  {etichetta:"ln", titolo:"Logaritmo naturale", avvolgi:["ln(", ")"]},
  {etichetta:"log<sub><i>b</i></sub>", titolo:"Logaritmo in base b", avvolgi:["log_(", ")()"]}
]});
registra({id:"goniometria", nome:"Goniometria", ordine:50, anni:[3,4,5], simboli:[
  {etichetta:"sin", titolo:"Seno", avvolgi:["sin(", ")"]},
  {etichetta:"cos", titolo:"Coseno", avvolgi:["cos(", ")"]},
  {etichetta:"tan", titolo:"Tangente", avvolgi:["tan(", ")"]},
  {etichetta:"π", titolo:"Pi greco", inserisci:"π"},
  {etichetta:"°", titolo:"Gradi", inserisci:"°"}
]});

/* ---------- stile ---------- */
var CSS = [
".sb-barra{flex-basis:100%;grid-column:1/-1;width:100%;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin-top:6px;padding:6px 8px;border:1px solid var(--line,#ddd);border-radius:12px;background:var(--surface-2,#f6f6fa)}",
".sb-barra[hidden]{display:none!important}",
".sb-gruppo{display:flex;flex-wrap:wrap;gap:4px}",
".sb-gruppo+.sb-gruppo{padding-left:10px;border-left:1px solid var(--line,#ddd)}",
".sb-tasto{min-width:40px;height:34px;padding:0 8px;display:inline-grid;place-items:center;border:1px solid var(--line-strong,#bbb);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#111);font-family:\"Spectral\",\"Cambria Math\",\"STIX Two Math\",Georgia,serif;font-size:17px;line-height:1;cursor:pointer;touch-action:manipulation}",
".sb-glifo{display:inline-block;white-space:nowrap}",
".sb-tasto:hover{border-color:var(--accent,#2a78d6);background:var(--accent-soft,#eef)}",
".sb-tasto:active{transform:translateY(1px)}",
".sb-tasto:focus-visible{outline:2px solid var(--accent,#2a78d6);outline-offset:1px}",
".sb-tasto sup{font-size:.62em;vertical-align:.7em;line-height:0}",
".sb-tasto sub{font-size:.62em;vertical-align:-.35em;line-height:0}",
".sb-radicando{border-top:1.4px solid currentColor;padding:0 1px;margin-left:-1px}",
".sb-fraz{display:inline-grid;line-height:1;font-size:.8em}",
".sb-fraz i:first-child{border-bottom:1.4px solid currentColor;padding:0 3px 1px}",
".sb-fraz i:last-child{padding-top:1px}",
".sb-altri{margin-left:auto;border:0;background:none;color:var(--accent,#2a78d6);font:inherit;font-size:13px;cursor:pointer;padding:4px 2px}",
".sb-chiedi{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13.5px;color:var(--ink-2,#444)}",
".sb-chiedi input{width:84px;padding:6px 9px;border:1.5px solid var(--accent,#2a78d6);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#111);font-family:\"IBM Plex Mono\",ui-monospace,monospace;font-size:14px}",
".sb-chiedi button{border:1px solid var(--line-strong,#bbb);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#111);font:inherit;font-size:13px;padding:5px 10px;cursor:pointer}",
".sb-chiedi button.sb-ok{background:var(--accent,#2a78d6);border-color:var(--accent,#2a78d6);color:var(--on-accent,#fff)}",
".sb-avviso{font-size:12.5px;color:var(--err,#c33)}",
"@media (max-width:560px){.sb-gruppo+.sb-gruppo{border-left:0;padding-left:0}.sb-barra{gap:6px}}"
].join("\n");
function stile(){
  if(document.getElementById("sb-stile")) return;
  var s = document.createElement("style"); s.id = "sb-stile"; s.textContent = CSS;
  (document.head || document.documentElement).appendChild(s);
}

/* ---------- barra ---------- */
var barra = null, campo = null, mostraTutti = false, ultimoContesto = {}, memo = null;
function mk(tag, cls, testo){ var e = document.createElement(tag); if(cls) e.className = cls; if(testo != null) e.textContent = testo; return e; }

function costruisci(c){
  ultimoContesto = c || {};
  barra.innerHTML = "";
  var nascosti = 0;
  GRUPPI.forEach(function(g){
    var visibile = inContesto(g, ultimoContesto);
    if(!visibile) nascosti++;
    if(!visibile && !mostraTutti) return;
    var box = mk("div", "sb-gruppo");
    box.setAttribute("role", "group"); box.setAttribute("aria-label", g.nome);
    g.simboli.forEach(function(s){
      var b = mk("button", "sb-tasto"); b.type = "button";
      b.innerHTML = '<span class="sb-glifo">'+s.etichetta+'</span>'; b.title = s.titolo; b.setAttribute("aria-label", s.titolo);
      b.addEventListener("mousedown", function(ev){ ev.preventDefault(); });
      b.addEventListener("click", function(){ premi(s); });
      box.appendChild(b);
    });
    barra.appendChild(box);
  });
  if(nascosti){
    var t = mk("button", "sb-altri", mostraTutti ? "Meno simboli" : "Altri simboli"); t.type = "button";
    t.setAttribute("aria-expanded", mostraTutti ? "true" : "false");
    t.addEventListener("mousedown", function(ev){ ev.preventDefault(); });
    t.addEventListener("click", function(){ mostraTutti = !mostraTutti; costruisci(ultimoContesto); if(campo) campo.focus(); });
    barra.appendChild(t);
  }
}

/* testo inserito al cursore (o al posto della selezione); cur = posizione finale del cursore
   relativa all'inizio del testo inserito */
function scrivi(testo, cur, sel){
  var el = campo; if(!el) return;
  var a = sel ? sel[0] : el.selectionStart, b = sel ? sel[1] : el.selectionEnd;
  if(a == null){ a = b = el.value.length; }
  el.focus();
  el.setRangeText(testo, a, b, "end");
  var p = a + (cur == null ? testo.length : cur);
  el.setSelectionRange(p, p);
  el.dispatchEvent(new Event("input", {bubbles:true}));
}
function selezione(sel){
  var el = campo, a = sel ? sel[0] : el.selectionStart, b = sel ? sel[1] : el.selectionEnd;
  return el.value.slice(a, b);
}
/* racchiude fra parentesi solo quando serve: non un numero, non una lettera,
   non un'espressione già tutta fra parentesi */
function giaRacchiusa(s){
  if(!/^\(.*\)$/.test(s)) return false;
  for(var i=0, l=0; i<s.length; i++){ if(s[i]==="(") l++; else if(s[i]===")"){ l--; if(l===0 && i < s.length-1) return false; } }
  return true;
}
function racchiudi(s){ return (!s || /^([0-9.,]+|[A-Za-z])$/.test(s) || giaRacchiusa(s)) ? s : "("+s+")"; }
function applicaPotenza(ap, sel){
  scrivi(racchiudi(selezione(sel))+ap, null, sel);
}
function applicaAvvolgi(prima, dopo, sel){
  var s = selezione(sel);
  scrivi(prima+s+dopo, s ? null : prima.length, sel);
}
function premi(s, sel){
  if(!campo) return;
  if(s.chiedi){ chiedi(s); return; }
  if(s.potenza) applicaPotenza(s.potenza, sel);
  else if(s.frazione){
    var t = selezione(sel);
    if(t){ var n = giaRacchiusa(t) ? t : "("+t+")"; scrivi(n+"/()", n.length+2, sel); }
    else scrivi("()/()", 1, sel);
  }
  else if(s.avvolgi) applicaAvvolgi(s.avvolgi[0], s.avvolgi[1], sel);
  else if(s.inserisci) scrivi(s.inserisci, null, sel);
}
/* campo per l'esponente o l'indice, dentro la barra */
function chiedi(s){
  var el = campo, sel = [el.selectionStart, el.selectionEnd];
  memo = {campo:el, sel:sel};
  var box = mk("div", "sb-chiedi"), lab = mk("label"), inp = mk("input");
  lab.appendChild(document.createTextNode(s.chiedi.etichetta+" "));
  inp.type = "text"; inp.autocomplete = "off"; inp.spellcheck = false; inp.placeholder = "4 oppure n";
  inp.setAttribute("aria-label", s.chiedi.etichetta+": un numero oppure una lettera");
  lab.appendChild(inp);
  var ok = mk("button", "sb-ok", "Inserisci"); ok.type = "button";
  var no = mk("button", null, "Annulla"); no.type = "button";
  var avv = mk("span", "sb-avviso"); avv.hidden = true;
  box.appendChild(lab); box.appendChild(ok); box.appendChild(no); box.appendChild(avv);
  barra.innerHTML = ""; barra.appendChild(box);
  inp.focus();
  function chiudi(){ campo = memo.campo; costruisci(ultimoContesto); campo.focus(); campo.setSelectionRange(memo.sel[0], memo.sel[1]); }
  function conferma(){
    var v = inp.value.trim();
    if(!v){ avv.textContent = "Scrivi un numero o una lettera."; avv.hidden = false; inp.focus(); return; }
    if(s.chiedi.tipo === "indice" && !/^([0-9]+|[a-zA-Z])$/.test(v)){ avv.textContent = "L'indice è un numero intero oppure una lettera."; avv.hidden = false; inp.focus(); return; }
    campo = memo.campo;
    var ap = apice(v);
    if(s.chiedi.tipo === "esponente"){
      if(ap) applicaPotenza(ap, memo.sel);
      else scrivi(racchiudi(selezione(memo.sel))+"^("+v+")", null, memo.sel);
    } else {
      applicaAvvolgi((ap || "^("+v+")")+"√(", ")", memo.sel);
    }
    costruisci(ultimoContesto);
  }
  ok.addEventListener("click", conferma);
  no.addEventListener("click", chiudi);
  inp.addEventListener("keydown", function(ev){
    if(ev.key === "Enter"){ ev.preventDefault(); ev.stopPropagation(); conferma(); }
    else if(ev.key === "Escape"){ ev.preventDefault(); chiudi(); }
  });
}

/* posizione della barra, dal valore di data-simboli:
   ""            subito dopo il campo
   "dopo:SEL"    dopo il contenitore più vicino che corrisponde a SEL
   "dentro:SEL"  in fondo al contenitore più vicino che corrisponde a SEL */
function colloca(el){
  var v = el.getAttribute("data-simboli") || "", m = /^(dopo|dentro):(.+)$/.exec(v), box = m ? el.closest(m[2]) : null;
  if(box && m[1] === "dentro"){ if(barra.parentNode !== box || box.lastChild !== barra) box.appendChild(barra); }
  else {
    var rif = box || el;
    if(rif.nextSibling !== barra) rif.parentNode.insertBefore(barra, rif.nextSibling);
  }
}
function mostra(el){
  if(!barra){
    barra = mk("div", "sb-barra"); barra.setAttribute("role", "toolbar"); barra.setAttribute("aria-label", "Simboli matematici");
    /* un clic sullo sfondo della barra non deve togliere il cursore dal campo */
    barra.addEventListener("mousedown", function(ev){ if(ev.target.tagName !== "INPUT") ev.preventDefault(); });
  }
  campo = el;
  var c = {};
  try{ c = fornisciContesto(el) || {}; }catch(e){}
  costruisci(c);
  colloca(el);
  barra.hidden = false;
}
function nascondiSeFuori(){
  setTimeout(function(){
    var a = document.activeElement;
    if(!barra || barra.hidden) return;
    if(a && (a === campo || barra.contains(a))) return;
    barra.hidden = true;
  }, 0);
}
function avvia(){
  if(typeof document === "undefined") return;
  stile();
  document.addEventListener("focusin", function(ev){
    var el = ev.target;
    if(el && el.matches && el.matches("input[data-simboli],textarea[data-simboli]")) mostra(el);
  });
  document.addEventListener("focusout", nascondiSeFuori);
}

var API = {versione:1, registra:registra, contesto:contesto, gruppi:function(){ return GRUPPI.slice(); }, apice:apice};
if(typeof window !== "undefined"){ window.Simboli = API; avvia(); }
if(typeof module !== "undefined" && module.exports) module.exports = API;
})();
