# Verifica indipendente con SymPy degli esercizi prodotti da generatore.js.
# Uso, dalla cartella del progetto:
#   node verifica.js . --campione campione.json
#   python verifica_generatore.py campione.json
# Per ogni esercizio algebrico rilegge il LaTeX del testo (non usa i calcoli del generatore),
# ricalcola la risposta con SymPy e la confronta con quella dichiarata. I problemi con unità
# di misura e i modelli sono ricalcolati dal generatore con la formula verificata sull'esercizio
# originale: qui vengono solo contati.
import json, re, sys
from sympy import (Symbol, S, Interval, Union, FiniteSet, Complement, Intersection, EmptySet, solveset, Eq, Ne,
                   expand, factor_list, Poly, discriminant, div, simplify, sqrt, Rational, together, fraction, nsimplify, floor, ceiling)
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application, convert_xor

LETTERE = {c: Symbol(c, real=True) for c in "abcdfghjklmnpqrstuvwxyz"}
TRASF = standard_transformations + (implicit_multiplication_application, convert_xor)

def graffa(s, i):
    l = 0
    for j in range(i, len(s)):
        if s[j] == "{": l += 1
        elif s[j] == "}":
            l -= 1
            if l == 0: return j
    return -1

def da_latex(t):
    t = str(t)
    while True:
        m = re.search(r"\\[dt]?frac\s*\{", t)
        if not m: break
        i1 = m.end() - 1; j1 = graffa(t, i1)
        j2 = graffa(t, j1 + 1)
        t = t[:m.start()] + "((" + t[i1 + 1:j1] + ")/(" + t[j1 + 2:j2] + "))" + t[j2 + 1:]
    t = re.sub(r"\\sqrt\s*\{", "sqrt{", t)
    t = t.replace("\\left", "").replace("\\right", "").replace("{,}", ".")
    t = re.sub(r"\\(cdot|times)", "*", t)
    t = re.sub(r"\\(leqslant|leq|le)\b", "<=", t); t = re.sub(r"\\(geqslant|geq|ge)\b", ">=", t); t = re.sub(r"\\(neq|ne)\b", "!=", t)
    t = re.sub(r"\\(,|;|!|quad|qquad| )", " ", t)
    t = t.replace("{", "(").replace("}", ")").replace("−", "-").replace("·", "*").replace("≤", "<=").replace("≥", ">=").replace("≠", "!=").replace("√", "sqrt")
    t = t.replace("²", "^2").replace("³", "^3")
    t = re.sub(r"(\d),(\d)", r"\1.\2", t)
    return t

def espr(t):
    t = t.replace(":", "/")
    t = re.sub(r"sqrt(\d+)", r"sqrt(\1)", t)
    return parse_expr(t, local_dict=dict(LETTERE), transformations=TRASF)

def segmenti(q): return re.findall(r"\$([^$]+)\$", q)
def piano(q): return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"\$[^$]+\$", " § ", q))).lower()

OPS = r"(<=|>=|!=|<|>|=)"
def relazioni(testo):
    # testo semplice con una o più relazioni a catena -> lista (lhs, op, rhs)
    parti = re.split(OPS, testo)
    if len(parti) < 3: return None
    out = []
    for i in range(0, len(parti) - 2, 2):
        out.append((parti[i].strip(), parti[i + 1], parti[i + 2].strip()))
    return out

def insieme_rel(rels, x):
    R = S.Reals
    for (a, op, b) in rels:
        f = espr(a) - espr(b)
        rel = {"<": f < 0, ">": f > 0, "<=": f <= 0, ">=": f >= 0, "=": Eq(f, 0), "!=": Ne(f, 0)}[op]
        R = Intersection(R, solveset(rel, x, S.Reals))
    return R

def insieme_risposta(testo, x, latex=False):
    t = re.sub(r"<[^>]+>", " ", str(testo)).lower()
    if re.search(r"nessuna soluzione|impossibile|∅", t): return S.EmptySet
    if re.search(r"per ogni|sempre verificat|ℝ|mathbb", t): return S.Reals
    if latex:
        mat = " ".join(segmenti(str(testo))) or str(testo)
        t = da_latex(mat.replace("\\vee", "∨").replace("\\wedge", "∧"))
    else:
        t = da_latex(str(testo))
    U = S.EmptySet
    for pezzo in t.split("∨"):
        I = S.Reals
        for parte in pezzo.split("∧"):
            r = relazioni(parte.strip())
            if r is None: return None
            I = Intersection(I, insieme_rel(r, x))
        U = Union(U, I)
    return U

