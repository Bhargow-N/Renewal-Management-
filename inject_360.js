const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Inject html2pdf
html = html.replace(
  '<!-- Chart.js -->\n<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>',
  '<!-- Chart.js -->\n<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n<!-- html2pdf.js -->\n<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>'
);

// 2. Inject CSS
html = html.replace(
  '</style>\n</head>',
  `  /* 360 View Modal Styles */
  #opp360Modal { display: none; }
  #opp360Modal .modal-card { max-width: 1200px; height: 90vh; display: flex; flex-direction: column; background: var(--bg-main); }
  #opp360Modal .modal-body { overflow-y: auto; flex: 1; padding: 24px; background: var(--bg-main); }
  .v360-header { padding: 20px 24px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--card-bg); }
  .v360-title { font-size: 20px; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 12px; }
  .v360-actions { display: flex; gap: 12px; align-items: center; }
  .v360-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--border-color); padding: 0 24px; background: var(--card-bg); }
  .v360-tab { padding: 12px 0; font-size: 13px; font-weight: 600; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; }
  .v360-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .v360-section { display: none; flex-direction: column; gap: 24px; }
  .v360-section.active { display: flex; }
  .v360-details-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .v360-detail-item { background: #fff; padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; }
  .v360-detail-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; }
  .v360-detail-value { font-size: 14px; font-weight: 600; color: var(--primary); }
</style>
</head>`
);

// 3. Inject Modal HTML
html = html.replace(
  '<div class="app-container">',
  `<!-- Opportunity 360 View Modal -->
<div id="opp360Modal" class="modal-overlay">
  <div class="modal-card">
    <div class="v360-header" data-html2canvas-ignore="true">
      <div class="v360-title">
        <button class="btn-sm btn-outline" onclick="closeOpp360()" style="margin-right:8px;">← Back</button>
        <span id="v360Name">Opportunity Name</span>
        <div id="v360Badges" style="display:flex; gap:8px;"></div>
      </div>
      <div class="v360-actions">
        <button class="btn-sm btn-outline" onclick="export360PDF()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export PDF
        </button>
      </div>
    </div>
    
    <div id="pdf-export-content" style="flex:1; display:flex; flex-direction:column;">
      <div class="v360-title" id="pdf-title-only" style="display:none; padding: 24px 24px 0 24px; font-size: 24px; color: #000;"></div>
      
      <div class="v360-tabs" data-html2canvas-ignore="true">
        <div class="v360-tab active" onclick="switch360Tab('overview')">Overview</div>
        <div class="v360-tab" onclick="switch360Tab('contacts')">Customer Contacts</div>
        <div class="v360-tab" onclick="switch360Tab('history')">Activity History</div>
      </div>
      <div class="modal-body">
        <!-- Overview Section -->
        <div id="v360-overview" class="v360-section active">
          <div class="card">
            <div class="card-header"><div class="card-title">Opportunity Details</div></div>
            <div style="padding: 20px;">
              <div class="v360-details-grid" id="v360DetailsGrid"></div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">KAM Response</div></div>
            <div style="padding: 20px; font-size: 13px;" id="v360KamResponse"></div>
          </div>
        </div>
        <!-- Contacts Section -->
        <div id="v360-contacts" class="v360-section">
          <div class="contacts-grid" id="v360ContactsGrid"></div>
        </div>
        <!-- History Section -->
        <div id="v360-history" class="v360-section">
          <div class="card">
             <div class="card-header"><div class="card-title">Activity Log</div></div>
             <div id="v360HistoryLog" style="padding:20px; display:flex; flex-direction:column; gap:12px;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="app-container">`
);

// 4. Update renderTable row click
// Use double quotes for the node script string so we don't accidentally evaluate ${oppEscaped} in Node.
html = html.replace(
  "    <tr>\n      <td>\n        <button class=\"row-action-btn\" onclick=\"inlineEditOpp('${oppEscaped}')\" title=\"Edit Record\">",
  "    <tr onclick=\"openOpp360('${oppEscaped}')\" style=\"cursor: pointer;\">\n      <td>\n        <button class=\"row-action-btn\" onclick=\"event.stopPropagation(); inlineEditOpp('${oppEscaped}')\" title=\"Edit Record\">"
);

