# NajinDan ♡

Spletna aplikacija za načrtovanje poroke v slovenščini. Deluje v brskalniku tudi na telefonu.

## Funkcije

- Pregled poroke, datum in opravljene naloge
- Prilagodljivi zaznamki in kategorije (dodaj, preimenuj, razvrsti)
- Seznam gostov in potrditve udeležbe
- **Sedežni red:** dodaj mize, določi število sedežev, razporedi goste, premikaj med mizami
- Proračun, stroški in plačila
- Ponudniki in ponudbe
- Časovnica poročnega dne
- Izvoz in uvoz podatkov v JSON

## Zagon

Odprite `index.html` v brskalniku. Ni potrebna namestitev dodatnih knjižnic ali strežnika.

Za objavo prek GitHub Pages: v repozitoriju izberite **Settings → Pages → Deploy from a branch → main → /(root) → Save**. Običajen naslov po objavi je `https://tony-ops1.github.io/Najindan/`.

## Zasebnost in prenos zapiskov

Repozitorij je **javen**. V kodo niso vključeni osebni podatki iz poročnega zvezka (imena gostov, osebni kontakti ali podrobnosti poroke).

Podatki, vneseni v aplikacijo, se shranjujejo **lokalno v brskalniku** (`localStorage`). Med napravami se ne sinhronizirajo. Shranjeni podatki v lokalni različici aplikacije se na novo spletno domeno ne prenesejo samodejno.

Za prenos iz prejšnje različice:
1. Odprite prejšnjo aplikacijo v istem brskalniku in izberite **Nastavitve → Izvozi varnostno kopijo**.
2. Odprite spletno različico NajinDan.
3. Izberite **Nastavitve → Uvozi varnostno kopijo** in odprite preneseni JSON.

**Pomembno:** Datotek z zasebnimi podatki gostov ali varnostnih kopij ne nalagajte v javni repozitorij.

## Tehnologija

Vanilla HTML, CSS in JavaScript brez zunanjih odvisnosti.
