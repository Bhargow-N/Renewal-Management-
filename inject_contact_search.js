const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Replace HTML structure for Contacts Tab
const oldHtml = `    <!-- Customer Contacts Tab -->
    <div id="contacts-tab" class="tab-content">
      <div class="contacts-section" style="margin-top: 0;">
        <div class="contacts-header">
          <div class="contacts-title">Customer Contacts Section</div>
        </div>
        <div class="contacts-grid" id="contactsGrid"></div>
      </div>
    </div>`;

const newHtml = `    <!-- Customer Contacts Tab -->
    <div id="contacts-tab" class="tab-content">
      <div class="contacts-section" style="margin-top: 0;">
        <div class="contacts-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%; border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 24px;">
          <div class="contacts-title">Customer Contacts Search</div>
          <div class="form-group" style="position: relative; width: 400px; margin-bottom: 0;">
            <input type="text" id="mainContactSearch" placeholder="Search opportunity name..." autocomplete="off" oninput="handleMainContactSearch(event)">
            <div id="mainContactSuggestions" class="suggestions-box"></div>
          </div>
        </div>
        <div class="contacts-grid" id="contactsGrid">
          <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px;">
            Search and select an opportunity above to view and manage its contacts.
          </div>
        </div>
      </div>
    </div>`;

if (html.includes(oldHtml)) {
  html = html.replace(oldHtml, newHtml);
} else {
  console.log("Could not find old HTML block to replace.");
}

// 2. Replace JS logic
const startIndex = html.indexOf("/* Customer Contacts Logic */");
const endIndex = html.indexOf("/* Real-time Notifications & Activity Log Logic */");

