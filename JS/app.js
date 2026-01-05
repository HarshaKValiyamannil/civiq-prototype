let map; // Global variable for the map
let allReports = []; // Store all reports for filtering

// Add this helper function at the top of your script
function getMarkerColor(sentiment) {
    const s = (sentiment || "").toString().toLowerCase().trim();
    if (s === 'negative') return 'red';
    if (s === 'positive') return 'green';
    return 'blue';
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
// 3. VIEW REPORTS LOGIC
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
        
        const items = data.Documents || data; 

        if (!items || items.length === 0) {
            listDiv.innerHTML = "<p>No reports found.</p>";
            return;
        }

        // Store all reports for filtering
        allReports = items;

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
// 1. Updated filterReports (Uses 'sentiments')
function filterReports() {
    const typeFilter = document.getElementById('typeFilter').value;
    const sentimentFilter = document.getElementById('sentimentFilter').value;
    
    // Debug to prove the new code is running
    console.log("🚀 Running NEW filter logic...");

    let filteredReports = allReports.filter(report => {
        // --- Filter by Type ---
        if (typeFilter !== 'All' && report.issueType !== typeFilter) {
            return false;
        }

        // --- Filter by Sentiment ---
        if (sentimentFilter !== 'All') {
            // FIX: Use 'sentiments' (plural) as seen in your console
            const rawSentiment = report.sentiments || report.sentiment; 

            if (!rawSentiment) return false; // If missing, hide it

            // UNWRAP: Handle if it's an object OR a string
            let sentimentText = "";
            if (typeof rawSentiment === 'object') {
                // Try common Azure fields
                sentimentText = rawSentiment.sentiment || rawSentiment.label || JSON.stringify(rawSentiment);
            } else {
                sentimentText = rawSentiment.toString();
            }

            // Clean up strings for comparison
            const cleanValue = sentimentText.toLowerCase().trim();
            const cleanFilter = sentimentFilter.toLowerCase().trim();
            
            // Log matches to help debugging
            if (cleanValue === cleanFilter) {
                console.log(`✅ Match found: ${cleanValue}`);
            }

            return cleanValue === cleanFilter;
        }

        return true;
    });

    // Refresh Map
    if (map) {
        map.remove();
        map = null;
    }
    initMap(filteredReports);
}

// Helper function to render report list
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
        
        // --- SMART TAG CLEANER ---
        let aiDisplay = "";
        if (report.aiCaption) {
            let tagsString = "No tags";
            
            try {
                // Case 1: It's already a clean list (Array)
                if (Array.isArray(report.aiTags)) {
                    // Check if it's a list of objects [{name:"cat"}] or text ["cat"]
                    if (typeof report.aiTags[0] === 'object') {
                        tagsString = report.aiTags.map(t => t.name).join(", ");
                    } else {
                        tagsString = report.aiTags.join(", ");
                    }
                } 
                // Case 2: It is a String (Text)
                else if (typeof report.aiTags === 'string') {
                    // Check if it looks like JSON code (starts with [)
                    if (report.aiTags.trim().startsWith("[")) {
                        const parsed = JSON.parse(report.aiTags);
                        tagsString = parsed.map(t => t.name).join(", ");
                    } else {
                        tagsString = report.aiTags; // It's just normal text
                    }
                }
            } catch (e) {
                console.error("Error parsing tags:", e);
                tagsString = "Tags available but could not format.";
            }

            aiDisplay = `
                <div style="margin-top: 10px; padding: 10px; background-color: #f8f9fa; border-left: 4px solid #17a2b8; border-radius: 4px;">
                    <small style="color: #17a2b8; font-weight: bold;">🤖 Azure AI Analysis:</small><br>
                    <i style="color: #555;">"${report.aiCaption}"</i><br>
                    <small class="text-muted">Tags: ${tagsString}</small>
                </div>
            `;
        }
        // --------------------------------

        // Calculate current votes (default to 0 if missing)
        const votes = report.votes || 0;

        // Create the button HTML
        const voteButton = `
            <button class="btn btn-sm btn-outline-primary" 
                    onclick="upvoteReport('${report.id}', '${report.issueType}', this)" 
                    style="margin-top: 10px;">
                👍 <span class="vote-count">${votes}</span>
            </button>
        `;

        // --- NEW: Sentiment Badge Logic ---
        let sentimentBadge = "";
        let displaySentiment = "";
        if (typeof report.sentiment === 'string') {
            displaySentiment = report.sentiment;
        } else if (report.sentiment && report.sentiment.sentiment) {
            displaySentiment = report.sentiment.sentiment; // Handle Azure AI Object
        }

        if (displaySentiment) {
            let badgeColor = "secondary"; // Default (Gray)
            if (displaySentiment === "negative") badgeColor = "danger"; // Red for Urgent
            if (displaySentiment === "positive") badgeColor = "success"; // Green for Good
            
            // Create the badge HTML
            sentimentBadge = `<span class="badge bg-${badgeColor}" style="margin-left: 5px;">${displaySentiment.toUpperCase()}</span>`;
        }
        // ----------------------------------

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
            </div>
        `;
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

// 2. Updated initMap (Ensures colors work with 'sentiments')
function initMap(reports) {
    map = L.map('mapArea').setView([54.5973, -5.9301], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap'
    }).addTo(map);

    reports.forEach(report => {
        if (report.location && report.location.lat && report.location.lon) {
            
            // FIX: Pass the plural 'sentiments' to get the right color
            const rawSentiment = report.sentiments || report.sentiment;
            
            // Quick logic to extract string for color check
            let sentimentText = "";
            if (typeof rawSentiment === 'object') {
                sentimentText = rawSentiment.sentiment || "neutral";
            } else {
                sentimentText = rawSentiment || "neutral";
            }

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