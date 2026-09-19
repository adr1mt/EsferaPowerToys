# Com funciona Esfer@ (avaluació de CF)

Font: guia oficial d'avaluació del centre + correus de la cap d'estudis (maig 2026).
Tot el que hi ha aquí ve de documentació i captures, **no de l'observació directa del
DOM**. El que encara no se sap està marcat com a ❓.

---

## Les dues pantalles d'entrada de qualificacions

Menú: `Avaluacions → Avaluacions finals` (o `Avaluacions parcials`).

### 1. Qualificacions per grup i matèria

`Avaluacions finals → Qualificacions per grup i matèria`

Grup → mòdul o RA → **taula amb tot l'alumnat del grup i una sola columna de
qualificació**. Un únic botó `Desa` per a tota la taula.

- Si s'ha triat un **RA** o l'**EM**: columna `Qualificació` amb un `<select>` per alumne.
- Si s'ha triat un **mòdul**: columna `Qualificació provisional` (input numèric) +
  columna `Qualificació` (`<select>` amb `PQ-Pendent de qualificar` i `NP-No presentat`).
- Botó d'accions per fila → modal de `Comentaris` amb el seu propi `Desa`.
- Botons inferiors: `Cancel·la` i `Desa`.

**És la via bona per importar un grup.** Una RA = una pantalla = un `Desa`.
Un grup de 25 alumnes amb 4 RA són 4 pantalles, no 25 navegacions.

❓ Amb 25 alumnes, surten tots en una taula o hi ha paginació?
❓ Quin selector CSS té la taula i els `<select>`?
❓ Quina petició llança `Desa` i com se sap que ha anat bé?

### 2. Qualificacions per grup i alumne/a

`Avaluacions finals → Qualificacions per grup i alumne/a`

Grup → alumne → **taula amb tots els mòduls i RA d'aquell alumne**. Un únic `Desa`.

- És la pantalla on treballa PowerToys avui (`form[name="grupAlumne"]`, `tr.alturallistat`).
- Té botons **`← Anterior`** i **`Següent →`** a dalt a la dreta per canviar d'alumne.
- També hi ha `Comentaris generals` per a l'alumne.

---

## Valors del desplegable de RA

Exactament aquests, i en aquest ordre:

```
Assolit-10
Assolit-9
Assolit-8
Assolit-7
Assolit-6
Assolit-5
No assolit
En Procés
Pendent
```

`Exempt` només existeix per a l'Estada a l'Empresa (EM).

Els codis interns que fa servir PowerToys (`string:A10` … `string:A5`, `string:NA`,
`string:EP`, `string:PDT`, `string:PQ`) hi encaixen.

---

## Regles d'avaluació que afecten l'eina

Del correu de la cap d'estudis. Són regles del centre i de la normativa, no del programa.

- **Una qualificació de RA, un cop introduïda, no es pot canviar.**
  Per tant una sobreescriptura pot estar bloquejada pel mateix Esfer@: el `<select>`
  pot arribar desactivat. L'eina ho ha de detectar i aturar-se, mai forçar-ho.
- A l'avaluació final **cal introduir la qualificació de tots els RA**.
  No hi pot quedar cap RA `En Procés` ni `Pendent`, tret dels de l'EM.
- La nota del **mòdul** és numèrica 1-10 sense decimals, i és una fila a part de les RA.
  S'obté com a mitjana ponderada de les RA segons la programació del departament.
  **PowerToys no la calcula.**
- Si totes les RA estan superades però l'EM no s'ha fet: cal posar la **Qprov**
  (mitjana ponderada) i el mòdul queda **PQ**.
- Si algun RA no està assolit: el mòdul es qualifica 1-4 i **no** es posa Qprov.
- Es supera amb 5 o més.

### Comprovacions que això suggereix

Barates i útils, un cop l'eina ja llegeix el grup:

- avisar de RA que han quedat `En Procés` o `Pendent` fora de l'EM;
- avisar de mòduls sense nota.

---

## Què encara no s'ha observat

Cap d'aquestes coses es pot resoldre llegint codi. Calen DevTools contra Esfer@ real:

- selectors CSS reals de la pantalla per grup i matèria;
- paginació de la taula d'alumnat;
- petició que llança `Desa`, resposta i com detectar-ne l'error;
- si en canviar de pantalla es perden els canvis no desats;
- quant triga cada pas.
