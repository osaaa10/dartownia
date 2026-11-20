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

Opcjonalnie (na razie ich nie ma, aplikacja działa bez nich):

```
  zostaje.mp3, zostaje-2.mp3                 „zostaje” (przed liczbą pozostałych punktów)
  bust.mp3, bust-2.mp3, bust-3.mp3           bust
  gameshot.mp3, gameshot-2.mp3               wygrany leg
  match.mp3, match-2.mp3                     wygrany mecz
```

Bez tych zwrotów lektor czyta sam wynik rzutu, a bust i wygrany leg/mecz mówi głos telefonu.

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
