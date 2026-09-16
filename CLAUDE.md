# Quaderno a Quadretti — istruzioni di progetto

Piattaforma di ripasso di **matematica** e **fisica** per il liceo scientifico: teoria in
pillole, formulario, esempi svolti, link a risorse gratuite e palestra di autovalutazione.

## Dove vive

| Cosa | Dove |
|---|---|
| Sorgenti locali | questa cartella (`PIATTAFORMA_STUDIO - Codex`, dentro OneDrive) |
| Repository | `https://github.com/ingbellini-yep/quaderno-a-quadretti` (branch `main`) |
| Pubblicazione | progetto Vercel `quaderno-a-quadretti`, collegato al repo: **ogni push su `main` fa il redeploy automatico** |

## File

| File | Ruolo | Nel repo |
|---|---|---|
| `index.html` | motore del sito (stili, indice, quiz, correttore, revisione, svolgimento guidato, importazione di esercizi, scheda e trasferimento dei progressi). Formato claude.ai: **senza** i tag `<!doctype>`, `<html>`, `<head>`, `<body>` | sì |
| `contenuti-matematica.js` | contenuti di matematica | sì |
| `contenuti-fisica.js` | contenuti di fisica | sì |
| `quaderno-locale.html` | stesso motore già avvolto nella pagina completa, per l'apertura con doppio clic; **va rigenerato** da `index.html` dopo ogni modifica al motore (testa fino a `<title>` + `index.html` + `</body></html>`) | no (solo locale) |
| `LEGGIMI.md` | note per l'utente | no (solo locale) |
| `CLAUDE.md` | queste istruzioni di progetto | sì |
| `.gitignore` | esclude i due file solo locali | sì |

I tre file pubblicati devono restare nella stessa cartella: la pagina carica i contenuti per
percorso relativo.

## Stato dei contenuti

**Matematica — 6 argomenti** (1º anno): calcolo letterale; scomposizione in fattori;
angoli, triangoli e criteri di congruenza; perpendicolarità, parallelismo e poligoni;
concetto di funzione e piano cartesiano; proporzionalità diretta e inversa.

**Fisica — 5 argomenti** (1º anno): moto, traiettoria e sistema di riferimento; attrito;
legge di Hooke e forza elastica; leve e macchine semplici; notazione scientifica e ordini
di grandezza (convenzione: mantissa < 5 → 10^n, altrimenti 10^(n+1)).

Gli anni dal 2º al 5º compaiono nell'indice come «da aggiungere su richiesta».

## Struttura di un argomento

Lo schema completo (argomento + i tre tipi di esercizio) è documentato **in testa a
`contenuti-matematica.js`**: leggerlo prima di scrivere contenuti nuovi.

Ogni argomento contiene: 7–10 pillole di teoria, formulario in LaTeX (reso con MathJax),
3 esempi svolti passo per passo, 4–6 link a risorse gratuite (YouMath, Edutecnica) e
**3 batterie da 10 esercizi** a difficoltà crescente, ognuno con soluzione argomentata e
con una **guida allo svolgimento** (campo `guida`: passi `{s, r, k}`, vedi sotto).

I tre tipi di esercizio sono: risposta aperta testuale, risposta aperta numerica con
tolleranza dichiarata, scelta multipla.

Nelle stringhe JavaScript i comandi LaTeX vanno scritti con backslash **doppio**
(`\\cdot`, `\\frac`, `\\,`): con il backslash singolo JavaScript lo scarta e MathJax
riceve `cdot` come testo.

Per estendere:

- **nuovo argomento** → si accoda un oggetto all'array della materia. Gli **id degli
  argomenti esistenti non vanno mai cambiati** e gli argomenti non vanno rimossi: i progressi
  in `localStorage` sono indicizzati per id e per indice di livello, quindi un modulo
  aggiunto in coda non li tocca, un id rinominato li rende irraggiungibili. `verifica.js`
  confronta gli id con quelli dell'ultimo commit e segnala quelli spariti;
- **nuovo anno** → si aggiunge una chiave dentro `anni`, nell'array `MATERIE` in `index.html`;
- **nuova materia** → un nuovo file di contenuti più una voce in `MATERIE`.

## Regole didattiche da rispettare

- Gli esercizi si affrontano **uno alla volta**, senza correzione immediata.
- Al termine della batteria: punteggio e revisione di ogni esercizio con risposta data,
  risposta corretta e spiegazione ragionata.
- Per ogni esercizio lo studente dichiara «Sì, ho capito» oppure «No, spiegamelo meglio»;
  il secondo genera una spiegazione più estesa (che cosa chiede l'esercizio, la regola,
  lo svolgimento passo per passo, dove nasce l'errore, un esercizio simile da provare).
  Fuori da claude.ai compare un messaggio di ripiego che rimanda a teoria, esempi e link.
- Il livello successivo si sblocca con almeno **6 risposte corrette su 10** (per batterie di
  altra lunghezza, il 60 % arrotondato per eccesso). Rifacendo un livello gli esercizi
  restano gli stessi, così si lavora sugli errori.
- **Svolgimento guidato**: per ogni esercizio lo studente può farsi guidare un passaggio
  alla volta. Il sistema mostra il suggerimento (`s`, che cosa scrivere senza rivelare il
  risultato), lo studente scrive il passaggio, poi compare il passaggio atteso (`r`) con un
  controllo morbido (le chiavi `k` o l'ultimo numero di `r` devono comparire nel testo
  scritto) e il suggerimento successivo, fino alla risposta finale. È raggiungibile dalla
  pagina dell'argomento (griglia degli esercizi), dentro il quiz (il pulsante «Svolgimento
  guidato» esclude l'esercizio dal punteggio, che resta segnato «con la guida» nella
  revisione) e dalla revisione («Rifallo passo per passo»). Se un esercizio non ha `guida`,
  la pagina la ricava dalle frasi della spiegazione; su claude.ai è possibile chiederne una
  più dettagliata al modello (`sample`).
