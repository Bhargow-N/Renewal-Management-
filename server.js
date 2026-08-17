const express = require("express");
const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;
const EXCEL_FILE = path.join(__dirname, "Renewal_Opportunity_1000_Realistic.xlsx");
const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function readExcel() {
  if (!fs.existsSync(EXCEL_FILE)) {
    throw new Error(`Excel file not found: ${EXCEL_FILE}`);
  }

  const workbook = XLSX.readFile(EXCEL_FILE, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // defval keeps blank Excel cells as empty strings instead of dropping columns.
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return {
    sheetName,
    lastModified: fs.statSync(EXCEL_FILE).mtime.toISOString(),
    rows
  };
}

// Excel is read on every API request, so saved changes are reflected
// the next time the dashboard calls /api/data.
app.get("/api/data", (req, res) => {
  try {
    const result = readExcel();
    res.json({
      success: true,
      source: path.basename(EXCEL_FILE),
      sheet: result.sheetName,
      lastModified: result.lastModified,
      count: result.rows.length,
      rows: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Renewal Dashboard running at http://localhost:${PORT}`);
    console.log(`Excel source: ${EXCEL_FILE}`);
  });
}

module.exports = app;
