require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONTACT_CATEGORIES = ['ROAMING', 'SIGNALING', 'NETWORK SECURITY', 'CUSTOMER INTELLIGENCE'];

const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"];
const positions = ["Manager", "Director", "VP", "Executive", "Engineer", "Analyst", "Consultant", "Coordinator", "Specialist", "Head"];
const authorities = ["Yes", "No", "Unknown"];

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function generateMockContact() {
  const fName = firstNames[getRandomInt(firstNames.length)];
  const lName = lastNames[getRandomInt(lastNames.length)];
  return {
    name: `${fName} ${lName}`,
    email: `${fName.toLowerCase()}.${lName.toLowerCase()}@example.com`,
    position: positions[getRandomInt(positions.length)],
    phone: `+1 555 ${String(getRandomInt(1000)).padStart(3, '0')} ${String(getRandomInt(10000)).padStart(4, '0')}`,
    auth: authorities[getRandomInt(authorities.length)]
  };
}

async function run() {
  console.log("Fetching existing opportunities...");
  
  let allData = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("renewals")
      .select('"Opportunity Name", data')
      .range(from, from + step - 1);

    if (error) {
      console.error("Error fetching data:", error);
      process.exit(1);
    }

    allData = allData.concat(data);

    if (data.length < step) {
      hasMore = false;
    } else {
      from += step;
    }
  }

  console.log(`Found ${allData.length} opportunities. Generating mock contacts...`);

  for (const record of allData) {
    const oldData = record.data || {};
    
    // Generate contacts for this opportunity
    const contacts = {
      'ROAMING': [],
      'SIGNALING': [],
      'NETWORK SECURITY': [],
      'CUSTOMER INTELLIGENCE': []
    };

    // Randomly add 1 to 2 contacts per category so none are empty
    for (const cat of CONTACT_CATEGORIES) {
      const numContacts = 1 + getRandomInt(2); // Guarantees 1 or 2 contacts
      for (let i = 0; i < numContacts; i++) {
        contacts[cat].push(generateMockContact());
      }
    }

    const newData = { ...oldData, contacts: contacts };

    const { error: updateError } = await supabase
      .from("renewals")
      .update({ data: newData })
      .eq("Opportunity Name", record["Opportunity Name"]);

    if (updateError) {
      console.error(`Failed to update ${record["Opportunity Name"]}:`, updateError);
    }
  }

  console.log("Finished generating mock contacts!");
}

run();
