# Nagrany lektor

Jeśli w tym folderze jest plik `180.mp3`, aplikacja przełącza się z głosu telefonu na nagrania stąd.
Dzięki temu **wszyscy słyszą ten sam głos**, na każdym telefonie.

## Co nagrać

**Liczby** — każda w osobnym pliku, nazwa = liczba:

```
0.mp3  1.mp3  2.mp3 … 180.mp3
```

To 181 plików. Lektor czyta wynik kolejki („sto!”), a jeśli zostało 180 lub mniej, także ile zostało.

**Zwroty:**

| Plik           | Co powiedzieć (przykład)            | Kiedy                          |
|----------------|-------------------------------------|--------------------------------|
| `zostaje.mp3`  | „zostaje”                           | przed liczbą pozostałych pkt   |
| `bust.mp3`     | „Bust!” albo „Bez punktów!”         | bust                           |
| `gameshot.mp3` | „Game shot!”                        | wygrany leg                    |
| `match.mp3`    | „Game shot i mecz!”                 | wygrany mecz                   |

Jeśli którejś liczby zabraknie, tę jedną kwestię powie głos telefonu, więc najlepiej nagrać komplet.
Imion graczy nagrany lektor nie mówi.

## Jak nagrywać

1. Nagraj wszystko w jednym miejscu, z tej samej odległości od mikrofonu. Wystarczy dyktafon w telefonie.
2. Mów krótko i wyraźnie, z energią spikera: „Sto czterdzieści!”.
3. Przytnij ciszę na początku i końcu każdego pliku (np. w darmowym Audacity: *Efekty → Przytnij ciszę*,
   a potem *Plik → Eksportuj wiele*, żeby zapisać wszystkie naraz jako mp3).
4. Pliki mp3, mono, ok. 64–96 kbps, zwykle 10–30 KB każdy.

Możesz też wygenerować nagrania jednorazowo w usłudze zamiany tekstu na mowę. Sprawdź wtedy, czy jej
licencja pozwala publikować nagrania. Nie używaj głosów prawdziwych spikerów bez ich zgody.

## Jak wgrać

Na GitHubie wejdź do folderu `public`, kliknij **Add file → Upload files** i przeciągnij folder `voice`
z nagraniami (albo wejdź do `public/voice` i przeciągnij same pliki). Kliknij **Commit changes**,
poczekaj na zielony ✓ w zakładce **Actions** i odśwież aplikację.
W **Ustawienia → Lektor** pojawi się „Nagrany lektor”, a przyciskiem **Posłuchaj lektora** sprawdzisz efekt.
