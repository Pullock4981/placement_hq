var SECRET_PROPERTIES = ['GOOGLE_APPS_SCRIPT_SECRET', 'PLACEMENTHQ_SECRET'];

function doGet() {
  return json_({ ok: true, service: 'PlacementHQ Sheets Gateway', version: 3, capabilities: { placementSyncPage: true } });
}

function doPost(event) {
  try {
    var request = JSON.parse(event.postData.contents || '{}');
    var expected = configuredSecret_();
    if (!expected || request.secret !== expected) throw new Error('Unauthorized');
    return json_({ ok: true, data: execute_(request) });
  } catch (error) {
    return json_({
      ok: false,
      error: { message: String(error && error.message || error), code: errorCode_(error) }
    });
  }
}

function configuredSecret_() {
  var properties = PropertiesService.getScriptProperties();
  for (var index = 0; index < SECRET_PROPERTIES.length; index += 1) {
    var value = properties.getProperty(SECRET_PROPERTIES[index]);
    if (value) return value;
  }
  return '';
}

function execute_(request) {
  var id = request.spreadsheetId;
  var range = request.range;
  var options = request.options || {};
  var body = request.body || {};
  if (!id) throw new Error('spreadsheetId is required');

  switch (request.action) {
    case 'values.get':
      return Sheets.Spreadsheets.Values.get(id, range, options);
    case 'values.batchGet':
      return Sheets.Spreadsheets.Values.batchGet(id, options);
    case 'values.update':
      return Sheets.Spreadsheets.Values.update(body, id, range, options);
    case 'values.append':
      return Sheets.Spreadsheets.Values.append(body, id, range, options);
    case 'values.batchUpdate':
      return Sheets.Spreadsheets.Values.batchUpdate(body, id);
    case 'values.query':
      return queryValues_(id, range, options);
    case 'values.queryDateRange':
      return queryDateRange_(id, range, options);
    case 'placement.syncPage':
      return syncPlacementPage_(id, body);
    case 'spreadsheets.get':
      return Sheets.Spreadsheets.get(id, options);
    case 'spreadsheets.batchUpdate':
      return Sheets.Spreadsheets.batchUpdate(body, id);
    default:
      throw new Error('Unsupported action');
  }
}

