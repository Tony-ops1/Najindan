# NajinDan – aktiviranje prijave in oblaka

Ta repozitorij ima pripravljeno **prijavo z Googlom** in shranjevanje vsakega uporabnika v zasebni dokument Firestore. Prijava se aktivira šele po nastavitvi projekta.

## Nastavitev

1. Ustvari **Firebase** projekt na https://console.firebase.google.com/ in izberi paket **Spark (brezplačen)**.
2. V **Authentication > Sign-in method** omogoči ponudnika **Google**.
3. V **Firestore Database** ustvari podatkovno bazo in v zavihku **Rules** objavi celotno vsebino datoteke `firestore.rules`. Ne uporabljaj testnih javnih pravil.
4. V **Project settings > Your apps** registriraj spletno aplikacijo in iz prikazanega **firebaseConfig** prenesi polja `apiKey`, `authDomain`, `projectId` in `appId` v datoteko `firebase-config.js`.
5. V **Authentication > Settings > Authorized domains** odobri točno domeno, na kateri je NajinDan objavljen. Priporočljiv je **GitHub Pages** na `https://tony-ops1.github.io` ali lastna domena. Raw.githack je namenjen predogledu, ne objavi aplikacije z osebnimi podatki.
6. Posodobi spletno stran in preveri Google prijavo, shranjevanje ene spremembe ter obnovo na drugem telefonu. Preveri, da drugi Google račun nima dostopa do podatkov prvega.

## Pomembno

- Firebase konfiguracija za spletni odjemalec **ni** skrivni ključ. Nikoli ne objavi service account JSON ali API skrivnosti drugih storitev.
- Dokler konfiguracija ni vstavljena, NajinDan še naprej uporablja lokalni način. Takrat podatki **niso** v oblaku.
- Ko se aktivira prijava, vsak Google uporabnik začne s **svojim ločenim načrtom**. Za obstoječi načrt v starem lokalnem načinu izberi »Izvozi podatke« in ga po prijavi uvozi. Samodejnega prenosa iz skupne lokalne shrambe ni, da se podatki pomotoma ne prenesejo na napačen račun.
- **Fotografije:** na strani »Fotografije« se uporabnik posebej poveže z Google Drive; slike se nalagajo v uporabnikovo zasebno mapo. Dostopni žeton se hrani samo v pomnilniku brskalnika, ne v Firestore ali lokalni shrambi.
- Google Cloud projekt »My First Project« vsebuje Google OAuth klient »NajinDan Drive« z dovoljenjem `drive.file`. V načinu Testing se lahko povežejo samo dodani testni uporabniki. Za javno objavo je treba urediti publikacijo/po potrebi preverjanje Google OAuth aplikacije.
- Sinhronizacija je primerna za urejanje enega računa na različnih telefonih **zaporedno**; sočasno urejanje istega načrta na več napravah še potrebuje reševanje konfliktov.
- Zaradi omejitve velikosti Firestore dokumenta ne shranjuj slik neposredno v načrt. Uporabi ločeno shrambo, ko dodamo fotografije.
