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
| `index.html` | motore del sito (stili, indice, quiz, correttore, revisione). Formato claude.ai: **senza** i tag `<!doctype>`, `<html>`, `<head>`, `<body>` | sì |
| `contenuti-matematica.js` | contenuti di matematica | sì |
| `contenuti-fisica.js` | contenuti di fisica | sì |
| `quaderno-locale.html` | stesso motore già avvolto nella pagina completa, per l'apertura con doppio clic | no (solo locale) |
| `LEGGIMI.md` | note per l'utente | no (solo locale) |

I tre file pubblicati devono restare nella stessa cartella: la pagina carica i contenuti per
percorso relativo.

## Stato dei contenuti

**Matematica — 6 argomenti** (1º anno): calcolo letterale; scomposizione in fattori;
angoli, triangoli e criteri di congruenza; perpendicolarità, parallelismo e poligoni;
concetto di funzione e piano cartesiano; proporzionalità diretta e inversa.

**Fisica — 4 argomenti** (1º anno): moto, traiettoria e sistema di riferimento; attrito;
legge di Hooke e forza elastica; leve e macchine semplici.

Gli anni dal 2º al 5º compaiono nell'indice come «da aggiungere su richiesta».

> **Disallineamento noto (settembre 2026)** — il repo su GitHub ha ancora **3** argomenti di
> fisica: «Leve e macchine semplici» esiste solo nella copia locale. `index.html` e
> `contenuti-matematica.js` sono invece identici a quelli pubblicati. Il primo push deve
> includere `contenuti-fisica.js`.

## Struttura di un argomento

Lo schema completo (argomento + i tre tipi di esercizio) è documentato **in testa a
`contenuti-matematica.js`**: leggerlo prima di scrivere contenuti nuovi.

Ogni argomento contiene: 7–10 pillole di teoria, formulario in LaTeX (reso con MathJax),
3 esempi svolti passo per passo, 4–6 link a risorse gratuite (YouMath, Edutecnica) e
**3 batterie da 10 esercizi** a difficoltà crescente, ognuno con soluzione argomentata.

I tre tipi di esercizio sono: risposta aperta testuale, risposta aperta numerica con
tolleranza dichiarata, scelta multipla.

Per estendere:

- **nuovo argomento** → si accoda un oggetto all'array della materia;
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
- Il livello successivo si sblocca con almeno **6 risposte corrette su 10**. Rifacendo un
  livello gli esercizi restano gli stessi, così si lavora sugli errori.
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
   spiegazione, coerenza delle opzioni a scelta multipla.
2. **Test del correttore**: ogni variante di risposta dichiarata viene accettata, nessuna
   opzione errata viene accettata, la risposta vuota non passa.
3. **Verifica simbolica con SymPy** di tutte le identità algebriche e delle scomposizioni;
   verifica aritmetica di tutti i calcoli di geometria e di fisica (**g = 9,8 m/s²**).

## Git

Questa cartella **non è ancora un repository**: prima di lavorare, allinearla al remoto.

```bash
git init
git remote add origin https://github.com/ingbellini-yep/quaderno-a-quadretti.git
git fetch origin
git checkout -b main --track origin/main   # tiene i file locali, che sono più recenti
git status                                 # deve mostrare solo contenuti-fisica.js modificato
```

`quaderno-locale.html` e `LEGGIMI.md` non stanno nel repo: aggiungerli a `.gitignore`
oppure versionarli, ma con una scelta esplicita.

Dopo ogni modifica ai contenuti: commit e push su `main`, poi controllare il deploy su
Vercel.

## Lingua

Tutto in italiano: contenuti, commenti nel codice, messaggi di commit.
