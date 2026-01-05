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

// Helper: Render enhanced skeleton loader
function renderSkeletonLoader() {
    const skeletonCards = [];
    for (let i = 0; i < 3; i++) {
        skeletonCards.push(`
            <div class="report-card mb-3">
                <div class="d-flex gap-3 p-3">
                    <div class="bg-light placeholder-glow" style="width:80px; height:80px; border-radius:8px;"></div>
                    <div class="flex-grow-1">
                        <h5 class="mb-2">
                            <span class="bg-light placeholder-glow" style="width: 120px; height: 22px; border-radius: 4px; display: inline-block;"></span>
                        </h5>
                        <p class="mb-3">
                            <span class="bg-light placeholder-glow" style="width: 100%; height: 16px; border-radius: 3px; display: inline-block; margin-bottom: 8px;"></span>
                            <span class="bg-light placeholder-glow" style="width: 70%; height: 16px; border-radius: 3px; display: inline-block;"></span>
                        </p>
                        <div class="d-flex align-items-center gap-2">
                            <span class="bg-light placeholder-glow" style="width: 80px; height: 30px; border-radius: 15px;"></span>
                            <span class="bg-light placeholder-glow" style="width: 25px; height: 20px; border-radius: 10px;"></span>
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
    const email = document.getElementById('userEmail').value; // Get the email
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
            "fileName": file.name,
            "userEmail": email, // <--- ADD THIS
            "status": "Open"    // <--- FORCE STATUS TO OPEN
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
// 6. RENDER LIST (With Admin Powers)
// ==========================================
function renderReportList(reports) {
    const listDiv = document.getElementById('reportsList');
    listDiv.innerHTML = "";

    // 1. Check if the current user is the Admin
    const currentUser = localStorage.getItem("civiq_user");
    const isAdmin = (currentUser && currentUser.toLowerCase() === "admin");

    if (reports.length === 0) {
        listDiv.innerHTML = "<p>No reports match filters.</p>";
        return;
    }

    reports.forEach(report => {
        // AI Tag Logic
        let aiDisplay = report.aiCaption ? `<div class="ai-insight-box">
                    <div class="ai-insight-title">
                        <i class="fas fa-search"></i>
                        <span>AI Insight</span>
                    </div>
                    <div class="ai-insight-content">"${report.aiCaption}"</div>
                </div>` : "";
        
        // Status Badge with consistent styling
        const reportStatus = report.status || 'Open';
        const statusClass = reportStatus === 'Resolved' ? 'status-resolved' : 'status-open';
        let statusBadge = `<span class="status-badge ${statusClass}">${reportStatus}</span>`;
        
        // Urgent Indicator (Only for negative sentiment)
        const displaySentiment = getSentimentText(report);
        let sentimentIndicator = "";
        
        if (displaySentiment.toLowerCase().trim() === "negative") {
            sentimentIndicator = `<span class="badge-urgent ms-2">urgent</span>`;
        }

        // Support/Upvote Button
        const voteButton = `
            <button class="btn btn-outline-primary btn-sm mt-2 d-flex align-items-center gap-2" 
                    onclick="upvoteReport('${report.id}', '${report.issueType}', this)">
                <i class="fas fa-arrow-up"></i>
                <span>Support</span>
                <span class="badge bg-primary text-white rounded-pill">${report.votes || 0}</span>
            </button>`;

        // 2. ADMIN ONLY BUTTON
        let adminControls = "";
        
        // If user is Admin AND report is not yet resolved
        if (isAdmin && report.status !== "Resolved") {
            adminControls = `
                <button class="btn btn-success btn-sm w-100 mt-2" 
                    onclick="resolveIssue('${report.id}')">
                    <i class="fas fa-check-circle"></i> Mark as Resolved
                </button>`;
        } 
        // If report is already resolved, show a label instead
        else if (report.status === "Resolved") {
            adminControls = `
                <div class="mt-2 text-center text-success border border-success rounded p-1" style="font-size: 0.8rem; background: #d4edda;">
                    <i class="fas fa-check"></i> Resolved
                </div>`;
        }

        const card = document.createElement('div');
        card.className = "card report-card mb-3";
        
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex gap-3">
                    <img src="${report.imageUrl}" class="report-image" onerror="this.src='https://via.placeholder.com/100'">
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="report-title mb-0">
                                ${report.issueType}
                                ${sentimentIndicator}
                            </h5>
                            <small class="text-muted" style="white-space: nowrap;">${report.timestamp ? new Date(report.timestamp).toLocaleDateString() : ''}</small>
                        </div>
                        <p class="report-description mb-2">${report.description}</p>
                        <div class="mb-2">
                            ${statusBadge}
                        </div>
                        ${aiDisplay}
                        <div class="d-flex gap-2 align-items-center">
                            ${voteButton}
                        </div>
                        ${adminControls}
                    </div>
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
            
            // Only use red markers for negative sentiment, blue for all others
            const color = sentimentText.toLowerCase().trim() === 'negative' ? 'red' : 'blue';
            
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

// ==========================================
// 9. AUTHENTICATION (SIMULATED)
// ==========================================

// Check if user is logged in when page loads
function checkAuth() {
    const user = localStorage.getItem("civiq_user");
    if (user) {
        showLoggedInState(user);
    } else {
        showLoggedOutState();
    }
}

// Run this on startup
$(document).ready(function() {
    checkAuth();
});

// Handle the Login Form Submit
function handleLogin(event) {
    event.preventDefault(); // Stop page reload
    
    // Get the email they typed (or the default one)
    const email = document.getElementById('loginEmail').value;
    const name = email.split('@')[0]; // Use the part before '@' as the name
    
    // Save to browser memory
    localStorage.setItem("civiq_user", name);
    
    // Close modal
    const modalEl = document.getElementById('loginModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    // Update UI
    Swal.fire({
        icon: 'success',
        title: 'Welcome back!',
        text: 'You are now signed in as ' + name,
        timer: 1500,
        showConfirmButton: false
    });
    
    showLoggedInState(name);
}

function logoutUser() {
    localStorage.removeItem("civiq_user");
    showLoggedOutState();
    Swal.fire({
        icon: 'info',
        title: 'Signed Out',
        timer: 1000,
        showConfirmButton: false
    });
}

function showLoggedInState(username) {
    document.getElementById('loginButtonSection').style.display = 'none';
    document.getElementById('userProfileSection').style.display = 'block';
    
    // Set Name and Initials
    document.getElementById('userNameDisplay').innerText = username;
    document.getElementById('userInitials').innerText = username.substring(0,2).toUpperCase();
}

function showLoggedOutState() {
    document.getElementById('loginButtonSection').style.display = 'block';
    document.getElementById('userProfileSection').style.display = 'none';
}

// ==========================================
// 7. RESOLVE ISSUE FUNCTION (Connects to Logic App)
// ==========================================
const RESOLVE_LOGIC_APP_URL = "https://prod-48.uksouth.logic.azure.com:443/workflows/0c79cb04ff5041268730879e18d0ac5b/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=XBIxgmIdZ5mNawFYR0flWgOayY1UP6BvJGfMBXzpXZ0";

function resolveIssue(reportId) {
    // 1. Find the report in memory
    const report = allReports.find(r => r.id === reportId);
    if (!report) return;

    // 2. Confirm with the Admin
    Swal.fire({
        title: 'Mark as Resolved?',
        text: "This will update the database and email the citizen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        confirmButtonText: 'Yes, Resolve it!'
    }).then((result) => {
        if (result.isConfirmed) {
            
            // 3. Show Loading
            Swal.fire({ title: 'Processing...', didOpen: () => Swal.showLoading() });

            // 3. Create a COPY of the report
            const updatedReport = { ...report, status: "Resolved" };

            // --- 🚨 THE FIX: REMOVE AZURE SYSTEM FIELDS ---
            delete updatedReport._rid;
            delete updatedReport._self;
            delete updatedReport._etag;
            delete updatedReport._attachments;
            delete updatedReport._ts;
            // ----------------------------------------------

            // 4. Send to Cloud
            fetch(RESOLVE_LOGIC_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedReport)
            })
            .then(response => {
                if(response.ok) {
                    Swal.fire("Resolved!", "Citizen notified via Outlook.", "success");
                    loadReports(); 
                } else {
                    throw new Error("Logic App failed");
                }
            })
            .catch(err => {
                console.error(err);
                Swal.fire("Error", "Could not connect to cloud.", "error");
            });
        }
    });
}