- **Importazione di esercizi**: dalla pagina iniziale («Esercizi tuoi») si carica o incolla
  un JSON con un argomento completo (stesso schema dei file dei contenuti, con `materia` e
  `anno`), oppure `{titolo, materia, anno, items:[...]}`, oppure un semplice elenco di
  esercizi. Le batterie importate vengono validate, salvate in `localStorage` (chiave
  `quaderno-quadretti-importati`), montate nell'indice come argomenti con etichetta «tuo» e
  hanno palestra, revisione e svolgimento guidato come gli altri. Un modello di file è
  mostrato nella pagina (`MODELLO_IMPORT` in `index.html`).
- **Scheda e trasferimento dei progressi** (sezione «I tuoi progressi» nella pagina
  iniziale): scheda facoltativa con nome, nickname ed email, salvata in `localStorage`
  (chiave `quaderno-quadretti-profilo`); nickname ed email sono richiesti solo per esportare.
  L'esportazione produce un file JSON (`formato: "quaderno-quadretti-progressi"`, `versione:
  1`, con profilo, progressi e batterie importate) oppure un codice testuale `QQ1Z:` (base64
  del JSON compresso con deflate; `QQ1:` senza compressione se il browser non lo supporta),
  copiabile o inserito in un'email precompilata via `mailto:` all'indirizzo della scheda (il
  browser non può spedire da solo: l'utente preme Invia nel suo programma di posta). Nel file
  va solo un'**impronta** dell'email (cyrb53 dell'indirizzo normalizzato), mai l'indirizzo.
  All'importazione: browser senza scheda → adotta la scheda del file (senza email) e carica
  tutto; stessa impronta → fusione (miglior risultato per livello, tentativi sommati, ultimo
  esito dal salvataggio più recente, batterie mancanti aggiunte); impronta diversa → conferma
  esplicita per sostituire scheda e progressi, altrimenti nulla cambia. Non esiste invio
  automatico né sincronizzazione: servirebbe un backend.
- I progressi si salvano in `localStorage`, così la pagina resta condivisibile con un link
  e senza account. La capability `db` di claude.ai **non** va ridichiarata: rende
  l'Artifact interno all'organizzazione e non condivisibile. `claude.use("db")` che
  restituisce `null` è previsto e innocuo.

## Correttore delle risposte aperte

Normalizza prima del confronto: maiuscole/minuscole, spazi, segno di moltiplicazione
omesso, `x^2` ≡ `x2` ≡ `x²`, virgola decimale ≡ punto, unità di misura facoltativa.
Per i risultati numerici il confronto è sul valore, con tolleranza dichiarata esercizio
per esercizio.

## Verifiche obbligatorie prima di ogni push

1. **Controllo strutturale** di tutti gli esercizi nuovi: testo, soluzione dichiarata,
   spiegazione, coerenza delle opzioni a scelta multipla, guida con 2–6 passi il cui ultimo
   passo contiene la risposta finale.
2. **Test del correttore**: ogni variante di risposta dichiarata viene accettata, nessuna
   opzione errata viene accettata, la risposta vuota non passa.
3. **Verifica simbolica con SymPy** di tutte le identità algebriche e delle scomposizioni;
   verifica aritmetica di tutti i calcoli di geometria e di fisica (**g = 9,8 m/s²**).
4. **Controllo dei link** con `curl` (stato 200). YouMath ha cambiato gli indirizzi delle
   lezioni e a volte rifiuta le connessioni automatiche: in quel caso confermare la pagina
   almeno tramite l'indice di un motore di ricerca.

Le verifiche 1 e 2 (più il controllo dei backslash LaTeX e delle guide) sono automatizzate
in `verifica.js`: `node verifica.js .` dalla cartella del progetto.

Strumenti sulla macchina (settembre 2026): Node.js LTS 24 in `C:\Program Files\nodejs`
(installato con winget; le shell aperte prima dell'installazione non lo vedono nel PATH),
Python 3.14 (SymPy va installato con `pip install sympy`). Il correttore vive dentro una
funzione anonima in `index.html`: per testarlo fuori dal browser si estraggono `normalizza`,
`numeroDa` e `corretta` dal sorgente con un'espressione regolare e si valutano in Node
insieme ai file dei contenuti, con `window = {}`.

## Git

La cartella è un repository locale con `main` agganciato a `origin/main`; `.gitignore`
esclude `quaderno-locale.html` e `LEGGIMI.md`. Dopo ogni modifica ai contenuti: verifiche,
commit e push su `main`, poi controllo del deploy su Vercel (progetto
`quaderno-a-quadretti`, team `ingbellini-6799s-projects`).

Se la cartella dovesse essere riallineata da zero (per esempio dopo una copia da OneDrive
senza `.git`), `git checkout` si rifiuta di sovrascrivere i file locali non tracciati:

```bash
git init
git remote add origin https://github.com/ingbellini-yep/quaderno-a-quadretti.git
git fetch origin
git branch --track main origin/main
git symbolic-ref HEAD refs/heads/main
git reset            # allinea solo l'indice: i file locali restano intatti
git status           # mostra le differenze fra la copia locale e il remoto
```

## Lingua

Tutto in italiano: contenuti, commenti nel codice, messaggi di commit.
