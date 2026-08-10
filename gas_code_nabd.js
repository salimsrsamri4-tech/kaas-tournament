// ============================================================
// مهرجان نبض المستقبل - Google Apps Script API
// انسخ هذا الكود بالكامل في محرر Apps Script (Extensions > Apps Script)
// لجدول Google Sheet جديد خاص بهذه البطولة، ثم انشره كتطبيق ويب.
//
// خطوات الإعداد:
// 1) أنشئ Google Sheet جديد فارغ (اسمه مثلاً: بيانات مهرجان نبض المستقبل).
// 2) من القائمة: Extensions > Apps Script.
// 3) احذف أي كود موجود، والصق هذا الملف بالكامل.
// 4) عدّل SHEET_ID أدناه ليطابق معرف الجدول (من رابط الشيت).
// 5) من الأعلى يمين: Deploy > New deployment.
//    - Select type: Web app
//    - Execute as: Me
//    - Who has access: Anyone
//    - اضغط Deploy، واسمح بالصلاحيات المطلوبة.
// 6) انسخ الرابط الناتج (ينتهي بـ /exec) وضعه في index.html
//    داخل NABD_CONFIG.GAS_URL بدلاً من 'YOUR_GAS_URL_HERE'.
// ============================================================

var SHEET_ID = 'ضع_معرف_الشيت_هنا'; // من رابط الشيت: /d/<هذا الجزء>/edit

// ==================== GET (قراءة البيانات / حذف عناصر المعرض) ====================
function doGet(e) {
  try {
    var action = (e.parameter.action || 'get');

    if (action === 'get') {
      var sheetName = e.parameter.sheet || 'الورقة1';
      var limit = parseInt(e.parameter.limit) || 500;
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return ok([]);

      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) return ok([]);

      var headers = data[0].map(function(h){ return h.toString().trim(); });
      var rows = [];
      for (var i = 1; i < data.length && rows.length < limit; i++) {
        var row = {};
        var empty = true;
        headers.forEach(function(h, j) {
          var val = data[i][j] !== undefined && data[i][j] !== null ? data[i][j].toString() : '';
          row[h] = val;
          if (val !== '') empty = false;
        });
        if (!empty) rows.push(row);
      }
      return ok(rows);
    }

    // حذف عنصر من معرض الصور/الفيديوهات — عبر رابط العنصر أو رقم الصف
    if (action === 'deleteGalleryItem') {
      var sheet2 = SpreadsheetApp.openById(SHEET_ID).getSheetByName('معرض البطولة');
      if (!sheet2) return ok({ ok: false, error: 'sheet not found' });
      var data2 = sheet2.getDataRange().getValues();
      var headers2 = data2[0].map(function(h){ return h.toString().trim(); });

      if (e.parameter.sheet_row) {
        var rowNum = parseInt(e.parameter.sheet_row);
        if (rowNum > 1 && rowNum <= sheet2.getLastRow()) {
          sheet2.deleteRow(rowNum);
          return ok({ ok: true });
        }
        return ok({ ok: false, error: 'invalid row' });
      }

      var urlCol = headers2.indexOf('الرابط');
      var titleCol = headers2.indexOf('العنوان');
      var itemUrl = e.parameter.item_url || '';
      var itemTitle = e.parameter.item_title || '';
      for (var r = data2.length - 1; r >= 1; r--) {
        if ((urlCol >= 0 && data2[r][urlCol] === itemUrl) ||
            (titleCol >= 0 && itemTitle && data2[r][titleCol] === itemTitle)) {
          sheet2.deleteRow(r + 1);
          return ok({ ok: true });
        }
      }
      return ok({ ok: false, error: 'not found' });
    }

    return ok({ error: 'unknown action' });
  } catch(err) {
    return ok({ error: err.message });
  }
}

// ==================== POST (كتابة وحذف) ====================
function doPost(e) {
  try {
    if (e.parameter.action === 'upload' || e.parameter.type === 'upload') {
      return handleUpload(e);
    }

    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'append';
    var sheetName = body.sheet || e.parameter.sheet || 'الورقة1';
    var ss = SpreadsheetApp.openById(SHEET_ID);

    // ── إضافة صفوف ──
    if (action === 'append') {
      var sheet = getOrCreateSheet(ss, sheetName);
      var rows = Array.isArray(body.data) ? body.data : [body.data];
      var headers = getHeaders(sheet);

      if (headers.length === 0) {
        headers = Object.keys(rows[0]);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }

      rows.forEach(function(row) {
        var values = headers.map(function(h) {
          var v = row[h];
          return v !== undefined && v !== null ? v.toString() : '';
        });
        sheet.appendRow(values);
      });
      return ok({ status: 'ok', added: rows.length });
    }

    // ── حذف صفوف بحسب عمود/قيمة ──
    if (action === 'delete') {
      var sheetD = ss.getSheetByName(sheetName);
      if (!sheetD) return ok({ status: 'ok', deleted: 0 });
      var col = body.column;
      var val = body.value ? body.value.toString() : '';
      var dataD = sheetD.getDataRange().getValues();
      var headersD = dataD[0].map(function(h){ return h.toString().trim(); });
      var colIdx = headersD.indexOf(col);
      if (colIdx < 0) return ok({ status: 'ok', deleted: 0 });
      var deleted = 0;
      for (var i = dataD.length - 1; i >= 1; i--) {
        if (dataD[i][colIdx].toString().trim() === val) {
          sheetD.deleteRow(i + 1);
          deleted++;
        }
      }
      return ok({ status: 'ok', deleted: deleted });
    }

    // ── حذف لاعب محدد من أكاديمية محددة (تستخدمه صفحة تعديل/حذف اللاعب) ──
    if (action === 'deletePlayer') {
      var sheetP = ss.getSheetByName('اللاعبون');
      if (!sheetP) return ok({ status: 'ok', deleted: 0 });
      var dataP = sheetP.getDataRange().getValues();
      var headersP = dataP[0].map(function(h){ return h.toString().trim(); });
      var pidCol = headersP.indexOf('معرف اللاعب');
      var acadCol = headersP.indexOf('معرف الأكاديمية');
      var deletedP = 0;
      for (var j = dataP.length - 1; j >= 1; j--) {
        if (pidCol >= 0 && dataP[j][pidCol].toString().trim() === (body.player_id || '').toString().trim() &&
            (acadCol < 0 || dataP[j][acadCol].toString().trim() === (body.academy_id || '').toString().trim())) {
          sheetP.deleteRow(j + 1);
          deletedP++;
        }
      }
      return ok({ status: 'ok', deleted: deletedP });
    }

    if (action === 'upload') {
      return handleUpload(e);
    }

    return ok({ error: 'unknown action: ' + action });
  } catch(err) {
    return ok({ error: err.message });
  }
}

// ==================== مساعدات ====================
function ok(data) {
  var out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function getHeaders(sheet) {
  var last = sheet.getLastColumn();
  if (last === 0) return [];
  return sheet.getRange(1, 1, 1, last).getValues()[0].map(function(h){ return h.toString().trim(); });
}

// ==================== رفع الملفات (صور/فيديوهات المعرض) ====================
function handleUpload(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    // TODO: استبدل بمعرّف مجلد Google Drive الخاص بهذه البطولة
    var folder = DriveApp.getFolderById('ضع_معرف_مجلد_درايف_هنا');
    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.file),
      data.mimeType,
      data.filename
    );
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return ok({ id: file.getId(), url: file.getUrl() });
  } catch(err) {
    return ok({ error: err.message });
  }
}
