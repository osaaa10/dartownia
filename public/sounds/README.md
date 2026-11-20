# Własne dźwięki

Wrzuć tu pliki **mp3** o dokładnie takich nazwach. Każdy, kto otworzy aplikację, usłyszy te same dźwięki.
Nie musisz mieć wszystkich: jeśli jakiegoś pliku brakuje, gra domyślny sygnał.

| Plik         | Kiedy gra                                     |
|--------------|-----------------------------------------------|
| `dart.mp3`   | po każdej wpisanej lotce (krótki, ~0,1 s!)    |
| `turn.mp3`   | po zwykłej kolejce (poniżej 100)              |
| `ton.mp3`    | 100–139                                       |
| `ton40.mp3`  | 140–179                                       |
| `180.mp3`    | 180                                           |
| `bust.mp3`   | bust                                          |
| `leg.mp3`    | wygrany leg                                   |
| `match.mp3`  | wygrany mecz                                  |

## Warianty: kilka wersji tego samego dźwięku

Do każdego dźwięku możesz dodać do 4 dodatkowych wersji, numerując je od 2:

```
180.mp3   180-2.mp3   180-3.mp3   180-4.mp3   180-5.mp3
```

Za każdym razem aplikacja wylosuje jedną z nich (i nie zagra tej samej dwa razy z rzędu).
Numeracja musi być ciągła: jeśli jest `180-3.mp3`, a brakuje `180-2.mp3`, trójka zostanie pominięta.

## Niespodzianki

Pliki `surprise.mp3`, `surprise-2.mp3` … `surprise-10.mp3` to dźwięki-niespodzianki
(np. śmiech, trąbka, „ooo!”). Gdy w aplikacji włączysz **Ustawienia → Dźwięki → Niespodzianka**
(np. „1 z 5”), co piątą zwykłą kolejkę zamiast lektora (albo zaraz po nim) zagra jedna z nich, losowo.
Bez tych plików grają wbudowane: boing, smutna trąbka i laser.
180, busty i wygrane legi zawsze idą normalnie.

Wskazówki:

- Krótko: dźwięk gra razem z lektorem. Najlepiej 0,1–2 s (mecz może być dłuższy).
- Mały rozmiar: do ~200 KB na plik. Wtedy aplikacja szybko się ładuje i działa offline.
- Używaj tylko dźwięków własnych albo z licencją pozwalającą na publikację (np. CC0 z freesound.org).
  Nie wrzucaj nagrań z transmisji telewizyjnych.
- Po wgraniu plików odczekaj, aż w zakładce **Actions** pojawi się zielony ✓, i odśwież aplikację.
  W **Ustawienia → Dźwięki** podświetlą się te, które aplikacja znalazła; możesz je tam odsłuchać.

## Obecne dźwięki

Wygenerowane w ElevenLabs (efekty dźwiękowe, płatny plan):

- `leg.mp3` – oklaski po wygranym legu
- `match.mp3` – hala, oklaski i fanfara po wygranym meczu
- `180.mp3` – ogromny aplauz przy 180 (przycięty do 5,5 s)
- `stuck.mp3` – smutna trąbka, gdy ktoś znowu nie trafi double na zakończenie

Pozostałe zdarzenia grają krótkie wbudowane sygnały.