def uguali(A, B): return A is not None and B is not None and simplify(A.symmetric_difference(B)) == S.EmptySet

def interi(R):
    sup, inf = R.sup, R.inf
    if sup == S.Infinity or inf == S.NegativeInfinity: return None
    return [k for k in range(int(floor(inf)) - 1, int(ceiling(sup)) + 2) if R.contains(k) == True]

def lettera(t):
    l = sorted(set(re.findall(r"[a-z]", re.sub(r"sqrt", "", t))))
    return LETTERE[l[0]] if len(l) == 1 else None

def principale_rel(q):
    segs = segmenti(q)
    for s in segs:
        if "\\begin{cases}" in s:
            righe = re.search(r"\\begin\{cases\}(.*)\\end\{cases\}", s, re.S).group(1).split("\\\\")
            rels = []
            for r in righe:
                rr = relazioni(da_latex(r.replace("&", "")))
                if rr: rels += rr
            return rels
    cand = []
    for s in segs:
        p = da_latex(s); r = relazioni(p)
        if not r: continue
        if len(r) == 1 and r[0][1] == "=" and re.fullmatch(r"[a-zA-Z](\([a-z]\))?", r[0][0].replace(" ", "")) and re.search(r"[a-z]", r[0][2]): continue  # definizione
        if all(op == "=" and re.fullmatch(r"[a-zA-Z]", a.strip()) and not re.search(r"[a-zA-Z]", b) for a, op, b in r): continue  # assegnazione
        cand.append(r)
    if len(cand) == 1: return cand[0]
    if not cand:
        pi = piano(q)
        es = [da_latex(s) for s in segs if re.search(r"\d", s) and not relazioni(da_latex(s))]
        es = [e.split("=", 1)[-1] for e in es]
        op = ">=" if "non negativ" in pi else "<=" if "non positiv" in pi else ">" if "positiv" in pi else "<" if "negativ" in pi else "=" if re.search(r"\b(zeri|radici|soluzioni)\b", pi) else None
        if len(es) == 1 and op: return [(es[0], op, "0")]
    return None

def num_da_insieme(R, pi, x):
    if re.search(r"quant[ie] (numeri |zeri |valori |soluzioni )?inter", pi): I = interi(R); return None if I is None else len(I)
    if re.search(r"(più piccolo|minimo|minore) (numero |valore )?intero", pi):
        for k in range(1 if "positiv" in pi else -200, 400):
            if R.contains(k) == True: return k
    if re.search(r"(più grande|massimo|maggiore) (numero |valore )?intero", pi):
        for k in range(400, -400, -1):
            if R.contains(k) == True: return k
    if isinstance(R, FiniteSet):
        v = sorted(R, key=lambda z: float(z))
        if re.search(r"(soluzione|radice|zero) maggiore", pi): return v[-1]
        if re.search(r"(soluzione|radice|zero) minore", pi): return v[0]
        if re.search(r"somma", pi): return sum(v)
        if re.search(r"quant[ie] (soluzioni|radici|zeri)", pi): return len(v)
        if len(v) == 1: return v[0]
    return None

def risposta_num(it): return float(it["num"]["v"])
def vicino(a, b, tol): return a is not None and abs(float(a) - float(b)) <= max(tol, 1e-9) + 1e-9 * abs(float(b))

