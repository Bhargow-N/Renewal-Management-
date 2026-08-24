require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const firstNames = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Margaret", "Anthony", "Betty", "Mark", "Sandra"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"];

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function generateOwners(count) {
  const owners = new Set();
  while (owners.size < count) {
    const fName = firstNames[getRandomInt(firstNames.length)];
    const lName = lastNames[getRandomInt(lastNames.length)];
    owners.add(`${fName} ${lName}`);
  }
  return Array.from(owners);
}

async function run() {
  const owners = generateOwners(25);
  console.log("Generated 25 random owners:");
  console.log(owners.join(", "));

  console.log("\nFetching existing opportunities...");
  
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

  console.log(`Found ${allData.length} opportunities. Assigning random owners...`);

  const ownerCounts = {};
  owners.forEach(o => ownerCounts[o] = 0);

  for (const record of allData) {
    const oldData = record.data || {};
    
    // Randomly pick an owner
    const randomOwner = owners[getRandomInt(owners.length)];
    ownerCounts[randomOwner]++;

    const newData = { ...oldData, 'Opportunity Owner': randomOwner };

    const { error: updateError } = await supabase
      .from("renewals")
      .update({ data: newData })
      .eq("Opportunity Name", record["Opportunity Name"]);

    if (updateError) {
      console.error(`Failed to update ${record["Opportunity Name"]}:`, updateError);
    }
  }

  console.log("\nFinished assigning owners! Owner distribution:");
  for (const owner of owners) {
    console.log(`${owner}: ${ownerCounts[owner]} opportunities`);
  }
}

run();