function syncPlacementPage_(centralId, input) {
  var year = String(input.year || '');
  if (!/^\d{4}$/.test(year)) throw new Error('400 Invalid placement year');
  var placementHeaders = input.placementHeaders || [];
  var logHeaders = input.logHeaders || [];
  var records = input.records || [];
  if (!placementHeaders.length || !logHeaders.length || !Array.isArray(records)) throw new Error('400 Invalid placement sync payload');

  var registry = Sheets.Spreadsheets.Values.get(centralId, 'sheets!A:M').values || [];
  var connection = null;
  for (var rowIndex = registry.length - 1; rowIndex >= 1; rowIndex -= 1) {
    var row = registry[rowIndex] || [];
    if (String(row[1] || '') === 'placement_information'
      && String(row[6] || '') === 'connected'
      && String(row[11] || '') !== 'false'
      && String(row[12] || '').toUpperCase() === year) {
      connection = row;
      break;
    }
  }
  if (!connection || !connection[2]) throw new Error('404 No active placement workbook is assigned for ' + year);
  var workbookId = String(connection[2]);
  var metadata = Sheets.Spreadsheets.get(workbookId, { fields: 'sheets.properties(sheetId,title)' });
  var tabIds = {};
  (metadata.sheets || []).forEach(function (sheet) { tabIds[String(sheet.properties.title)] = sheet.properties.sheetId; });

  function ensureTab(title, headers) {
    if (tabIds[title] === undefined) {
      var created = Sheets.Spreadsheets.batchUpdate({ requests: [{ addSheet: { properties: { title: title, gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 8), frozenRowCount: 1 } } } }] }, workbookId);
      tabIds[title] = created.replies[0].addSheet.properties.sheetId;
      Sheets.Spreadsheets.Values.update({ values: [headers] }, workbookId, quoteSheet_(title) + '!A1:' + columnLetter_(headers.length) + '1', { valueInputOption: 'RAW' });
    }
  }

  var grouped = {};
  records.forEach(function (record) {
    var monthKey = String(record.month_key || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) return;
    var parts = monthKey.split('-');
    var tab = parts[1] + '_' + parts[0];
    grouped[tab] = grouped[tab] || [];
    grouped[tab].push(record);
  });

  var counters = { inserted: 0, updated: 0, unchanged: 0, invalid: 0 };
  var reviewFields = ['mentor_email', 'verification_status', 'verified_by', 'verified_at', 'verification_notes', 'internal_notes'];
  Object.keys(grouped).forEach(function (tabName) {
    ensureTab(tabName, placementHeaders);
    var range = quoteSheet_(tabName) + '!A:AD';
    var values = Sheets.Spreadsheets.Values.get(workbookId, range).values || [];
    var headers = values.length ? values[0].map(String) : placementHeaders;
    if (headers.join('|') !== placementHeaders.join('|')) throw new Error('409 Placement headers do not match in ' + tabName);
    var rows = values.slice(1);
    var indexById = {};
    rows.forEach(function (row, index) { var id = String(row[0] || ''); if (id) indexById[id] = index; });
    var data = [];
    var additions = [];
    grouped[tabName].forEach(function (record) {
      if (String(record.parse_status || '') !== 'valid') counters.invalid += 1;
      var existingIndex = indexById[String(record.discord_message_id || '')];
      var existing = existingIndex === undefined ? null : rows[existingIndex];
      var merged = {};
      placementHeaders.forEach(function (header, index) { merged[header] = existing ? String(existing[index] || '') : ''; });
      placementHeaders.forEach(function (header) { if (record[header] !== undefined) merged[header] = String(record[header] || ''); });
      if (existing) reviewFields.forEach(function (header) { var index = placementHeaders.indexOf(header); if (index >= 0 && existing[index]) merged[header] = String(existing[index]); });
      var output = placementHeaders.map(function (header) { return merged[header] || ''; });
      if (existingIndex === undefined) {
        additions.push(output);
        indexById[String(record.discord_message_id || '')] = rows.length + additions.length - 1;
        counters.inserted += 1;
      } else {
        var changed = placementHeaders.some(function (header, index) { return header !== 'synced_at' && String(existing[index] || '') !== String(output[index] || ''); });
        if (!changed) counters.unchanged += 1;
        else { data.push({ range: quoteSheet_(tabName) + '!A' + (existingIndex + 2) + ':AD' + (existingIndex + 2), values: [output] }); counters.updated += 1; }
      }
    });
    if (additions.length) {
      var firstRow = Math.max(2, values.length + 1);
      data.push({ range: quoteSheet_(tabName) + '!A' + firstRow + ':AD' + (firstRow + additions.length - 1), values: additions });
    }
    if (data.length) Sheets.Spreadsheets.Values.batchUpdate({ valueInputOption: 'RAW', data: data }, workbookId);
  });

  ensureTab('placement_sync_log', logHeaders);
  var log = input.log || {};
  log.fetched = Number(log.fetched || 0);
  log.inserted = counters.inserted;
  log.updated = counters.updated;
  log.unchanged = counters.unchanged;
  log.invalid = counters.invalid;
  var logRow = logHeaders.map(function (header) { return log[header] === undefined ? '' : log[header]; });
  Sheets.Spreadsheets.Values.append({ values: [logRow] }, workbookId, 'placement_sync_log!A:Q', { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
  return counters;
}

function quoteSheet_(title) {
  return "'" + String(title).replace(/'/g, "''") + "'";
}

function columnLetter_(columnNumber) {
  var value = Number(columnNumber);
  var result = '';
  while (value > 0) { var remainder = (value - 1) % 26; result = String.fromCharCode(65 + remainder) + result; value = Math.floor((value - 1) / 26); }
  return result;
}

function queryValues_(id, range, options) {
  if (!range) throw new Error('400 range is required');

  var result = Sheets.Spreadsheets.Values.get(id, range, { valueRenderOption: 'UNFORMATTED_VALUE' });
  var values = result.values || [];
  if (!values.length) {
    result.query = { totalRows: 0, matchedRows: 0, returnedRows: 0, offset: 0, limit: 0 };
    return result;
  }

  var headers = values[0].map(String);
  var rows = values.slice(1);
  var totalRows = rows.length;
  var filters = Array.isArray(options.filters) ? options.filters : [];
  if (filters.length > 10) throw new Error('400 A maximum of 10 filters is allowed');

  var fromDate = String(options.fromDate || '');
  var toDate = String(options.toDate || '');
  var dateColumn = String(options.dateColumn || '');
  var timeZone = String(options.timeZone || Session.getScriptTimeZone());
  var hasDateRange = Boolean(fromDate || toDate || dateColumn);
  var dateColumnIndex = -1;

  if (hasDateRange) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
      throw new Error('400 Invalid date range');
    }
    dateColumnIndex = headers.indexOf(dateColumn);
    if (dateColumnIndex < 0) throw new Error('400 Date column not found');
  }

  var normalizedFilters = filters.map(function (filter) {
    var column = String(filter && filter.column || '');
    var columnIndex = headers.indexOf(column);
    if (columnIndex < 0) throw new Error('400 Filter column not found: ' + column);
    var operator = String(filter.operator || 'equals');
    if (['equals', 'notEquals', 'contains', 'in'].indexOf(operator) < 0) {
      throw new Error('400 Unsupported filter operator: ' + operator);
    }
    return { columnIndex: columnIndex, operator: operator, value: filter.value };
  });

  rows = rows.filter(function (row) {
    if (hasDateRange) {
      var key = dateKey_(row[dateColumnIndex], timeZone);
      if (!key || key < fromDate || key > toDate) return false;
    }
    return normalizedFilters.every(function (filter) {
      return matchesFilter_(row[filter.columnIndex], filter.operator, filter.value);
    });
  });

  var matchedRows = rows.length;
  var offset = Math.max(0, Math.floor(Number(options.offset || 0)));
  var requestedLimit = options.limit === undefined ? 500 : Math.floor(Number(options.limit));
  var limit = Math.max(1, Math.min(5000, isNaN(requestedLimit) ? 500 : requestedLimit));
  var page = rows.slice(offset, offset + limit);

  result.values = [headers].concat(page);
  result.query = {
    totalRows: totalRows,
    matchedRows: matchedRows,
    returnedRows: page.length,
    offset: offset,
    limit: limit
  };
  return result;
}

function queryDateRange_(id, range, options) {
  return queryValues_(id, range, options);
}

function matchesFilter_(cellValue, operator, expectedValue) {
  var actual = String(cellValue === undefined || cellValue === null ? '' : cellValue).toLowerCase();
  if (operator === 'in') {
    if (!Array.isArray(expectedValue)) throw new Error('400 The in operator requires an array value');
    return expectedValue.map(function (value) { return String(value).toLowerCase(); }).indexOf(actual) >= 0;
  }
  var expected = String(expectedValue === undefined || expectedValue === null ? '' : expectedValue).toLowerCase();
  if (operator === 'notEquals') return actual !== expected;
  if (operator === 'contains') return actual.indexOf(expected) >= 0;
  return actual === expected;
}

function dateKey_(value, timeZone) {
  var date = typeof value === 'number'
    ? new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    : new Date(String(value || ''));
  return isNaN(date.getTime()) ? '' : Utilities.formatDate(date, timeZone, 'yyyy-MM-dd');
}

function errorCode_(error) {
  var match = String(error && error.message || error).match(/\b(400|401|403|404|409|429|500|503)\b/);
  return match ? Number(match[1]) : 500;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
