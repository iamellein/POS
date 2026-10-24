const POLICIES = {
  lowSodium: {
    label: 'Low sodium',
    rules: ['sodium'],
  },
  glucoseAware: {
    label: 'Glucose-aware pattern',
    rules: ['carbohydrates', 'addedSugar', 'fiber'],
  },
  combined: {
    label: 'Combined review',
    rules: ['sodium', 'carbohydrates', 'addedSugar', 'fiber'],
  },
};

const DEFAULT_THRESHOLDS = {
  sodiumMg: 2300,
  carbohydratesG: 60,
  addedSugarG: 10,
  fiberG: 5,
};

const NUTRIENT_FIELDS = ['sodiumMg', 'carbohydratesG', 'addedSugarG', 'fiberG'];
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

function validatePlan(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Request body must be a JSON object.');
  }

  const policy = POLICIES[input.policy];
  if (!policy) {
    throw new TypeError('Choose lowSodium, glucoseAware, or combined as the policy.');
  }

  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new TypeError('Add at least one food entry before validating.');
  }

  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  for (const [key, value] of Object.entries(thresholds)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`Threshold ${key} must be a non-negative number.`);
    }
  }

  const entries = input.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`Entry ${index + 1} must be an object.`);
    }
    if (!MEALS.includes(entry.meal)) {
      throw new TypeError(`Entry ${index + 1} has an unrecognized meal.`);
    }
    if (typeof entry.name !== 'string' || !entry.name.trim()) {
      throw new TypeError(`Entry ${index + 1} needs a food name.`);
    }

    const normalized = { meal: entry.meal, name: entry.name.trim() };
    for (const field of NUTRIENT_FIELDS) {
      const value = entry[field];
      if (!Number.isFinite(value) || value < 0) {
        throw new TypeError(`Entry ${index + 1}: ${field} must be a non-negative number.`);
      }
      normalized[field] = value;
    }

    if (!Number.isFinite(entry.servings) || entry.servings <= 0) {
      throw new TypeError(`Entry ${index + 1}: servings must be greater than zero.`);
    }
    normalized.servings = entry.servings;
    return normalized;
  });

  return { policyKey: input.policy, policy, thresholds, entries };
}

function validateMealPlan(input) {
  const { policyKey, policy, thresholds, entries } = validatePlan(input);
  const totals = entries.reduce((acc, entry) => {
    acc.sodiumMg += entry.sodiumMg * entry.servings;
    acc.carbohydratesG += entry.carbohydratesG * entry.servings;
    acc.addedSugarG += entry.addedSugarG * entry.servings;
    acc.fiberG += entry.fiberG * entry.servings;
    acc.byMeal[entry.meal] ??= { carbohydratesG: 0, addedSugarG: 0, fiberG: 0 };
    acc.byMeal[entry.meal].carbohydratesG += entry.carbohydratesG * entry.servings;
    acc.byMeal[entry.meal].addedSugarG += entry.addedSugarG * entry.servings;
    acc.byMeal[entry.meal].fiberG += entry.fiberG * entry.servings;
    return acc;
  }, {
    sodiumMg: 0,
    carbohydratesG: 0,
    addedSugarG: 0,
    fiberG: 0,
    byMeal: {},
  });

  const results = [];
  if (policy.rules.includes('sodium')) {
    results.push({
      id: 'sodium',
      label: 'Daily sodium',
      metric: 'sodiumMg',
      unit: 'mg',
      operator: '<=',
      limit: thresholds.sodiumMg,
      actual: totals.sodiumMg,
      passed: totals.sodiumMg <= thresholds.sodiumMg,
      scope: 'day',
    });
  }

  const mealRules = [
    ['carbohydrates', 'Carbohydrates per meal', 'carbohydratesG', '<=', thresholds.carbohydratesG],
    ['addedSugar', 'Added sugar per meal', 'addedSugarG', '<=', thresholds.addedSugarG],
    ['fiber', 'Fiber per meal', 'fiberG', '>=', thresholds.fiberG],
  ];

  for (const [id, label, metric, operator, limit] of mealRules) {
    if (!policy.rules.includes(id)) continue;
    for (const [meal, mealTotals] of Object.entries(totals.byMeal)) {
      const actual = mealTotals[metric];
      results.push({
        id: `${id}-${meal.toLowerCase()}`,
        rule: id,
        label,
        meal,
        metric,
        unit: 'g',
        operator,
        limit,
        actual,
        passed: operator === '<=' ? actual <= limit : actual >= limit,
        scope: 'meal',
      });
    }
  }

  return {
    policy: { key: policyKey, label: policy.label },
    thresholds,
    totals,
    results,
    compliant: results.every(result => result.passed),
    checkedAt: new Date().toISOString(),
    disclaimer: 'Educational demonstration only. Not a clinical diet prescription or substitute for institutional policy and registered dietitian review.',
  };
}

module.exports = { DEFAULT_THRESHOLDS, POLICIES, validateMealPlan };