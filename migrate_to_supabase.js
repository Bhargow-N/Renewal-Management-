require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_FILE = path.join(__dirname, 'Renewal_Opportunity_1000_Realistic.xlsx');

async function migrateData() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(EXCEL_FILE, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`Found ${rows.length} rows. Uploading to Supabase...`);

  const records = rows.map((row) => ({
    'Opportunity Name': String(row['Opportunity Name']).trim(),
    data: row,
  }));

  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('renewals')
      .upsert(batch, { onConflict: 'Opportunity Name' });

    if (error) {
      console.error(`Error uploading batch ${i} to ${i + batchSize}:`, error);
    } else {
      console.log(`Successfully uploaded batch ${i} to ${i + batchSize}`);
    }
  }

  console.log('Migration complete!');
}

migrateData().catch(console.error);
