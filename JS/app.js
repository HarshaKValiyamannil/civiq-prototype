// ==========================================
// CIVIQ SMART CITY - MAIN LOGIC
// ==========================================

let map; // Global variable for the map
var allReports = []; // 'var' makes this accessible to the console for debugging!

// ==========================================
// CONFIGURATION: YOUR LOGIC APP URLS
// ==========================================
const SUBMIT_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/efe13b1eabd84a6ca949d9b687ba91d1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5T8mNlaNJshHKK7v91oBo7XEE5nYeZdnnHWgkTFV8tU"; 
const UPVOTE_URL = "https://prod-53.uksouth.logic.azure.com:443/workflows/cebfee1bfef44cce9895fb17933e863e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F8JlsLHiYQMC4qocqIH95cr-b8JhPSWy_EVvZOOhir8";
const VIEW_URL = "https://prod-14.uksouth.logic.azure.com:443/workflows/1f435b6dbd6e454192fc835d9c38ec93/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=Xq_1QkvdDjxsSzJVFqUBJWyaEeh-qN_DpbfRwaO03Vw"; 


// ==========================================
// 1. HELPER FUNCTIONS (The "Brains")
// ==========================================

// Helper: Render skeleton loader while data loads
function renderSkeletonLoader() {
    const skeletonCards = [];
    for (let i = 0; i < 3; i++) {
        skeletonCards.push(`
            <div class="card mb-3 shadow-sm">
                <div class="card-body" style="padding: 10px; background: white; border: 1px solid #ddd;">
                    <div class="d-flex gap-3">
                        <div class="bg-light" style="width:80px; height:80px; border-radius:4px;"></div>
                        <div style="flex: 1;">
                            <h5 class="mb-1 bg-light placeholder-glow" style="height: 20px; border-radius: 4px;"><span class="placeholder col-6"></span></h5>
                            <p class="mb-1 small bg-light placeholder-glow" style="height: 15px; border-radius: 4px;"><span class="placeholder col-8"></span></p>
                            <p class="mb-1 small bg-light placeholder-glow" style="height: 15px; width: 60%; border-radius: 4px;"><span class="placeholder col-4"></span></p>
                            <div class="mt-2">
                                <span class="btn btn-sm btn-outline-secondary placeholder" style="width: 60px; height: 25px;"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }
    return skeletonCards.join('');
}

// Helper: Determine marker color
function getMarkerColor(sentiment) {
    const s = (sentiment || "").toString().toLowerCase().trim();
    if (s === 'negative') return 'red';
    if (s === 'positive') return 'green';
    return 'blue';
}

// HELPER: Smartly extract sentiment from ANY format
function getSentimentText(report) {
    // 1. Check ALL possible casing variations
    let raw = report.sentiments || report.sentiment || report.Sentiments || report.Sentiment;
    
    if (!raw) return "neutral";

    // 2. If it's a string that looks like JSON, parse it!
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            console.warn("Failed to parse sentiment JSON:", e);
        }
    }

    // 3. Extract value from Azure AI structures (handling nesting)
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
// 2. INITIALIZATION
// ==========================================
$(document).ready(function () {
    console.log("🚀 CiviQ App Loaded!"); 
    $("#submitBtn").click(submitNewAsset);
    loadReports();
});

// ==========================================
// 3. SUBMIT REPORT
// ==========================================
function submitNewAsset() {
    console.log("Submit button clicked!"); 

    const issueType = document.getElementById('issueType').value;
    const description = document.getElementById('description').value;
    const lat = document.getElementById('latitude').value;
    const long = document.getElementById('longitude').value;
    const fileInput = document.getElementById('imageFile');

    if (!lat || !long) {
        Swal.fire({
            icon: 'error',
            title: 'Location Required',
            text: 'Please provide a location or click "Get My Location" before submitting.',
            confirmButtonColor: '#1abc9c'
        });
        return;
    }
    if(fileInput.files.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Photo Required',
            text: 'Please select a photo before submitting!',
            confirmButtonColor: '#1abc9c'
        });
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
                Swal.fire({
                    icon: 'success',
                    title: 'Report Submitted!',
                    text: 'Your report has been successfully submitted.',
                    confirmButtonColor: '#1abc9c'
                }).then(() => {
                    setTimeout(loadReports, 2000); 
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Submission Error',
                    text: 'There was an error submitting your report.',
                    confirmButtonColor: '#1abc9c'
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Network Error',
                text: 'Please check your connection and try again.',
                confirmButtonColor: '#1abc9c'
            });
        });
    };
}

// ==========================================
// 3. VIEW REPORTS LOGIC (Robust Version)
// ==========================================
function loadReports() {
    console.log("🔄 Loading reports...");
    const listDiv = document.getElementById('reportsList');
    
    // Show skeleton loader immediately
    listDiv.innerHTML = renderSkeletonLoader();

    fetch(VIEW_URL)
    .then(response => response.json())
    .then(data => {
        console.log("📦 Data received:", data);
        listDiv.innerHTML = ""; 
        
        // CHECK ALL CASINGS: Capital 'Documents', lowercase 'documents', 'value', or root array
        const items = data.Documents || data.documents || data.value || data; 

        // CRITICAL SAFETY CHECK: Ensure we actually have a LIST (Array)
        if (!Array.isArray(items)) {
            console.error("❌ Data format error. Expected a list but got:", items);
            listDiv.innerHTML = "<p>Error: Could not read reports list.</p>";
            return;
        }

        if (items.length === 0) {
            listDiv.innerHTML = "<p>No reports found.</p>";
            return;
        }

        // Store to global variable
        allReports = items;
        console.log(`✅ Loaded ${allReports.length} reports.`);

        // Apply filters
        filterReports();
    })
    .catch(error => {
        console.error('❌ Load Error:', error);
        listDiv.innerText = "Failed to load reports.";
    });
}

// ==========================================
// 5. FILTER REPORTS (The Fix for "Urgent")
// ==========================================
function filterReports() {
    const typeFilter = document.getElementById('typeFilter').value;
    const sentimentFilter = document.getElementById('sentimentFilter').value;
    
    console.log(`🚀 Filtering: Type=${typeFilter}, Sentiment=${sentimentFilter}`);

    let filteredReports = allReports.filter(report => {
        // Filter Type
        if (typeFilter !== 'All' && report.issueType !== typeFilter) return false;

        // Filter Sentiment
        if (sentimentFilter !== 'All') {
            const sentimentText = getSentimentText(report); // Use helper
            const cleanValue = sentimentText.toLowerCase().trim();
            const cleanFilter = sentimentFilter.toLowerCase().trim();
            
            // Debug log to confirm it works
            // console.log(`Comparing: '${cleanValue}' vs '${cleanFilter}'`);
            
            return cleanValue === cleanFilter;
        }
        return true;
    });

    if (map) { map.remove(); map = null; }
    initMap(filteredReports);
    renderReportList(filteredReports);
}

// ==========================================
// 6. RENDER LIST (The Fix for Badges)
// ==========================================
function renderReportList(reports) {
    const listDiv = document.getElementById('reportsList');
    listDiv.innerHTML = "";

    if (reports.length === 0) {
        listDiv.innerHTML = "<p>No reports match filters.</p>";
        return;
    }

    reports.forEach(report => {
        // AI Tag Logic
        let aiDisplay = "";
        if (report.aiCaption) {
            aiDisplay = `<div style="margin-top:10px; font-size:0.9em; color:#555;">🤖 ${report.aiCaption}</div>`;
        }

        // Sentiment Badge Logic (Using Helper)
        const displaySentiment = getSentimentText(report);
        let sentimentBadge = "";
        
        if (displaySentiment) {
            let badgeColor = "secondary";
            const s = displaySentiment.toLowerCase().trim();
            if (s === "negative") badgeColor = "danger";
            if (s === "positive") badgeColor = "success";
            sentimentBadge = `<span class="badge bg-${badgeColor}" style="margin-left: 5px;">${displaySentiment.toUpperCase()}</span>`;
        }

        const card = document.createElement('div');
        card.className = "card mb-3 shadow-sm";
        card.style = "padding: 10px; background: white; border: 1px solid #ddd;";
        card.innerHTML = `
            <div class="d-flex gap-3">
                <img src="${report.imageUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:4px;" onerror="this.src='https://via.placeholder.com/80'">
                <div>
                    <h5 class="mb-1 text-primary">${report.issueType}</h5>
                    <p class="mb-1 small">${report.description}</p>
                    ${sentimentBadge}
                    ${aiDisplay}
                    <button class="btn btn-sm btn-outline-primary mt-2" onclick="upvoteReport('${report.id}', '${report.issueType}', this)">👍 ${report.votes || 0}</button>
                </div>
            </div>`;
        
        listDiv.appendChild(card);
    });
}

// ==========================================
// 7. MAP LOGIC (The Fix for Red Pins)
// ==========================================
function initMap(reports) {
    map = L.map('mapArea').setView([54.5973, -5.9301], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

    reports.forEach(report => {
        if (report.location && report.location.lat) {
            const sentimentText = getSentimentText(report);
            const color = getMarkerColor(sentimentText);
            
            const customIcon = new L.Icon({
                iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
            });

            L.marker([report.location.lat, report.location.lon], {icon: customIcon})
                .addTo(map)
                .bindPopup(`<b>${report.issueType}</b><br>${report.description}`);
        }
    });
}

// ==========================================
// 8. UTILITIES (Search & Upvote)
// ==========================================
function searchAddress() {
    const address = document.getElementById('addressSearch').value;
    if (!address) {
        Swal.fire({
            icon: 'error',
            title: 'Address Required',
            text: 'Please enter an address to search.',
            confirmButtonColor: '#1abc9c'
        });
        return;
    }
    document.getElementById('statusMessage').innerText = "🔍 Finding...";

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
    .then(r => r.json())
    .then(data => {
        if (data.length > 0) {
            document.getElementById('latitude').value = data[0].lat;
            document.getElementById('longitude').value = data[0].lon;
            document.getElementById('statusMessage').innerText = "📍 Found!";
            if (map) map.setView([data[0].lat, data[0].lon], 15);
        } else {
            document.getElementById('statusMessage').innerText = "❌ Not found.";
        }
    });
}

function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(p => {
            document.getElementById('latitude').value = p.coords.latitude;
            document.getElementById('longitude').value = p.coords.longitude;
        });
    } else { 
        Swal.fire({
            icon: 'error',
            title: 'Geolocation Not Supported',
            text: 'Your browser does not support location services.',
            confirmButtonColor: '#1abc9c'
        });
    }
}

function upvoteReport(docId, issueType, btn) {
    const countSpan = btn; 
    btn.disabled = true;
    fetch(UPVOTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "id": docId, "issueType": issueType })
    })
    .then(r => r.json())
    .then(data => {
        if (data.newVoteCount) {
            btn.textContent = `👍 ${data.newVoteCount}`;
        }
    })
    .catch(err => {
        console.error("Upvote error:", err);
        btn.disabled = false;
    });
}
