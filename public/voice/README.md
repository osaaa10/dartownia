# Nagrany lektor

Nagrania w tym folderze zastępują głos telefonu, więc **wszyscy słyszą ten sam głos**, na każdym telefonie i bez internetu.

## Układ plików

```
voice/
  calm/0.mp3 … calm/180.mp3                  spokojny
  confident/0.mp3 … confident/180.mp3        pewny
  energetic/0.mp3 … energetic/180.mp3        energiczny
  enthusiastic/0.mp3 … enthusiastic/180.mp3  entuzjastyczny
  ecstatic/100.mp3 … ecstatic/180.mp3        ekstatyczny (krzyk) — na razie tylko 100–180
```

Zwroty:

```
  zostaje.mp3                    „zostaje” (po rzucie, przed liczbą pozostałych punktów)
  bust.mp3                       „bast”
  gameshot.mp3                   wygrany leg
  match.mp3                      wygrany mecz („Game shot i mecz!”)
  teraz.mp3, do-konca.mp3        „Teraz [nick]… do końca [liczba]” dla następnego gracza
  zakonczenie.mp3                przed podpowiedzią zakończenia
  potrojne.mp3, podwojne.mp3     T20 = „potrójne 20”, D5 = „podwójne 5”
  tripel.mp3, double.mp3         albo „tripel 20”, „double 5”
  te.mp3, de.mp3                 albo „te 20”, „de 5”
  bull.mp3, bullseye.mp3         bull (50)
  names/<nick>.mp3               nicki graczy
  darts/tede/T1.mp3 … D20.mp3    całe lotki jednym tonem („te dziewiętnaście”, „de szesnaście”)
  darts/single/1.mp3 … 25.mp3    pojedyncze pola w zakończeniu
```

Każdy zwrot może mieć warianty (`bust-2.mp3` … `bust-5.mp3`) — aplikacja je losuje.

### Nicki

Plik nazywa się jak nick w aplikacji, małymi literami, bez polskich znaków i spacji:
„Oleś” → `names/oles.mp3`, „KMP” → `names/kmp.mp3`. Wymowa może być inna niż zapis
(„Parzy” jest nagrane jako „Paży”). Gracz bez nagranego nicku — lektor pomija imię.

- Każdy w aplikacji wybiera w **Ustawienia → Lektor → Styl lektora**, jakim głosem mają być czytane wyniki
  0–49, 50–99, 100–149, 150–179 i 180. Domyślnie: spokojny, pewny, energiczny, entuzjastyczny, ekstatyczny.
- „Zostaje …” jest zawsze czytane stylem wybranym dla 0–49 (zwykle spokojnym).
- Zwroty z numerem (`bust-2.mp3`) to warianty — aplikacja losuje jeden.
- Brakujący styl dla danego przedziału zostanie pominięty w wyborze; brakująca liczba — powie ją głos telefonu.
- Stary układ bez stylów (`voice/0.mp3 … voice/180.mp3`) też działa.

## Skąd są nagrania

Wygenerowane w ElevenLabs (model Eleven v4, głos „Pavan M – Energetic Sports Commentator”) na płatnym planie,
pocięte na pojedyncze liczby i wyrównane głośnościowo.

## Własny lektor

Nagraj liczby 0–180 jednym ciągiem z ok. 1 s przerwy między nimi (lista: `lista-do-nagrania.txt`
w rozmowie / w repozytorium), a potem potnij na pliki o nazwach jak wyżej — np. do nowego folderu stylu.
