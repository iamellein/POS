const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMealPlan } = require('./engine');

const entry = (overrides = {}) => ({
  meal: 'Breakfast',
  name: 'Oatmeal with berries',
  servings: 1,
  sodiumMg: 120,
  carbohydratesG: 38,
  addedSugarG: 4,
  fiberG: 7,
  ...overrides,
});

test('passes a plan that meets the selected combined rules', () => {
  const result = validateMealPlan({
    policy: 'combined',
    entries: [entry(), entry({ meal: 'Lunch', name: 'Salmon plate', sodiumMg: 500, carbohydratesG: 48, addedSugarG: 2, fiberG: 8 })],
  });

  assert.equal(result.compliant, true);
  assert.equal(result.totals.sodiumMg, 620);
  assert.ok(result.results.every(rule => rule.passed));
});

test('reports daily sodium and per-meal carbohydrate violations', () => {
  const result = validateMealPlan({
    policy: 'combined',
    thresholds: { sodiumMg: 500, carbohydratesG: 40, addedSugarG: 10, fiberG: 5 },
    entries: [entry({ sodiumMg: 300, carbohydratesG: 35 }), entry({ meal: 'Breakfast', name: 'Toast', sodiumMg: 250, carbohydratesG: 12 })],
  });

  assert.equal(result.compliant, false);
  assert.equal(result.results.find(rule => rule.id === 'sodium').passed, false);
  assert.equal(result.results.find(rule => rule.id === 'carbohydrates-breakfast').actual, 47);
  assert.equal(result.results.find(rule => rule.id === 'carbohydrates-breakfast').passed, false);
});

test('multiplies nutrient values by servings before aggregation', () => {
  const result = validateMealPlan({
    policy: 'lowSodium',
    entries: [entry({ servings: 2, sodiumMg: 300 })],
  });

  assert.equal(result.totals.sodiumMg, 600);
});

test('rejects empty plans and invalid nutrient values', () => {
  assert.throws(() => validateMealPlan({ policy: 'lowSodium', entries: [] }), /at least one food entry/);
  assert.throws(() => validateMealPlan({ policy: 'lowSodium', entries: [entry({ sodiumMg: -1 })] }), /non-negative number/);
});