def controlla(it):
    fam, q, pi = it.get("generato"), it["q"], piano(it["q"])
    if fam == "risolvi":
        rels = principale_rel(q)
        if not rels: return "relazione non trovata"
        x = lettera("".join(a + b for a, _, b in rels))
        R = insieme_rel(rels, x)
        if it["tipo"] == "scelta":
            if not uguali(R, insieme_risposta(it["opz"][it["ok"]], x, True)): return "opzione corretta sbagliata"
            for k, o in enumerate(it["opz"]):
                if k != it["ok"] and uguali(R, insieme_risposta(o, x, True)): return "un distrattore è corretto"
        elif it.get("num"):
            v = num_da_insieme(R, pi, x)
            if not vicino(v, risposta_num(it), it["num"].get("tol", 0)): return "valore %s invece di %s" % (v, risposta_num(it))
        else:
            if not uguali(R, insieme_risposta(it["sol"][0], x)): return "soluzione %s invece di %s" % (it["sol"][0], R)
        return None
    if fam in ("sviluppa", "scomponi", "esistenza", "delta"):
        segs = [s for s in segmenti(q) if re.search(r"[0-9a-z]", s)]
        e = da_latex(segs[0]).split("=", 1)[-1] if fam != "sviluppa" else da_latex(segs[0])
        E = espr(e)
        if fam == "sviluppa":
            if "grado" in pi: return None if vicino(Poly(E).total_degree(), risposta_num(it), 0) else "grado"
            if it["tipo"] == "scelta": A = espr(da_latex(" ".join(segmenti(it["opz"][it["ok"]]))))
            elif it.get("num"): return None if vicino(expand(E), risposta_num(it), it["num"].get("tol", 0) + abs(risposta_num(it)) * 1e-9) else "valore"
            else: A = espr(da_latex(it["sol"][0]))
            return None if expand(simplify(E) - A) == 0 else "sviluppo %s invece di %s" % (it.get("sol", [""])[0], expand(E))
        if fam == "scomponi":
            A = espr(da_latex(" ".join(segmenti(it["opz"][it["ok"]])) if it["tipo"] == "scelta" else it["sol"][0]))
            if expand(A - E) != 0: return "la scomposizione non ridà il polinomio"
            x = lettera(e)
            for f in (A.args if A.is_Mul else [A]):
                base = f.base if f.is_Pow else f
                if base.is_number: continue
                if not Poly(base, x).is_irreducible: return "fattore %s ancora scomponibile" % base
            return None
        if fam == "esistenza":
            x = lettera(e); den = fraction(together(E))[1]
            Z = solveset(Eq(den, 0), x, S.Reals)
            if it.get("num"): return None if len(Z) == 1 and vicino(list(Z)[0], risposta_num(it), it["num"].get("tol", 0)) else "valore escluso"
            return None if uguali(Complement(S.Reals, Z), insieme_risposta(it["sol"][0], x)) else "condizione di esistenza"
        if fam == "delta":
            x = lettera(e)
            return None if vicino(discriminant(E, x), risposta_num(it), 0) else "discriminante"
    if fam == "dividi":
        segs = segmenti(q)
        P = D = None
        for s in segs:
            m = re.match(r"^\s*\\?\(?(.*)\)\s*:\s*\(?(.*?)\)?\s*$", s)
            if ":" in s and m: P, D = da_latex(m.group(1)), da_latex(m.group(2))
        if P is None:
            es = [da_latex(s).split("=", 1)[-1] for s in segs if re.search(r"[a-z]", s)]
            P, D = es[0], es[1]
        x = lettera(P + D)
        qq, rr = div(espr(P), espr(D), x)
        ris = rr if re.search(r"\bresto\b", pi) and not re.search(r"quoziente e", pi) else qq
        if it["tipo"] == "scelta": A = espr(da_latex(" ".join(segmenti(it["opz"][it["ok"]]))))
        elif it.get("num"): return None if vicino(ris, risposta_num(it), it["num"].get("tol", 0)) else "resto %s" % ris
        else: A = espr(da_latex(it["sol"][0]))
        return None if expand(A - ris) == 0 else "divisione: %s invece di %s" % (A, ris)
    if fam == "valuta":
        segs = segmenti(q); val = {}; E = None; chiamata = None
        for s in segs:
            p = da_latex(s)
            m = re.fullmatch(r"\s*([a-z])\s*\(\s*(-?[\d.]+)\s*\)\s*", p)
            if m: chiamata = Rational(m.group(2)); continue
            r = relazioni(p)
            if r and all(op == "=" and re.fullmatch(r"[a-zA-Z]", a.strip()) and not re.search(r"[a-zA-Z]", b) for a, op, b in r):
                for a, op, b in r: val[LETTERE[a.strip()]] = nsimplify(espr(b))
            elif re.search(r"[a-z]", p): E = espr(p.split("=", 1)[-1])
        if chiamata is not None: val[list(E.free_symbols)[0]] = chiamata
        return None if vicino(E.subs(val), risposta_num(it), it["num"].get("tol", 0)) else "valore %s" % E.subs(val)
    return "saltato"

def main():
    dati = json.load(open(sys.argv[1], encoding="utf8"))
    ok = err = salt = 0; errori = []
    for it in dati:
        try: r = controlla(it)
        except Exception as e: r = "eccezione: %s" % e
        if r == "saltato": salt += 1
        elif r is None: ok += 1
        else: err += 1; errori.append("%s [%s] %s -> %s" % (it.get("argomento"), it.get("generato"), re.sub(r"<[^>]+>", "", it["q"])[:110], r))
    print("SymPy: %d esercizi generati verificati, %d errori, %d non algebrici (problemi e modelli) saltati" % (ok + err, err, salt))
    for e in errori[:30]: print(" - " + e)
    sys.exit(1 if err else 0)

main()
