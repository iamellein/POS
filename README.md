# Evidence-Based Policy Rule Engine

A small Node.js lab project with browser-based learning artifacts for policy validation, consumer meal and movement journaling, and structured nutrition care charting.

## Run

Requires Node.js 18 or newer. No third-party packages are needed.

```powershell
node server.js
```

Open http://127.0.0.1:3000 for Lab 1, http://127.0.0.1:3000/lab2.html for Lab 2, or http://127.0.0.1:3000/lab3.html for Lab 3. Run the unit tests with:

```powershell
node --test engine.test.js
```

## Publish on GitHub Pages

The rule engine runs in the browser, so the public site does not need a Node server. A GitHub Actions workflow deploys the static app whenever changes are pushed to `main`.

1. In the repository on GitHub, open **Settings** > **Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
3. Push to `main` or manually run the **Deploy to GitHub Pages** workflow in the **Actions** tab.
4. After the workflow succeeds, open the published URL shown in the `github-pages` deployment environment. For this repository it will normally be `https://iamellein.github.io/POS/`.

The browser version and Node API use the same `engine.js` validation rules. Nutrient values remain user-entered.

## Lab 2: Consumer meal and movement journal

Open `/lab2.html` to add meal entries, attach a local photo preview, and sync sample daily activity from the mock wearable API. Entries and selected photos remain in the current browser session; they are not uploaded or persisted. The API supports `googleFit` and `appleHealth` provider samples and accepts an optional `date` in `YYYY-MM-DD` format.

```http
GET /api/wearable/daily?provider=googleFit&date=2026-10-24
```

The response includes the provider, date, step count, active energy in kcal, sync timestamp, and `source: "mock"`. No real health account or wearable service is contacted. On GitHub Pages, where Node API routes are unavailable, the page fetches provider-specific static JSON fixtures instead.

## Lab 3: Standardized nutrition care charting

Open `/lab3.html` to create a structured note with Assessment, Nutrition Diagnosis (PES), Intervention, and Monitoring & Evaluation sections. The form generates a readable note and JSON payload, with copy and download actions. The standalone schema is available at `/clinical-note.schema.json`.

The static GitHub Pages version generates the note in-browser and supports JSON download. Run `node server.js` locally to use the validating API from the form or Postman.

```http
POST /api/clinical-notes
Content-Type: application/json
```

The local API checks required note sections, dates, term code/label pairs, and allowed assessment/intervention categories. Built-in codes and labels are teaching placeholders, not official eNCPT terminology. Enter the release and terminology values from an organization's licensed catalog before using a real workflow. Do not enter identifiable patient information; this demo does not save notes to a health record.

## Included demonstration rules

- Low sodium: daily sodium at or below 2,300 mg.
- Glucose-aware pattern: carbohydrates at or below 60 g per meal, added sugar at or below 10 g per meal, and fiber at or above 5 g per meal.
- Combined review: applies all four checks.

Thresholds are editable in the app and can be customized by an institution. The defaults are teaching examples, not a clinical diet prescription or a claim that one set of limits fits every patient. Confirm applicable policy with qualified clinical staff before real-world use. Nutrient values are user-entered and are not independently verified.

## API

`POST /api/validate` accepts a JSON object with a `policy`, `thresholds`, and non-empty `entries` array. Each entry includes `meal`, `name`, `servings`, `sodiumMg`, `carbohydratesG`, `addedSugarG`, and `fiberG`. In the interface, add one row per meal, enter the food name(s) in that meal, and enter combined nutrient totals for the whole meal; plan totals update as values change. The response contains daily totals, meal totals, per-rule pass/fail evidence, and an overall compliance result.