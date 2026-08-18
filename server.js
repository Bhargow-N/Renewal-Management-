require("dotenv").config();
const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PUBLIC_DIR = path.join(__dirname, "public");

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get("/api/data", async (req, res) => {
  try {
    let allData = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    let totalCount = 0;

    // Supabase has a default limit of 1000 rows per request.
    // We loop here to fetch everything if there are more than 1000.
    while (hasMore) {
      const { data, error, count } = await supabase
        .from("renewals")
        .select("data", { count: "exact" })
        .range(from, from + step - 1);

      if (error) throw error;
      if (from === 0) totalCount = count;

      allData = allData.concat(data);

      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    }

    // Extract the JSON data from each row to match the old API format
    const rows = allData.map((row) => row.data);

    res.json({
      success: true,
      source: "Supabase DB",
      sheet: "Renewals",
      lastModified: new Date().toISOString(),
      count: totalCount || rows.length,
      rows: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/data", async (req, res) => {
  try {
    const newData = req.body;
    if (!newData || !newData["Opportunity Name"]) {
      return res.status(400).json({ success: false, message: "Opportunity Name is required" });
    }

    const opportunityName = String(newData["Opportunity Name"]).trim();

    // Fetch existing record to merge data, just like the old Excel logic
    const { data: existingRecords, error: fetchError } = await supabase
      .from("renewals")
      .select("data")
      .eq("Opportunity Name", opportunityName);

    if (fetchError) throw fetchError;

    let mergedData = newData;
    if (existingRecords && existingRecords.length > 0) {
      mergedData = { ...existingRecords[0].data, ...newData };
    }

    // Upsert (Update or Insert)
    const { error: upsertError } = await supabase
      .from("renewals")
      .upsert(
        {
          "Opportunity Name": opportunityName,
          data: mergedData,
        },
        { onConflict: "Opportunity Name" }
      );

    if (upsertError) throw upsertError;

    res.json({ success: true, message: "Data saved successfully to Supabase" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Renewal Dashboard running at http://localhost:${PORT}`);
    console.log(`Connected to Supabase at ${supabaseUrl}`);
  });
}

module.exports = app;
