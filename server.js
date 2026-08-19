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

// SSE Clients array
let sseClients = [];

// Helper to broadcast events to all connected clients
function broadcastEvent(data) {
  sseClients.forEach(client => client.res.write(`data: ${JSON.stringify(data)}\n\n`));
}

// SSE Endpoint for real-time notifications
app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on("close", () => {
    sseClients = sseClients.filter(client => client.id !== clientId);
  });
});

// Endpoint to fetch activity logs
app.get("/api/logs", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json({ success: true, logs: data || [] });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ success: false, message: error.message, logs: [] });
  }
});

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
    let isUpdate = false;
    let changes = null;
    
    if (existingRecords && existingRecords.length > 0) {
      const oldData = existingRecords[0].data;
      mergedData = { ...oldData, ...newData };
      isUpdate = true;
      
      // Calculate what changed
      changes = {};
      for (const key in newData) {
        // Only track fields that are actually different and ignore the primary key
        if (newData[key] !== oldData[key] && key !== "Opportunity Name") {
          // If the field is just being set from empty to empty, ignore it
          if (!oldData[key] && !newData[key]) continue; 
          changes[key] = { old: oldData[key] || "—", new: newData[key] || "—" };
        }
      }
      if (Object.keys(changes).length === 0) changes = null;
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

    // Log the activity
    const action = isUpdate ? "Updated" : "Added";
    const logMessage = `${action} record: ${opportunityName}`;
    
    try {
      await supabase.from("activity_logs").insert([{
        action: action,
        record_name: opportunityName,
        details: logMessage,
        changes: changes
      }]);
    } catch (logError) {
      console.error("Failed to insert log:", logError);
      // We don't fail the request if logging fails
    }

    // Broadcast event to connected clients
    broadcastEvent({
      action: action,
      recordName: opportunityName,
      message: logMessage,
      timestamp: new Date().toISOString()
    });

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
