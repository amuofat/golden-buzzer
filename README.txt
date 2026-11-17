GOLDEN BUZZER - competition app (Blue Gold Club)

FILES
  index.html     control room: links + QR codes for the two phone buzzers
  host.html      your control panel (laptop)
  display.html   the show on the projector
  buzzer.html    the phone buzzer (?team=A = left table, ?team=B = right table)
  gb.js          shared code (Firebase connection, rules, sounds)
  questions-template.csv   question sheet template + a demo match (match 0)
  logo-white.png club logo
  music.mp3      (ADD IT YOURSELF) background music, loops on the display

1. PUT IT ONLINE (GitHub Pages)
  - New repository "golden-buzzer" > upload all these files > Settings > Pages >
    Branch: main / root > Save.
  - The app is then at https://amuofat.github.io/golden-buzzer/

2. FIRESTORE
  - Firebase console > Build > Firestore Database > Create database > test mode.
  - Test mode stays open for 30 days, enough for 22-29 Nov.

3. QUESTIONS (Google Sheets)
  - File > Import > upload questions-template.csv.
  - One row per question. Columns:
      match     match number (1, 2, 3...). Match 0 = demo, keep it for rehearsals
      round     1, 2, or SD (sudden-death questions, used only if tied)
      order     1-5 (question order inside the round)
      category, question_en, question_ar, answer_en, answer_ar
      option_a..option_d + correct (A/B/C/D)  -> used by the joker "4 options"
  - File > Share > Publish to web > choose the sheet > CSV > Publish.
    Paste that link in the host (1 - Questions > Load).

ON THE DAY
  Laptop: open index.html > Open host (tab 1) > Open display (tab 2), drag the
  display to the projector and click it once (sound + full screen).
  Phones: scan the two QR codes, one phone per table. Keep the screens on.
  Host: choose the match, type both team names, Start new match.
  Flow: Start round 1 > First question > Open buzzers (20 s) > the first buzz
  lights its table > Correct / Wrong (wrong = the other team steals, 10 s) >
  Next question. Joker button = wheel on the display (4 options or audience).
  Round 2 counts double. A tie after 10 questions = sudden death.

BACKUPS
  - Phone problem: on the host tab, key A = left buzzer, key L = right buzzer.
  - No internet: double-click index.html on the laptop, press "Switch to
    offline mode", then open host + display from there. Everything runs on
    that laptop; buzz with the A / L keys (phones need internet).
  - Practice without touching the real game: add ?g=practice everywhere.
