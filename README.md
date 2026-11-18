# 🎯 Kanciapa Dart

Darmowa tablica wyników do darta, która działa w przeglądarce telefonu, tabletu albo laptopa.
Nie trzeba zakładać konta, nie ma reklam, a po pierwszym otwarciu działa też **bez internetu**.

Zrobiona do grania ze znajomymi: kładziesz telefon przy tarczy, wpisujecie imiona i gracie.

## Co potrafi

- **301 / 501 / 701** albo dowolna liczba punktów
- **Single Out, Double Out, Master Out** (Master: kończy double, treble albo bull)
- **Jeden leg, „do X wygranych” albo „best of X”**, z rotacją zaczynającego
- Do **16 graczy**
- Trzy sposoby wpisywania wyników:
  - **Tarcza**: stukasz pole, w które trafiła lotka. Domyślnie drugie stuknięcie potwierdza, żeby nie było pomyłek; w ustawieniach można to zmienić na jedno stuknięcie.
  - **Pola**: przyciski Single/Double/Treble i numery 1–20
  - **Suma**: wpisujesz wynik całej kolejki
- **Podpowiedzi zakończeń** (np. przy 121 pokazuje T20 · 11 · Bull), które aktualizują się po każdej lotce
- **Lektor po polsku** czyta wynik i mówi, kto rzuca następny
- **Cofanie** dowolnej liczby kolejek, także po wygranym legu i po końcu meczu
- **Historia meczów i statystyki**: średnia, pierwsze 9, checkout %, 100+/140+/180, najkrótszy leg, ranking graczy, forma i heatmapa trafień
- Ekran nie gaśnie w trakcie meczu
- Kopia zapasowa do pliku i wczytywanie jej na innym urządzeniu

## Prywatność

Wszystkie dane (gracze, mecze, statystyki) są zapisane **tylko w przeglądarce na Twoim urządzeniu**.
Aplikacja niczego nie wysyła do internetu: nie ma serwera, bazy danych ani śledzenia.
Każdy, kto otworzy stronę, ma własne, osobne dane.

Minus: jeśli wyczyścisz dane przeglądarki, wyniki znikną. Dlatego w **Ustawienia → Zapisz kopię** możesz
co jakiś czas zrobić kopię do pliku.

## Jak zainstalować na telefonie

1. Otwórz stronę aplikacji w przeglądarce.
2. **Android (Chrome):** menu ⋮ → *Zainstaluj aplikację* / *Dodaj do ekranu głównego*.
   **iPhone (Safari):** przycisk *Udostępnij* → *Do ekranu początkowego*.
3. Gotowe: ikona jest na ekranie, a aplikacja działa bez internetu.

## Własna kopia na GitHubie (dla każdego, za darmo)

Chcesz mieć swoją wersję, np. żeby coś zmienić?

1. Załóż konto na [github.com](https://github.com), jeśli go nie masz.
2. Na stronie tego repozytorium kliknij **Fork** → **Create fork**.
3. W swoim forku: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Wejdź w zakładkę **Actions**, wybierz *Publikacja na GitHub Pages* → **Run workflow**.
5. Po 1–2 minutach strona będzie pod adresem `https://<twój-login>.github.io/<nazwa-repo>/`.

Każda zmiana wypchnięta na gałąź `main` publikuje się sama.

## Dla programistów

Wymagany Node.js 22+.

```bash
npm install
npm run dev      # serwer deweloperski
npm test         # testy silnika gry
npm run build    # wersja produkcyjna w folderze dist/
```

Struktura:

- `src/engine/`: silnik gry, bez Reacta. Mecz jest zapisany jako **lista kolejek**, a cały stan (wyniki,
  legi, zwycięzca) jest z niej odtwarzany (`replay`). Dzięki temu cofanie i poprawki zawsze dają poprawny
  stan, a statystyki liczą się z tych samych danych.
  - `darts.ts`: wartości pól, zasady zakończeń, podpowiedzi checkoutów
  - `game.ts`: zasady kolejki (bust, double/master out), legi, mecz
  - `stats.ts`: statystyki meczu i kariery
  - `engine.test.ts`: testy
- `src/components/`: interfejs (React + Tailwind)
- `src/lib/store.ts`: zapis w `localStorage`
- `public/sw.js`: service worker (tryb offline)

Zasady liczenia statystyk:

- Średnia z 3 lotek: busty liczą się jako 3 lotki za 0 punktów (tak jak w oficjalnych statystykach).
- Próba checkoutu to każda kolejka rozpoczęta z wyniku, który da się zamknąć w tej kolejce, także zakończona bustem.

## Licencja

MIT: rób z tym, co chcesz.
