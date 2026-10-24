const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { validateMealPlan } = require('./engine');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1_000_000;
const pagePath = path.join(__dirname, 'bloom.html');

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function validateClinicalNote(note) {
  const errors = [];
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const requireObject = (value, label) => {
    if (!isObject(value)) errors.push(`${label} must be an object.`);
    return isObject(value) ? value : {};
  };
  const requireText = (value, label) => {
    if (!text(value)) errors.push(`${label} is required.`);
  };
  const requireTerm = (value, label) => {
    const term = requireObject(value, label);
    requireText(term.code, `${label} code`);
    requireText(term.label, `${label} label`);
  };

  if (!isObject(note)) return ['Request body must be a JSON object.'];
  if (note.schemaVersion !== '1.0.0') errors.push('schemaVersion must be 1.0.0.');

  const terminology = requireObject(note.terminology, 'terminology');
  if (terminology.system !== 'eNCPT') errors.push('terminology.system must be eNCPT.');
  requireText(terminology.release, 'terminology.release');

  const patient = requireObject(note.patient, 'patient');
  requireText(patient.localId, 'patient.localId');
  if (!date(patient.encounterDate)) errors.push('patient.encounterDate must be a valid YYYY-MM-DD date.');

  const author = requireObject(note.author, 'author');
  requireText(author.displayName, 'author.displayName');
  requireText(author.credentials, 'author.credentials');

  const assessment = requireObject(note.assessment, 'assessment');
  requireText(assessment.summary, 'assessment.summary');
  if (!Array.isArray(assessment.findings) || !assessment.findings.length) {
    errors.push('assessment.findings must contain at least one finding.');
  } else {
    const domains = ['Food/Nutrition-Related History', 'Anthropometric Measurements', 'Biochemical Data, Medical Tests and Procedures', 'Nutrition-Focused Physical Findings', 'Client History'];
    assessment.findings.forEach((finding, index) => {
      const item = requireObject(finding, `assessment.findings[${index}]`);
      if (!domains.includes(item.domain)) errors.push(`assessment.findings[${index}].domain is not recognized.`);
      requireTerm(item.term, `assessment.findings[${index}].term`);
      requireText(item.value, `assessment.findings[${index}].value`);
      requireText(item.source, `assessment.findings[${index}].source`);
      if (typeof item.unit !== 'string') errors.push(`assessment.findings[${index}].unit must be a string.`);
    });
  }

  const diagnosis = requireObject(note.diagnosis, 'diagnosis');
  requireTerm(diagnosis.problem, 'diagnosis.problem');
  requireTerm(diagnosis.etiology, 'diagnosis.etiology');
  requireText(diagnosis.pesStatement, 'diagnosis.pesStatement');
  if (!Array.isArray(diagnosis.signsSymptoms) || !diagnosis.signsSymptoms.length) {
    errors.push('diagnosis.signsSymptoms must contain at least one term.');
  } else {
    diagnosis.signsSymptoms.forEach((item, index) => requireTerm(item, `diagnosis.signsSymptoms[${index}]`));
  }

  const intervention = requireObject(note.intervention, 'intervention');
  if (!['Food and/or Nutrient Delivery', 'Nutrition Education', 'Nutrition Counseling', 'Coordination of Nutrition Care'].includes(intervention.category)) {
    errors.push('intervention.category is not recognized.');
  }
  requireTerm(intervention.term, 'intervention.term');
  if (!Array.isArray(intervention.actions) || !intervention.actions.length || intervention.actions.some(action => !text(action))) {
    errors.push('intervention.actions must contain at least one non-empty action.');
  }
  requireText(intervention.goal, 'intervention.goal');

  const monitoring = requireObject(note.monitoringEvaluation, 'monitoringEvaluation');
  if (!Array.isArray(monitoring.indicators) || !monitoring.indicators.length) {
    errors.push('monitoringEvaluation.indicators must contain at least one indicator.');
  } else {
    monitoring.indicators.forEach((indicator, index) => {
      const item = requireObject(indicator, `monitoringEvaluation.indicators[${index}]`);
      requireTerm(item.term, `monitoringEvaluation.indicators[${index}].term`);
      requireText(item.baseline, `monitoringEvaluation.indicators[${index}].baseline`);
      requireText(item.target, `monitoringEvaluation.indicators[${index}].target`);
      requireText(item.timeframe, `monitoringEvaluation.indicators[${index}].timeframe`);
    });
  }
  if (!date(monitoring.followUpDate)) errors.push('monitoringEvaluation.followUpDate must be a valid YYYY-MM-DD date.');
  requireText(monitoring.progressNote, 'monitoringEvaluation.progressNote');
  return errors;
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && ['/', '/bloom.html', '/lab2.html', '/lab3.html', '/engine.js', '/clinical-note.schema.json'].includes(request.url)) {
    const filePath = request.url === '/engine.js'
      ? path.join(__dirname, 'engine.js')
      : request.url === '/lab2.html'
        ? path.join(__dirname, 'lab2.html')
        : request.url === '/lab3.html'
          ? path.join(__dirname, 'lab3.html')
          : request.url === '/clinical-note.schema.json'
            ? path.join(__dirname, 'clinical-note.schema.json')
            : pagePath;
    const contentType = request.url === '/engine.js'
      ? 'text/javascript; charset=utf-8'
      : request.url === '/clinical-note.schema.json'
        ? 'application/schema+json; charset=utf-8'
        : 'text/html; charset=utf-8';
    fs.readFile(filePath, (error, page) => {
      if (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Unable to load the lab interface.');
        return;
      }
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(page);
    });
    return;
  }

  if (request.method === 'GET' && request.url.startsWith('/api/wearable/daily')) {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const provider = url.searchParams.get('provider') || 'googleFit';
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (!['googleFit', 'appleHealth'].includes(provider)) {
      sendJson(response, 400, { error: 'Provider must be googleFit or appleHealth.' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      sendJson(response, 400, { error: 'Date must be a valid YYYY-MM-DD calendar date.' });
      return;
    }
    const providerLabel = provider === 'googleFit' ? 'Google Fit' : 'Apple Health';
    sendJson(response, 200, {
      provider,
      providerLabel,
      date,
      steps: provider === 'googleFit' ? 8426 : 7914,
      activeEnergyKcal: provider === 'googleFit' ? 438 : 412,
      syncedAt: new Date().toISOString(),
      source: 'mock',
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/clinical-notes') {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        sendJson(response, 413, { error: 'Request body is too large.' });
        request.destroy();
      }
    });
    request.on('end', () => {
      if (response.writableEnded) return;
      try {
        const note = JSON.parse(body);
        const errors = validateClinicalNote(note);
        if (errors.length) {
          sendJson(response, 400, { error: 'Clinical note does not match the expected structure.', errors });
          return;
        }
        sendJson(response, 200, { valid: true, note });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof SyntaxError ? 'Request body must be valid JSON.' : error.message });
      }
    });
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/validate') {
    sendJson(response, 404, { error: 'Route not found.' });
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', chunk => {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      sendJson(response, 413, { error: 'Request body is too large.' });
      request.destroy();
    }
  });
  request.on('end', () => {
    if (response.writableEnded) return;
    try {
      const input = JSON.parse(body);
      sendJson(response, 200, validateMealPlan(input));
    } catch (error) {
      sendJson(response, 400, { error: error instanceof SyntaxError ? 'Request body must be valid JSON.' : error.message });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Policy rule engine ready at http://localhost:${PORT}`);
  console.log('To open it from another device on the same Wi-Fi, use this computer\'s LAN IP and the same port.');
});