let map; // Global variable for the map
let allReports = []; // Store all reports for filtering

// Add this helper function at the top of your script
function getMarkerColor(sentiment) {
    const s = (sentiment || "").toString().toLowerCase().trim();
    if (s === 'negative') return 'red';
    if (s === 'positive') return 'green';
    return 'blue';
}

// HELPER: Smartly extract sentiment from ANY format or casing
function getSentimentText(report) {
    // 1. Check ALL possible casing variations
    let raw = report.sentiments || report.sentiment || report.Sentiments || report.Sentiment;
    
    if (!raw) return "neutral";

    // 2. If it's a string that looks like JSON, parse it
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            console.warn("Failed to parse sentiment JSON:", e);
        }
    }

    // 3. Extract value from Azure AI structures
    if (raw.documents && Array.isArray(raw.documents) && raw.documents.length > 0) {
        return raw.documents[0].sentiment; 
    } 
    else if (raw.sentiment) {
        return raw.sentiment;
    }
    else if (typeof raw === 'string') {
        return raw;
    }

    return "neutral";
}

// ==========================================
// CONFIGURATION: YOUR LOGIC APP URLS
// ==========================================
const SUBMIT_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/efe13b1eabd84a6ca949d9b687ba91d1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5T8mNlaNJshHKK7v91oBo7XEE5nYeZdnnHWgkTFV8tU"; 
const UPVOTE_URL = "https://prod-53.uksouth.logic.azure.com:443/workflows/cebfee1bfef44cce9895fb17933e863e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F8JlsLHiYQMC4qocqIH95cr-b8JhPSWy_EVvZOOhir8";
const VIEW_URL = "https://prod-14.uksouth.logic.azure.com:443/workflows/1f435b6dbd6e454192fc835d9c38ec93/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=Xq_1QkvdDjxsSzJVFqUBJWyaEeh-qN_DpbfRwaO03Vw"; 

// ==========================================
// 1. INITIALIZATION & EVENTS
// ==========================================
$(document).ready(function () {
    console.log("CiviQ App Loaded!"); 

    // Attach click events
    $("#submitBtn").click(submitNewAsset);
    
    // Auto-load reports
    loadReports();
});

// ==========================================
// 2. SUBMIT REPORT LOGIC
// ==========================================
function submitNewAsset() {
    // START: Add this line
    if(window.appInsights) {
        window.appInsights.trackEvent({ 
            name: 'ReportSubmitted', 
            properties: { 
                issueType: document.getElementById('issueType').value 
            }
        });
    }
    // END: Add this line

    console.log("Submit button clicked!"); 

    const issueType = document.getElementById('issueType').value;
    const description = document.getElementById('description').value;
    const lat = document.getElementById('latitude').value;
    const long = document.getElementById('longitude').value;
    const fileInput = document.getElementById('imageFile');

    if (!lat || !long) {
        alert("Please provide a location or click 'Get My Location' before submitting.");
        return;
    }

    if(fileInput.files.length === 0) {
        alert("Please select a photo!");
        return;
    }

    document.getElementById('statusMessage').innerText = "⏳ Submitting...";

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.readAsDataURL(file);
    
    reader.onload = function() {
        const rawBase64 = reader.result.split(',')[1]; 

        const payload = {
            "description": description,
            "issueType": issueType,
            "latitude": lat,
            "longitude": long,
            "photoContent": rawBase64, 
            "fileName": file.name
        };

        fetch(SUBMIT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                document.getElementById('statusMessage').innerText = "✅ Report Submitted Successfully!";
                setTimeout(loadReports, 2000); 
            } else {
                document.getElementById('statusMessage').innerText = "❌ Error submitting report.";
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('statusMessage').innerText = "❌ Network Error.";
        });
    };
}

