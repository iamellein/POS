# Evidence-Based Policy Rule Engine

A small Node.js lab artifact for checking meal plans against configurable, illustrative institutional policy rules. The interface runs in a browser and submits validation requests to a local backend.

## Run

Requires Node.js 18 or newer. No third-party packages are needed.

```powershell
node server.js
```

Open http://127.0.0.1:3000. Run the unit tests with:

```powershell
node --test engine.test.js
```

## Publish as a website

This project includes a Render Blueprint in `render.yaml` because GitHub Pages cannot run the Node.js validation API.

1. Push the project to the `main` branch of the connected GitHub repository.
2. In Render, choose **New** > **Blueprint** and connect `iamellein/POS`.
3. Deploy the service defined by `render.yaml`. Render will provide a public `onrender.com` URL.

The free service may take a short time to wake after inactivity. The browser app and `/api/validate` endpoint are served by the same Node process.

## Included demonstration rules

- Low sodium: daily sodium at or below 2,300 mg.
- Glucose-aware pattern: carbohydrates at or below 60 g per meal, added sugar at or below 10 g per meal, and fiber at or above 5 g per meal.
- Combined review: applies all four checks.

Thresholds are editable in the app and can be customized by an institution. The defaults are teaching examples, not a clinical diet prescription or a claim that one set of limits fits every patient. Confirm applicable policy with qualified clinical staff before real-world use. Nutrient values are user-entered and are not independently verified.

## API

`POST /api/validate` accepts a JSON object with a `policy`, `thresholds`, and non-empty `entries` array. Each entry includes `meal`, `name`, `servings`, `sodiumMg`, `carbohydratesG`, `addedSugarG`, and `fiberG`. In the interface, add one row per meal, enter the food name(s) in that meal, and enter combined nutrient totals for the whole meal; plan totals update as values change. The response contains daily totals, meal totals, per-rule pass/fail evidence, and an overall compliance result.