if (startIndex !== -1 && endIndex !== -1) {
  const newJs = `/* Customer Contacts Logic */
let mainContactsData = null; // Stores the row data of the currently selected opportunity in the main tab
let mainContacts = {}; // Local state for rendering
let mainActiveFormCategory = null;
let mainEditingCategory = null;
let mainEditingIndex = null;

function handleMainContactSearch(e) {
  const val = e.target.value.toLowerCase();
  const box = document.getElementById('mainContactSuggestions');
  
  if (!val || val.length < 2) {
    box.style.display = 'none';
    return;
  }
  
  const matches = allRows.filter(r => String(r[C.opp] || '').toLowerCase().includes(val)).slice(0, 10);
  
  if (matches.length === 0) {
    box.innerHTML = \`<div style="padding: 8px 12px; font-size: 11px; color: var(--text-muted);">No matching opportunities found.</div>\`;
    box.style.display = 'block';
    return;
  }
  
  box.innerHTML = matches.map(r => {
    const oppName = String(r[C.opp] || '');
    const escName = oppName.replace(/"/g, '&quot;').replace(/'/g, '\\\\'');
    return \`
      <div class="suggestion-item" onclick="selectMainContactOpp('\${escName}')">
        <span class="suggestion-opp">\${esc(oppName)}</span>
        <span class="suggestion-detail">\${esc(r[C.region] || '')} • \${esc(r[C.group] || '')}</span>
      </div>
    \`;
  }).join('');
  box.style.display = 'block';
}

// Close suggestions if clicking outside
document.addEventListener('click', function(e) {
  if (e.target.id !== 'mainContactSearch') {
    const box = document.getElementById('mainContactSuggestions');
    if(box) box.style.display = 'none';
  }
});

function selectMainContactOpp(oppName) {
  document.getElementById('mainContactSearch').value = oppName;
  document.getElementById('mainContactSuggestions').style.display = 'none';
  
  const row = allRows.find(r => String(r[C.opp]) === oppName);
  if (!row) return;
  
  mainContactsData = row;
  mainContacts = row.contacts || { 'ROAMING': [], 'SIGNALING': [], 'NETWORK SECURITY': [], 'CUSTOMER INTELLIGENCE': [] };
  mainActiveFormCategory = null;
  renderMainContacts();
}

function renderMainContacts() {
  const grid = document.getElementById("contactsGrid");
  if (!mainContactsData) {
    grid.innerHTML = \`<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 14px;">
      Search and select an opportunity above to view and manage its contacts.
    </div>\`;
    return;
  }
  
  let html = '';
  CONTACT_CATEGORIES.forEach(cat => {
    const contacts = mainContacts[cat] || [];
    const count = contacts.length;
    
    html += \`
      <div class="contact-card">
        <div class="contact-card-header">
          <div class="contact-category">\${cat}</div>
          <div class="contact-count-badge">\${count} Contact\${count !== 1 ? 's' : ''}</div>
        </div>
    \`;

    if (count === 0) {
      html += \`<div class="contact-empty-text">No contacts added yet.</div>\`;
    } else {
      html += \`<div class="contact-list">\`;
      contacts.forEach((c, index) => {
        html += \`
          <div class="contact-item">
            <div class="ci-header">
              <div>
                <div class="ci-name">\${esc(c.name)}</div>
                <div class="ci-position">\${esc(c.position)}</div>
              </div>
              <div style="display:flex; gap:4px;">
                <button class="btn-delete" onclick="editMainContact('\${cat}', \${index})" title="Edit Contact">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button class="btn-delete" onclick="deleteMainContact('\${cat}', \${index})" title="Delete Contact">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </div>
            </div>
            <div class="ci-detail"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> \${esc(c.email)}</div>
            \${c.phone ? \`<div class="ci-detail"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> \${esc(c.phone)}</div>\` : ''}
          </div>
        \`;
      });
      html += \`</div>\`;
    }

    if (mainActiveFormCategory === cat) {
      html += \`
        <div class="contact-form" style="display:flex;">
          <div class="form-group"><label>Contact Name *</label><input id="mainCName" type="text" placeholder="e.g. John Doe"></div>
          <div class="form-group"><label>Email ID *</label><input id="mainCEmail" type="email" placeholder="john@operator.com"></div>
          <div class="form-group"><label>Position</label><input id="mainCPos" type="text" placeholder="e.g. VP Operations"></div>
          <div class="form-group"><label>Mobile Number</label><input id="mainCPhone" type="tel" placeholder="+966 50 123 4567"></div>
          <div class="form-group">
            <label>Decision Authority</label>
            <select id="mainCAuth">
              <option>No</option><option>Yes</option><option>Unknown</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn-sm btn-cancel" onclick="toggleMainForm(null)">Cancel</button>
            <button class="btn-sm btn-save" onclick="saveMainContact('\${cat}')">Save</button>
          </div>
        </div>
      \`;
    } else {
      html += \`<button class="btn-add-contact" onclick="toggleMainForm('\${cat}')">+ Add Contact</button>\`;
    }
    
    html += \`</div>\`;
  });

  grid.innerHTML = html;
}

function toggleMainForm(category) {
  mainActiveFormCategory = category;
  mainEditingCategory = null;
  mainEditingIndex = null;
  renderMainContacts();
}

function editMainContact(category, index) {
  mainActiveFormCategory = category;
  mainEditingCategory = category;
  mainEditingIndex = index;
  renderMainContacts();
  
  setTimeout(() => {
    const contact = mainContacts[category][index];
    if(contact) {
      document.getElementById('mainCName').value = contact.name || '';
      document.getElementById('mainCEmail').value = contact.email || '';
      document.getElementById('mainCPos').value = contact.position || '';
      document.getElementById('mainCPhone').value = contact.phone || '';
      document.getElementById('mainCAuth').value = contact.auth || 'No';
    }
  }, 0);
}

function deleteMainContact(category, index) {
  if(confirm("Are you sure you want to delete this contact?")) {
    mainContacts[category].splice(index, 1);
    saveAllMainContactsToDb();
  }
}

function saveMainContact(category) {
  const name = document.getElementById('mainCName').value.trim();
  const email = document.getElementById('mainCEmail').value.trim();
  if (!name || !email) {
    alert("Name and Email are required");
    return;
  }

  const contact = {
    name,
    email,
    position: document.getElementById('mainCPos').value.trim(),
    phone: document.getElementById('mainCPhone').value.trim(),
    auth: document.getElementById('mainCAuth').value
  };

  if (!mainContacts[category]) mainContacts[category] = [];

  if (mainEditingCategory === category && mainEditingIndex !== null) {
    mainContacts[category][mainEditingIndex] = contact;
  } else {
    mainContacts[category].push(contact);
  }

  saveAllMainContactsToDb();
}

async function saveAllMainContactsToDb() {
  if (!mainContactsData) return;
  const oppName = mainContactsData[C.opp];

  const newData = {
    "Opportunity Name": oppName,
    "contacts": mainContacts
  };

  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newData)
    });
    const result = await res.json();
    if (result.success) {
      showToast("Contacts saved to Database", "success");
      mainActiveFormCategory = null;
      // Re-fetch data silently to update our allRows state
      loadExcelData();
    } else {
      alert("Error saving contacts: " + result.message);
    }
  } catch(e) {
    alert("Failed to save data: " + e.message);
  }
}

`;

  const finalHtml = html.substring(0, startIndex) + newJs + html.substring(endIndex);
  fs.writeFileSync(indexPath, finalHtml);
  console.log("Successfully injected main contact search logic into index.html");
} else {
  console.log("Could not find JS block to replace.");
}
