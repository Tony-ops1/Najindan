# NajinDan ♡

Spletna aplikacija za načrtovanje poroke v slovenščini. Deluje v brskalniku tudi na telefonu.

## Funkcije

- Pregled poroke, datum in opravljene naloge
- Prilagodljivi zaznamki in kategorije (dodaj, preimenuj, razvrsti; pri ustvarjanju in urejanju kategorij je na voljo vizualna izbira 138 ikon, razdeljenih v 9 poročnih skupin)
- Dve privzeti kategoriji oblek za poročni priči: **👨 Obleka za pričo – fant** in **👩 Obleka za pričo – punca**. Pri že ustvarjenih načrtih se dodata brez spreminjanja obstoječih zapisov.
- Seznam gostov in potrditve udeležbe
- **Sedežni red:** dodaj mize, določi število sedežev, razporedi goste, premikaj med mizami
- Proračun, stroški in plačila
- Ponudniki in ponudbe
- Časovnica poročnega dne
- Izvoz in uvoz podatkov v JSON
- **Fotografije:** zasebna galerija na uporabnikovem Google Drive (po ločenem dovoljenju)

## Google Drive fotografije

### Ena prijava za Firebase in Google Drive (pripravljeno; še ni aktivirano)

Aplikacija vsebuje opcijsko **združeno prijavo**, pri kateri uporabnik pritisne **Prijava z Googlom in Drive** in v istem Google OAuth postopku odobri obseg `drive.file`. Isti OAuth žeton se nato uporabi za prijavo v Firebase (`signInWithCredential`) in povezavo uporabnikove galerije. Ker gre za isti Google OAuth klient **NajinDan Drive**, ostanejo slike povezane z istim Google Drive odjemalcem. Dovoljenje za Drive mora uporabnik prvič izrecno potrditi. Žeton za Drive ni trajen in je samo v pomnilniku, zato po osvežitvi/brskalnikovi obnovi prijave v Firebase ni vedno samodejno na voljo — novo Google dovoljenje je treba obnoviti z uporabniškim klikom.

**Pred vklopom morata biti izpolnjena oba pogoja:**

1. V Google Cloud projektu **My First Project** odpri **Google Auth Platform → Audience** in prestavi OAuth aplikacijo iz *Testing* v **In production**. V načinu Testing bi bili novi uporabniki ob združeni prijavi blokirani že pri sami prijavi v aplikacijo.
2. V Firebase projektu **najindan-cf5d1** odpri **Authentication → Sign-in method → Google → Safelist client IDs from external projects** in na seznam dovoli javni Google OAuth Client ID `273381863324-ft40mrnu1kkuin77krvfmbtslu6366pt.apps.googleusercontent.com`. Ta korak je potreben, ker je OAuth klient za Drive v drugem projektu kot Firebase. Nikjer ne vnašaj Client Secret v spletno kodo.

Po obeh korakih lahko v `firebase-config.js` spremeniš `unifiedGoogleDriveLogin: false` na `true`. Dokler sta pogoja nepreverjena, je funkcija **namenoma izklopljena**, saj bi lahko sicer uporabniki izgubili dostop do prijave. Ko je aktivirana, prijavna stran ponuja tudi **Prijava brez fotografij** kot varno rezervno možnost. Če uporabnik ne odobri obsega Drive, običajna prijava v Firebase še vedno deluje prek rezervne možnosti. Pred uporabo v produkciji izvedi dejanski preizkus na telefonu.


Galerija **Fotografije** se prikaže po prijavi z Googlom. V razdelku **Kategorije** odpri izbrano kategorijo in klikni **svinčnik (Uredi kategorijo)**. V oknu za urejanje so poleg imena in opisa tudi fotografije kategorije (tudi pri naknadno ustvarjenih kategorijah). Pod stroški se galerija ne prikazuje več. Gumba **Izberi iz galerije** in **Fotografiraj** omogočata izbor slik iz naprave oziroma uporabo kamere na telefonu. Na računalniku lahko gumb Fotografiraj odpre običajno izbiro datoteke. Slike so na Google Drive označene z zasebno lastnostjo `appProperties.najindanCategoryId`, zato ostanejo vezane na kategorijo tudi ob spremembi imena, v skupni galeriji Fotografije pa so vidne vse slike. Če izbrišeš kategorijo, slike ostanejo na Drive in v skupni galeriji, ne izbrišejo se samodejno.

Galerija **Fotografije** se prikaže po prijavi z Googlom. Ob prvem kliku **Poveži moj Google Drive** aplikacija zahteva Google dovoljenje `drive.file` in preveri, da je Drive račun isti kot pri prijavi v Firebase. Nato ustvari zasebno mapo **NajinDan – Moja poroka**, v kateri hrani fotografije. Slike se pred nalaganjem lokalno pretvorijo v JPEG in zmanjšajo na največ 1800 px; izvirniki v uporabnikovi napravi ostanejo nespremenjeni. Brisanje v galeriji premakne fotografijo v koš Google Drive.

Google Drive OAuth nastavitve so v ločenem Google Cloud projektu **My First Project**, OAuth odjemalec **NajinDan Drive**. Pred javno uporabo prestavi Google OAuth zaslon iz *Testing* v *Production* in preveri pogoje objave. Med testiranjem lahko Drive povežejo samo dodani testni uporabniki. Access token se ne shranjuje v `localStorage`; po poteku ali osvežitvi strani mora uporabnik znova povezati Google Drive. Za delovanje mora biti na Google Cloud projektu omogočen **Google Drive API** ter obseg `https://www.googleapis.com/auth/drive.file`.

Google Drive je ločen od Firestore: seznam slik se bere neposredno z uporabnikovega Drive. Uporabnikov brezplačni prostor (običajno do 15 GB skupaj za Drive, Gmail in Google Foto) in brezplačna API kvota nista neomejena.

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