// ==========================================
// 3. VIEW REPORTS LOGIC (UPDATED)
// ==========================================
function loadReports() {
    console.log("🔄 Loading reports...");
    const listDiv = document.getElementById('reportsList');
    listDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span>Loading...</span></div>';

    fetch(VIEW_URL)
    .then(response => response.json())
    .then(data => {
        console.log("📦 Data received:", data);
        listDiv.innerHTML = ""; 
        
        // --- THE FIX IS HERE ---
        // Look for Capital 'Documents', lowercase 'documents', 'value', or just use the data itself
        const items = data.Documents || data.documents || data.value || data; 

        // Safety check: Ensure 'items' is actually an Array (list)
        if (!Array.isArray(items) || items.length === 0) {
            console.error("❌ Could not find a list of reports in the data:", data);
            listDiv.innerHTML = "<p>No reports found (Data Format Issue).</p>";
            return;
        }

        // Store the correct list into the global variable
        allReports = items;
        console.log(`✅ Successfully loaded ${allReports.length} reports into memory.`);

        // Apply filters and display
        filterReports();
    })
    .catch(error => {
        console.error('❌ Load Error:', error);
        listDiv.innerText = "Failed to load reports.";
    });
}

// ==========================================
// 7. FILTER LOGIC
// ==========================================
function filterReports() {
    const typeFilter = document.getElementById('typeFilter').value;
    const sentimentFilter = document.getElementById('sentimentFilter').value;
    
    console.log(`🚀 Starting Filter: Type='${typeFilter}', Sentiment='${sentimentFilter}'`);

    let filteredReports = allReports.filter(report => {
        // Filter Type
        if (typeFilter !== 'All' && report.issueType !== typeFilter) return false;

        // Filter Sentiment
        if (sentimentFilter !== 'All') {
            const sentimentText = getSentimentText(report);
            
            // X-RAY LOG: This will tell us EXACTLY why it fails or passes
            console.log(`🔍 Checking Report: ${report.issueType}`);
            console.log(`   - Raw Data:`, report.sentiments || report.sentiment);
            console.log(`   - Parsed Text: '${sentimentText}'`);
            console.log(`   - Matching against: '${sentimentFilter}'`);

            const cleanValue = sentimentText.toLowerCase().trim();
            const cleanFilter = sentimentFilter.toLowerCase().trim();
            
            return cleanValue === cleanFilter;
        }
        return true;
    });

    console.log(`✅ Found ${filteredReports.length} matches.`);

    if (map) { map.remove(); map = null; }
    initMap(filteredReports);
    renderReportList(filteredReports);
}