// 5. Inject JS logic for 360 View right before </script>
const jsLogic = `
// --- 360 View Logic ---
let current360Opp = null;
let current360Data = null;
let v360Contacts = {};
let v360ActiveFormCategory = null;
let v360EditingCategory = null;
let v360EditingIndex = null;

function switch360Tab(tabId) {
  document.querySelectorAll('.v360-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.v360-section').forEach(s => s.classList.remove('active'));
  
  event.currentTarget.classList.add('active');
  document.getElementById('v360-' + tabId).classList.add('active');
}

function closeOpp360() {
  document.getElementById('opp360Modal').style.display = 'none';
}

function openOpp360(oppName) {
  current360Opp = oppName;
  const row = allRows.find(r => String(r[C.opp]) === oppName);
  if (!row) return;
  current360Data = row;
  
  document.getElementById('opp360Modal').style.display = 'flex';
  document.getElementById('v360Name').innerText = oppName;
  document.getElementById('pdf-title-only').innerText = oppName + ' - 360 View';
  
  let badges = groupBadge(row[C.group]) + forecastBadge(row[C.forecast]);
  document.getElementById('v360Badges').innerHTML = badges;
  
  // Render Overview
  const excludeFields = [C.opp, C.response, "contacts"];
  let detailsHtml = '';
  for (const [key, val] of Object.entries(row)) {
    if (excludeFields.includes(key)) continue;
    let displayVal = val;
    if (key === C.tcv || key === C.revenue || key === C.acv) displayVal = money(val);
    detailsHtml += \`
      <div class="v360-detail-item">
        <div class="v360-detail-label">\${esc(key)}</div>
        <div class="v360-detail-value">\${displayVal || '—'}</div>
      </div>
    \`;
  }
  document.getElementById('v360DetailsGrid').innerHTML = detailsHtml;
  document.getElementById('v360KamResponse').innerText = row[C.response] || "No response provided.";
  
  // Render Contacts
  v360Contacts = row.contacts || { 'ROAMING': [], 'SIGNALING': [], 'NETWORK SECURITY': [], 'CUSTOMER INTELLIGENCE': [] };
  v360ActiveFormCategory = null;
  render360Contacts();
  
  // Load History
  load360History(oppName);
  
  // Default to overview tab
  document.querySelector('.v360-tab').click();
}

async function load360History(oppName) {
  const container = document.getElementById('v360HistoryLog');
  container.innerHTML = '<div style="color:var(--text-muted);">Loading history...</div>';
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    if (!data.success) throw new Error("Failed to load");
    
    const logs = data.logs.filter(l => l.record_name === oppName);
    if (logs.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);">No activity recorded for this opportunity yet.</div>';
      return;
    }
    
    container.innerHTML = logs.map(log => {
      const time = new Date(log.created_at).toLocaleString();
      let changesHtml = '';
      if (log.changes) {
        changesHtml = \`<div class="log-changes" style="display:block; margin-top:8px;">\`;
        for (const [field, vals] of Object.entries(log.changes)) {
          if (field === "contacts") continue; // Skip contact spam in UI if desired
          changesHtml += \`
            <div class="change-row">
              <div class="change-field">\${esc(field)}</div>
              <div class="change-values">
                <div class="change-old">- \${esc(vals.old)}</div>
                <div class="change-new">+ \${esc(vals.new)}</div>
              </div>
            </div>
          \`;
        }
        changesHtml += \`</div>\`;
      }
      
      return \`
        <div class="log-item \${log.action === 'Added' ? 'added' : 'updated'}">
          <div class="log-item-title">\${esc(log.details)}</div>
          <div class="log-item-time">\${time}</div>
          \${changesHtml}
        </div>
      \`;
    }).join('');
  } catch(e) {
    container.innerHTML = \`<div style="color:var(--danger);">Error loading history.</div>\`;
  }
}

function render360Contacts() {
  const grid = document.getElementById("v360ContactsGrid");
  let html = '';
  CONTACT_CATEGORIES.forEach(cat => {
    const contacts = v360Contacts[cat] || [];
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
              <div style="display:flex; gap:4px;" data-html2canvas-ignore="true">
                <button class="btn-delete" onclick="edit360Contact('\${cat}', \${index})" title="Edit Contact">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button class="btn-delete" onclick="delete360Contact('\${cat}', \${index})" title="Delete Contact">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
              </div>
            </div>
            <div class="ci-detail"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> \${esc(c.email)}</div>
            \${c.phone ? \`<div class="ci-detail"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> \${esc(c.phone)}</div>\` : ''}
          </div>
        \`;
      });
      html += \`</div>\`;
    }

    if (v360ActiveFormCategory === cat) {
      html += \`
        <div class="contact-form" style="display:flex;">
          <div class="form-group"><label>Contact Name *</label><input id="v360cName" type="text" placeholder="e.g. John Doe"></div>
          <div class="form-group"><label>Email ID *</label><input id="v360cEmail" type="email" placeholder="john@operator.com"></div>
          <div class="form-group"><label>Position</label><input id="v360cPos" type="text" placeholder="e.g. VP Operations"></div>
          <div class="form-group"><label>Mobile Number</label><input id="v360cPhone" type="tel" placeholder="+966 50 123 4567"></div>
          <div class="form-group">
            <label>Decision Authority</label>
            <select id="v360cAuth">
              <option>No</option><option>Yes</option><option>Unknown</option>
            </select>
          </div>
          <div class="form-actions">
            <button class="btn-sm btn-cancel" onclick="toggle360Form(null)">Cancel</button>
            <button class="btn-sm btn-save" onclick="save360Contact('\${cat}')">Save</button>
          </div>
        </div>
      \`;
    } else {
      html += \`<button class="btn-add-contact" data-html2canvas-ignore="true" onclick="toggle360Form('\${cat}')">+ Add Contact</button>\`;
    }
    
    html += \`</div>\`;
  });

  grid.innerHTML = html;
}

function toggle360Form(category) {
  v360ActiveFormCategory = category;
  v360EditingCategory = null;
  v360EditingIndex = null;
  render360Contacts();
}

function edit360Contact(category, index) {
  v360ActiveFormCategory = category;
  v360EditingCategory = category;
  v360EditingIndex = index;
  render360Contacts();
  
  setTimeout(() => {
    const contact = v360Contacts[category][index];
    if(contact) {
      document.getElementById('v360cName').value = contact.name || '';
      document.getElementById('v360cEmail').value = contact.email || '';
      document.getElementById('v360cPos').value = contact.position || '';
      document.getElementById('v360cPhone').value = contact.phone || '';
      document.getElementById('v360cAuth').value = contact.auth || 'No';
    }
  }, 0);
}

function delete360Contact(category, index) {
  if(confirm("Are you sure you want to delete this contact?")) {
    v360Contacts[category].splice(index, 1);
    saveAll360ContactsToDb();
  }
}

function save360Contact(category) {
  const name = document.getElementById('v360cName').value.trim();
  const email = document.getElementById('v360cEmail').value.trim();
  if (!name || !email) {
    alert("Name and Email are required");
    return;
  }

  const contact = {
    name,
    email,
    position: document.getElementById('v360cPos').value.trim(),
    phone: document.getElementById('v360cPhone').value.trim(),
    auth: document.getElementById('v360cAuth').value
  };

  if (!v360Contacts[category]) v360Contacts[category] = [];

  if (v360EditingCategory === category && v360EditingIndex !== null) {
    v360Contacts[category][v360EditingIndex] = contact;
  } else {
    v360Contacts[category].push(contact);
  }

  saveAll360ContactsToDb();
}

async function saveAll360ContactsToDb() {
  const newData = {
    "Opportunity Name": current360Opp,
    "contacts": v360Contacts
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
      v360ActiveFormCategory = null;
      // Re-fetch everything silently to ensure our local 'allRows' state is updated with the new contacts
      loadExcelData();
    } else {
      alert("Error saving contacts: " + result.message);
    }
  } catch(e) {
    alert("Failed to save data: " + e.message);
  }
}

function export360PDF() {
  // Show all sections temporarily for the PDF
  document.querySelectorAll('.v360-section').forEach(s => {
    s.style.display = 'flex';
  });
  
  // Show the title inside the body
  document.getElementById('pdf-title-only').style.display = 'block';
  
  const element = document.getElementById('pdf-export-content');
  const opt = {
    margin:       10,
    filename:     current360Opp + ' - 360 View.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save().then(() => {
    // Restore normal tabs
    document.querySelectorAll('.v360-section').forEach(s => {
      s.style.display = '';
    });
    document.getElementById('pdf-title-only').style.display = 'none';
    
    // Switch back to the currently active tab
    document.querySelector('.v360-tab.active').click();
  });
}
`;

// Also fix any template literal \${} issues inside jsLogic by keeping them escaped correctly
// Since the string above is in a template literal, \${esc(key)} is evaluated by Node.js unless escaped as \\\${esc(key)}.
// Wait, I did use \${esc(key)} in the jsLogic block above! So it will evaluate correctly to ${esc(key)} in the script string.
// Let's make sure it doesn't fail again.

html = html.replace('</script>\n</body>', jsLogic + '\n</script>\n</body>');

fs.writeFileSync(indexPath, html);
console.log("Successfully injected 360 View Modal into index.html");
