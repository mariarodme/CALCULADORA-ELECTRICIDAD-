"use strict";
// Small OOXML writer for the single-sheet reports. All values are text cells.
(function () {
  const encoder = new TextEncoder();
  const xmlEscape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

  const crcTable = Array.from({ length: 256 }, (_, index) => {
    let crc = index;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const local = [], central = [];
    let offset = 0, centralSize = 0;
    for (const [path, contents] of files) {
      const name = encoder.encode(path), data = encoder.encode(contents);
      const crc = crc32(data);
      const header = new Uint8Array(30 + name.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      header.set(name, 30);
      local.push(header, data);

      const directory = new Uint8Array(46 + name.length);
      const directoryView = new DataView(directory.buffer);
      directoryView.setUint32(0, 0x02014b50, true);
      directoryView.setUint16(4, 20, true);
      directoryView.setUint16(6, 20, true);
      directoryView.setUint32(16, crc, true);
      directoryView.setUint32(20, data.length, true);
      directoryView.setUint32(24, data.length, true);
      directoryView.setUint16(28, name.length, true);
      directoryView.setUint32(42, offset, true);
      directory.set(name, 46);
      central.push(directory);
      offset += header.length + data.length;
      centralSize += directory.length;
    }
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, files.length, true);
    view.setUint16(10, files.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    return new Blob([...local, ...central, end], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
  function cell(column, row, value, style = 0) {
    const text = xmlEscape(value);
    return `<c r="${column}${row}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${text}</t></is></c>`;
  }
  function makeReportWorkbook({ title, period, company, headings, rows }) {
    const columns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (headings.length > columns.length) throw new Error("Demasiadas columnas");
    const lastColumn = columns[headings.length - 1];
    const allRows = [
      [title],
      [period + " · " + company],
      [],
      headings,
      ...rows,
    ];
    const sheetRows = allRows.map((values, index) => {
      const number = index + 1;
      return `<row r="${number}">${values.map((value, col) =>
        cell(columns[col], number, value, number === 4 ? 1 : 0)).join("")}</row>`;
    }).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<dimension ref="A1:${lastColumn}${Math.max(4, allRows.length)}"/>` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>` +
      `<sheetFormatPr baseColWidth="8" defaultRowHeight="15"/>` +
      `<cols>${[16, 33, 28, 43, 17, 31, 18, 24, 54].slice(0, headings.length).map((width, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>` +
      `<sheetData>${sheetRows}</sheetData>` +
      `<autoFilter ref="A4:${lastColumn}${Math.max(4, allRows.length)}"/>` +
      `<mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>` +
      `<pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/></worksheet>`;
    const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    return zip([
      ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
      ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reporte" sheetId="1" r:id="rId1"/></sheets></workbook>`],
      ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF435536"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
      ["xl/worksheets/sheet1.xml", sheet],
    ]);
  }
  window.makeReportWorkbook = makeReportWorkbook;
})();