// 2. Updated renderReportList (Fixes badges to check 'sentiments')
function renderReportList(reports) {
    const listDiv = document.getElementById('reportsList');
    listDiv.innerHTML = "";

    if (reports.length === 0) {
        listDiv.innerHTML = "<p>No reports match the selected filters.</p>";
        return;
    }

    reports.forEach(report => {
        const card = document.createElement('div');
        card.className = "card mb-3 shadow-sm";
        card.style = "border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: white;";
        
        // --- AI Tag Logic ---
        let aiDisplay = "";
        if (report.aiCaption) {
            let tagsString = "No tags";
            try {
                if (Array.isArray(report.aiTags)) {
                    tagsString = (typeof report.aiTags[0] === 'object') ? 
                        report.aiTags.map(t => t.name).join(", ") : report.aiTags.join(", ");
                } else if (typeof report.aiTags === 'string') {
                    if (report.aiTags.trim().startsWith("[")) {
                        tagsString = JSON.parse(report.aiTags).map(t => t.name).join(", ");
                    } else {
                        tagsString = report.aiTags;
                    }
                }
            } catch (e) { tagsString = "Tags available."; }

            aiDisplay = `
                <div style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-left: 4px solid #17a2b8; border-radius: 4px;">
                    <small style="color: #17a2b8; font-weight: bold;">🤖 AI Analysis:</small><br>
                    <i style="color: #555;">"${report.aiCaption}"</i><br>
                    <small class="text-muted">Tags: ${tagsString}</small>
                </div>`;
        }

        // USE THE NEW HELPER
        const displaySentiment = getSentimentText(report);
        
        let sentimentBadge = "";
        if (displaySentiment) {
            let badgeColor = "secondary";
            const s = displaySentiment.toLowerCase().trim();
            if (s === "negative") badgeColor = "danger";
            if (s === "positive") badgeColor = "success";
            
            sentimentBadge = `<span class="badge bg-${badgeColor}" style="margin-left: 5px;">${displaySentiment.toUpperCase()}</span>`;
        }

        // Vote Button Logic
        const votes = report.votes || 0;
        const voteButton = `
            <button class="btn btn-sm btn-outline-primary" 
                    onclick="upvoteReport('${report.id}', '${report.issueType}', this)" 
                    style="margin-top: 10px;">
                👍 <span class="vote-count">${votes}</span>
            </button>`;

        card.innerHTML = `
            <div style="display:flex; gap: 15px; align-items: start;">
                <div style="width: 100px; height: 100px; flex-shrink:0;">
                    <img src="${report.imageUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 5px; border: 1px solid #eee;" 
                         onerror="this.src='https://via.placeholder.com/100?text=No+Img'"> 
                </div>
                <div style="flex-grow: 1;">
                    <h5 style="margin: 0 0 5px 0; color: #007bff;">${report.issueType || 'Issue'}</h5>
                    <p style="margin: 0 0 5px 0;">${report.description || 'No description'}</p>
                    <small class="text-muted">📍 ${report.location?.lat || '?'}, ${report.location?.lon || '?'}</small>
                    <br>
                    <span class="badge bg-secondary" style="font-size: 0.8em; margin-top: 5px; display:inline-block;">${report.status || 'New'}</span>
                    ${sentimentBadge}
                    ${aiDisplay}
                    ${voteButton}
                </div>
            </div>`;
        
        listDiv.appendChild(card);
    });
}

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================
function searchAddress() {
    const address = document.getElementById('addressSearch').value;
    if (!address) return alert("Please enter an address");

    // Show loading state
    document.getElementById('statusMessage').innerText = "🔍 Finding address...";

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
            const result = data[0];
            // Automatically fill your existing coordinate boxes
            document.getElementById('latitude').value = result.lat;
            document.getElementById('longitude').value = result.lon;
            document.getElementById('statusMessage').innerText = "📍 Location found and updated!";
            
            // Optional: Move the map to this location
            if (map) {
                map.setView([result.lat, result.lon], 15);
            }
        } else {
            document.getElementById('statusMessage').innerText = "❌ Address not found.";
        }
    })
    .catch(err => console.error("Geocoding error:", err));
}

function getLocation() {
    console.log("Getting location...");
    if (navigator.geolocation) {
        document.getElementById('latitude').value = "Locating...";
        navigator.geolocation.getCurrentPosition(function(position) {
            document.getElementById('latitude').value = position.coords.latitude;
            document.getElementById('longitude').value = position.coords.longitude;
        }, function(error) {
            alert("Error getting location: " + error.message);
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// ==========================================

// 5. MAP FUNCTIONS

// ==========================================

function initMap(reports) {
    map = L.map('mapArea').setView([54.5973, -5.9301], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    reports.forEach(report => {
        if (report.location && report.location.lat && report.location.lon) {
            
            // USE THE NEW HELPER
            const sentimentText = getSentimentText(report);
            const color = getMarkerColor(sentimentText);

            const customIcon = new L.Icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });

            const popupContent = `<b>${report.issueType}</b><br>${report.description}`;
            L.marker([report.location.lat, report.location.lon], {icon: customIcon})
                .addTo(map)
                .bindPopup(popupContent);
        }
    });
}

// ==========================================

// 6. UPVOTE LOGIC

// ==========================================

function upvoteReport(docId, issueType, btnElement) {

    // 1. Optimistic UI: Update the number immediately so it feels fast

    const countSpan = btnElement.querySelector('.vote-count');

    let currentCount = parseInt(countSpan.innerText);

    countSpan.innerText = currentCount + 1;

    btnElement.disabled = true; // Prevent double-clicking



    // 2. Send to Logic App

    fetch(UPVOTE_URL, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

            "id": docId,

            "issueType": issueType

        })

    })

    .then(response => {

        if (!response.ok) {

            // If it fails, revert the number

            countSpan.innerText = currentCount;

            alert("Vote failed to save.");

            btnElement.disabled = false;

        } else {

            console.log("✅ Vote saved!");

        }

    })

    .catch(error => {

        console.error("❌ Vote Error:", error);

        countSpan.innerText = currentCount;

        btnElement.disabled = false;

    });

}