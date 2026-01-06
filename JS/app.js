// ==========================================
// CIVIQ SMART CITY - MAIN LOGIC
// ==========================================

let map; // Global variable for the map
var allReports = []; // 'var' makes this accessible to the console for debugging!

// Chart variables
let typeChart = null;
let statusChart = null;

// Pagination variables
let currentPage = 1;
const itemsPerPage = 6; // How many cards per page?
let currentFilteredData = []; // Store filtered data here

// ==========================================
// CONFIGURATION: YOUR LOGIC APP URLS
// ==========================================
const SUBMIT_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/efe13b1eabd84a6ca949d9b687ba91d1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5T8mNlaNJshHKK7v91oBo7XEE5nYeZdnnHWgkTFV8tU"; 
const UPVOTE_URL = "https://prod-53.uksouth.logic.azure.com:443/workflows/cebfee1bfef44cce9895fb17933e863e/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F8JlsLHiYQMC4qocqIH95cr-b8JhPSWy_EVvZOOhir8";
const VIEW_URL = "https://prod-14.uksouth.logic.azure.com:443/workflows/1f435b6dbd6e454192fc835d9c38ec93/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=Xq_1QkvdDjxsSzJVFqUBJWyaEeh-qN_DpbfRwaO03Vw"; 
const DELETE_LOGIC_APP_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/833b2c4259df4fcf8139c38c6eec5920/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F-C235Mq2bqlW6M7inlZ7EjOu4gcxVzBmCHfBfvXhIc";
const ANALYTICS_LOGIC_APP_URL = "https://prod-04.uksouth.logic.azure.com:443/workflows/4a85ef87f9624df9ab888606c5dfbfeb/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=8huoMVlPrNb01OmLxFggJRtJkTRNUA06PPmS-im_mWU";


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
    
    // 1. SPAM CHECK: Rate Limiting (60 seconds)
    const lastSubmitTime = localStorage.getItem("civiq_last_submit");
    const now = new Date().getTime();
    const cooldown = 60000; // 60,000ms = 1 Minute

    if (lastSubmitTime && (now - lastSubmitTime < cooldown)) {
        const secondsLeft = Math.ceil((cooldown - (now - lastSubmitTime)) / 1000);
        Swal.fire({
            icon: 'info',
            title: 'Please Wait',
            text: `You can submit another report in ${secondsLeft} seconds.`,
            confirmButtonColor: '#3498db'
        });
        return; // STOP HERE. Do not send to cloud.
    }

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

    document.getElementById('statusMessage').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

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
        
        // AND... Don't forget to SAVE the time when they successfully submit!
        // Add this line right before the fetch() call:
        localStorage.setItem("civiq_last_submit", now);

        fetch(SUBMIT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        })
        .then(async response => {
            // 1. Try to read the error message from the cloud
            let errorMsg = "Something went wrong.";
            try {
                const data = await response.json();
                if (data.error) errorMsg = data.error;
            } catch (e) {
                console.log("No JSON error returned");
            }

            // 2. Handle the different Status Codes
            if (response.ok) {
                // SUCCESS (200)
                document.getElementById('statusMessage').innerHTML = '<i class="fas fa-check text-success"></i> Submitted!';
                Swal.fire({
                    icon: 'success',
                    title: 'Report Submitted!',
                    text: 'Thank you for your contribution.',
                    timer: 2000
                }).then(() => {
                    loadReports(); 
                    document.getElementById('description').value = "";
                    document.getElementById('imageFile').value = "";
                });

            } else if (response.status === 409) {
                // DUPLICATE (409)
                document.getElementById('statusMessage').innerHTML = '<i class="fas fa-exclamation-circle text-warning"></i> Duplicate!';
                Swal.fire({
                    icon: 'warning',
                    title: 'Already Reported',
                    text: errorMsg, // Uses the message from the cloud if available
                    confirmButtonColor: '#f39c12'
                });

            } else if (response.status === 422) { 
                // --- AI REJECTION (422) ---
                document.getElementById('statusMessage').innerHTML = '<i class="fas fa-times-circle text-danger"></i> Rejected';
                Swal.fire({
                    icon: 'error',
                    title: 'Image Rejected',
                    text: errorMsg, // Shows: "Our AI could not detect..."
                    confirmButtonColor: '#d33'
                });

            } else {
                // GENERIC ERROR
                document.getElementById('statusMessage').innerText = "Error!";
                Swal.fire({
                    icon: 'error',
                    title: 'Submission Failed',
                    text: 'Something went wrong connecting to the cloud.',
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            Swal.fire('Network Error', 'Please check your internet connection.', 'error');
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
    currentPage = 1; // Reset to page 1 when filter changes
    
    const typeFilter = document.getElementById('typeFilter').value;
    const sentimentFilter = document.getElementById('sentimentFilter').value;
    const statusFilter = document.getElementById('statusFilter').value; // <-- NEW
    
    console.log(`🚀 Filtering: Type=\${typeFilter}, Sentiment=\${sentimentFilter}, Status=\${statusFilter}`);

    let filteredReports = allReports.filter(report => {
        // 1. Filter Type
        if (typeFilter !== 'All' && report.issueType !== typeFilter) return false;

        // 2. Filter Status (NEW)
        // If status is NOT 'All', and report status doesn't match, hide it.
        // (We treat undefined status as 'Open')
        const rStatus = report.status || 'Open'; 
        if (statusFilter !== 'All' && rStatus !== statusFilter) return false;

        // 3. Filter Sentiment
        if (sentimentFilter !== 'All') {
            const sentimentText = getSentimentText(report); // Use helper
            const cleanValue = sentimentText.toLowerCase().trim();
            const cleanFilter = sentimentFilter.toLowerCase().trim();
            
            // Debug log to confirm it works
            // console.log(`Comparing: '\${cleanValue}' vs '\${cleanFilter}'`);
            
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
    // 1. Save the full list of matches so we can paginate them
    currentFilteredData = reports;
    
    // 2. Calculate the slice for the current page
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = reports.slice(startIndex, endIndex);

    const listDiv = document.getElementById('reportsList');
    listDiv.innerHTML = "";

    if (reports.length === 0) {
        listDiv.innerHTML = "<p class='p-3'>No reports match filters.</p>";
        document.getElementById('paginationControls').innerHTML = ""; // Hide buttons
        return;
    }

    // 3. Render only the "Page Items"
    const user = localStorage.getItem("civiq_user");
    const isAdmin = (user && user.toLowerCase() === "admin");

    pageItems.forEach(report => {
        // AI Tag Logic
        let aiDisplay = report.aiCaption ? `<div class="ai-insight-box">
                    <div class="ai-insight-title">
                        <i class="fas fa-search"></i>
                        <span>AI Insight</span>
                    </div>
                    <div class="ai-insight-content">"\${report.aiCaption}"</div>
                </div>` : "";
        
        // Status Badge with consistent styling
        const reportStatus = report.status || 'Open';
        const statusClass = reportStatus === 'Resolved' ? 'status-resolved' : 'status-open';
        let statusBadge = `<span class="status-badge \${statusClass}">\${reportStatus}</span>`;
        
        // Urgent Indicator (Only for negative sentiment)
        const displaySentiment = getSentimentText(report);
        let sentimentIndicator = "";
        
        if (displaySentiment.toLowerCase().trim() === "negative") {
            sentimentIndicator = `<span class="badge-urgent ms-2">urgent</span>`;
        }

        // Support/Upvote Button
        const voteButton = '<div class="d-flex align-items-center gap-2"><span class="badge bg-light text-dark border rounded-pill px-3 py-2" style="font-size: 0.85rem; font-weight: 600;"><i class="fas fa-arrow-up text-primary me-1"></i>' + (report.votes || 0) + ' upvotes</span><button class="btn btn-outline-primary btn-sm" onclick="upvoteReport(\'' + report.id + '\', \'' + report.issueType + '\', this)"><i class="fas fa-thumbs-up"></i> Support</button></div>';

        // 2. ADMIN ONLY BUTTON
        let adminControls = "";
        
        // If user is Admin AND report is not yet resolved
        if (isAdmin && report.status !== "Resolved") {
            adminControls = '<button class="btn btn-success btn-sm w-100 mt-2" onclick="resolveIssue(\'' + report.id + '\')"><i class="fas fa-check-circle"></i> Mark as Resolved</button>';
        } 
        // If report is already resolved, show a label instead
        else if (report.status === "Resolved") {
            adminControls = '<div class="mt-2 text-center text-success border border-success rounded p-1" style="font-size: 0.8rem; background: #d4edda;"><i class="fas fa-check"></i> Resolved</div>';
        }

        const cardCol = document.createElement('div');
        cardCol.className = "col-md-6 col-lg-4 mb-4"; // Creates a 3-column grid
        
        // Build HTML content with proper variable substitution using string concatenation
        cardCol.innerHTML = 
            '<div class="card h-100 shadow-sm" style="cursor: pointer;">' +
            '<img src="' + report.imageUrl + '" class="card-img-top" style="cursor: pointer; height: 200px; object-fit: cover;" onclick="openReportModal(\'' + report.id + '\')" onerror="this.style.display=\'none\'">' +
            '<div class="card-body d-flex flex-column">' +
            '<div class="d-flex justify-content-between">' +
            '<h5 style="cursor: pointer; display: flex; align-items: center;" onclick="openReportModal(\'' + report.id + '\')">' + report.issueType + (displaySentiment.toLowerCase().trim() === "negative" ? ' <span class="badge-urgent ms-2">urgent</span>' : '') + '</h5>' +
            '<small>' + (report.timestamp ? new Date(report.timestamp).toLocaleDateString() : '') + '</small>' +
            '</div>' +
            '<p>' + report.description + '</p>' +
            (report.aiCaption ? '<div class="ai-insight-box mb-2"><div class="ai-insight-title"><i class="fas fa-search"></i><span>AI Insight</span></div><div class="ai-insight-content">"' + report.aiCaption + '"</div></div>' : '') +
            '<div class="mt-auto">' +
            '<div class="d-flex gap-2 align-items-center">' + voteButton + '</div>' +
            adminControls +
            '</div>' +
            '</div>' +
            '</div>';
        listDiv.appendChild(cardCol);
    });

    // 4. Render the Page Buttons (1, 2, 3...)
    renderPaginationControls(reports.length);
}

// ==========================================
// 7. MAP LOGIC (The Ghost Pin Strategy)
// ==========================================
function initMap(reports) {
    map = L.map('mapArea').setView([54.5973, -5.9301], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

    reports.forEach(report => {
        if (report.location && report.location.lat) {
            const sentimentText = getSentimentText(report);
            
            // Ghost Pin Strategy: Color coding based on status and sentiment
            let color = 'blue'; // Default
            
            if (report.status === 'Resolved') {
                color = 'grey'; // ⚪ FIXED: Grey for resolved (ghost pins)
            } else if (sentimentText.toLowerCase().trim() === 'negative') {
                color = 'red';  // 🔴 URGENT: Red for negative/open issues
            } else {
                color = 'blue'; // 🔵 NORMAL: Blue for positive/neutral open issues
            }
            
            // Create marker with appropriate color using standard Leaflet div icons
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="background-color: ' + color + '; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">' + (color === 'red' ? '⚠' : color === 'grey' ? '✓' : '•') + '</div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            });

            L.marker([report.location.lat, report.location.lon], {icon: customIcon})
                .addTo(map)
                .bindPopup('<b>' + report.issueType + '</b><br>Status: ' + (report.status || 'Open') + '<br>' + report.description + '<br><img src="' + report.imageUrl + '" style="max-width:150px;" onerror="this.style.display=\'none\'">');
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

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(address)}`)
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
    btn.disabled = true;
    fetch(UPVOTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "id": docId, "issueType": issueType })
    })
    .then(r => r.json())
    .then(data => {
        if (data.newVoteCount) {
            // Find the vote badge next to this button and update it
            const voteBadge = btn.nextElementSibling;
            if (voteBadge && voteBadge.classList.contains('vote-badge')) {
                voteBadge.innerHTML = `\${data.newVoteCount} <i class="fas fa-arrow-up"></i>`;
            }
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

function openReportModal(reportId) {
    const report = allReports.find(r => r.id === reportId);
    if (!report) return;

    // 1. Populate Modal Data
    document.getElementById('modalImage').src = report.imageUrl;
    document.getElementById('modalType').innerText = report.issueType;
    document.getElementById('modalDesc').innerText = report.description;
    document.getElementById('modalLocation').innerText = `${report.location.lat}, ${report.location.lon}`;
    
    // --- NEW: SETUP VIEW ON MAP BUTTON ---
    const mapBtn = document.getElementById('btnViewOnMap');
    mapBtn.onclick = function() {
        jumpToMap(report.location.lat, report.location.lon);
    };
    // -------------------------------------
    
    const statusSpan = document.getElementById('modalStatus');
    statusSpan.innerText = report.status || 'Open';
    statusSpan.className = report.status === 'Resolved' ? 'badge bg-success' : 'badge bg-primary';

    // 2. Check Admin Rights
    const user = localStorage.getItem("civiq_user");
    const isAdmin = (user && user.toLowerCase() === "admin");
    const adminSection = document.getElementById('modalAdminSection');

    if (isAdmin) {
        console.log("Admin rights confirmed. Attaching listeners.");
        adminSection.style.display = 'block';
        
        // Setup Resolve Button
        document.getElementById('btnModalResolve').onclick = function() {
            resolveIssue(report.id); // Call your existing function
            bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
        };

        // Setup Delete Button
        document.getElementById('btnModalDelete').onclick = function() {
            console.log("🔴 DELETE CLICKED for:", report.id, report.issueType);
            deleteReport(report.id, report.issueType);
        };
    } else {
        adminSection.style.display = 'none';
    }

    // 3. Show Modal
    new bootstrap.Modal(document.getElementById('reportModal')).show();
}

// Updated to accept 'issueType'
function deleteReport(reportId, issueType) {
    console.log("Attempting delete:", reportId, issueType); // Debugging line

    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Deleting...', didOpen: () => Swal.showLoading() });

            fetch(DELETE_LOGIC_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    "id": reportId, 
                    "issueType": issueType // <--- CRITICAL: Sending the partition key
                })
            })
            .then(response => {
                if (response.ok) {
                    Swal.fire("Deleted!", "Report has been removed.", "success");
                    // Close modal
                    const modalEl = document.getElementById('reportModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();
                    // Refresh grid
                    loadReports(); 
                } else {
                    throw new Error("Cloud rejected delete request");
                }
            })
            .catch(err => {
                console.error(err);
                Swal.fire("Error", "Could not delete. Check console for details.", "error");
            });
        }
    });
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

// ==========================================
// 10. PAGINATION LOGIC (Add to app.js)
// ==========================================

function renderPaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationDiv = document.getElementById('paginationControls');
    paginationDiv.innerHTML = "";

    if (totalPages <= 1) return; // No buttons needed if only 1 page

    // Previous Button
    paginationDiv.innerHTML += '<li class="page-item ' + (currentPage === 1 ? 'disabled' : '') + '"><button class="page-link" onclick="changePage(' + (currentPage - 1) + ')">Previous</button></li>';

    // Numbered Buttons
    for (let i = 1; i <= totalPages; i++) {
        paginationDiv.innerHTML += '<li class="page-item ' + (i === currentPage ? 'active' : '') + '"><button class="page-link" onclick="changePage(' + i + ')">' + i + '</button></li>';
    }

    // Next Button
    paginationDiv.innerHTML += '<li class="page-item ' + (currentPage === totalPages ? 'disabled' : '') + '"><button class="page-link" onclick="changePage(' + (currentPage + 1) + ')">Next</button></li>';
}

function changePage(newPage) {
    if (newPage < 1 || newPage > Math.ceil(currentFilteredData.length / itemsPerPage)) {
        return; // Don't allow invalid page numbers
    }
    
    currentPage = newPage;
    // Re-render using the GLOBAL filtered data (not fetching again)
    // We call renderReportList but pass the SAME data back to it
    // Wait... calling renderReportList again would reset currentFilteredData.
    // Better way: Split the Logic. But for now, just recursively calling it works if we trust the global.
    
    // Actually, simpler fix: Just re-run render with the stored data
    // But we need to update the startIndex logic. 
    // Let's rely on the fact that 'currentFilteredData' is already stored?
    // No, renderReportList accepts an argument.
    
    renderReportList(currentFilteredData); 
    
    // Scroll to top of list so user sees new items
    document.getElementById('reportsList').scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// 11. MAP NAVIGATION HELPER
// ==========================================
function jumpToMap(lat, lon) {
    // 1. Close the Modal
    const modalEl = document.getElementById('reportModal');
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    // 2. Scroll the page up to the map (important for mobile/small screens)
    document.getElementById('mapArea').scrollIntoView({ behavior: 'smooth' });

    // 3. "Fly" the map to the location
    if (map) {
        // flyTo gives a smooth zooming animation compared to setView
        map.flyTo([lat, lon], 16, {
            animate: true,
            duration: 1.5 // Animation speed in seconds
        });
    }
}

// ==========================================
// 8. ANALYTICS DISPLAY
// ==========================================
function showAnalytics() {
    // 1. Open Modal & Show Loading
    new bootstrap.Modal(document.getElementById('analyticsModal')).show();
    
    // Optional: Show loading state on canvas? 
    // For now, we just fetch data.

    console.log("📊 Fetching analytics from Cloud...");

    fetch(ANALYTICS_LOGIC_APP_URL)
    .then(response => response.json())
    .then(data => {
        console.log("📊 Analytics Data:", data);

        // ROBUST DATA HANDLING
        // The Logic App returns { types: {...}, status: {...} }
        // We need to extract the array of items from inside those objects
        // Usually Cosmos returns { "Documents": [...] } or { "value": [...] }
        
        const rawTypes = data.types.Documents || data.types.value || data.types; 
        const rawStatus = data.status.Documents || data.status.value || data.status;

        // Process Types Data
        const typeLabels = rawTypes.map(item => item.issueType || "Unknown");
        const typeValues = rawTypes.map(item => item.count || 0);

        // Process Status Data
        const statusLabels = rawStatus.map(item => item.status || "Unknown");
        const statusValues = rawStatus.map(item => item.count || 0);

        // Render
        renderCharts(typeLabels, typeValues, statusLabels, statusValues);
    })
    .catch(err => {
        console.error("Analytics Error:", err);
        Swal.fire("Error", "Could not fetch stats from cloud.", "error");
    });
}

function renderCharts(tLabels, tValues, sLabels, sValues) {
    const ctxType = document.getElementById('chartTypes').getContext('2d');
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');

    // Destroy old charts to prevent glitches
    if (typeChart) typeChart.destroy();
    if (statusChart) statusChart.destroy();

    // Chart 1: Issue Types (Bar)
    typeChart = new Chart(ctxType, {
        type: 'bar',
        data: {
            labels: tLabels,
            datasets: [{
                label: 'Count',
                data: tValues,
                backgroundColor: ['#3498db', '#e67e22', '#9b59b6', '#2ecc71', '#f1c40f'],
                borderWidth: 1
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Chart 2: Status (Doughnut)
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: sLabels,
            datasets: [{
                data: sValues,
                backgroundColor: ['#3498db', '#27ae60', '#95a5a6'] // Open=Blue, Resolved=Green
            }]
        },
        options: { responsive: true }
    });
}

// ==========================================
// 12. CLOUD ANALYTICS
// ==========================================
function showAnalytics() {
    // 1. Open Modal & Show Loading
    new bootstrap.Modal(document.getElementById('analyticsModal')).show();
    
    // Optional: Show loading state on canvas? 
    // For now, we just fetch data.

    console.log("📊 Fetching analytics from Cloud...");

    fetch(ANALYTICS_LOGIC_APP_URL)
    .then(response => response.json())
    .then(data => {
        console.log("📊 Analytics Data:", data);

        // ROBUST DATA HANDLING
        // The Logic App returns { types: {...}, status: {...} }
        // We need to extract the array of items from inside those objects
        // Usually Cosmos returns { "Documents": [...] } or { "value": [...] }
        
        const rawTypes = data.types.Documents || data.types.value || data.types; 
        const rawStatus = data.status.Documents || data.status.value || data.status;

        // Process Types Data
        const typeLabels = rawTypes.map(item => item.issueType || "Unknown");
        const typeValues = rawTypes.map(item => item.count || 0);

        // Process Status Data
        const statusLabels = rawStatus.map(item => item.status || "Unknown");
        const statusValues = rawStatus.map(item => item.count || 0);

        // Render
        renderCharts(typeLabels, typeValues, statusLabels, statusValues);
    })
    .catch(err => {
        console.error("Analytics Error:", err);
        Swal.fire("Error", "Could not fetch stats from cloud.", "error");
    });
}

function renderCharts(tLabels, tValues, sLabels, sValues) {
    const ctxType = document.getElementById('chartTypes').getContext('2d');
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');

    // Destroy old charts to prevent glitches
    if (typeChart) typeChart.destroy();
    if (statusChart) statusChart.destroy();

    // Chart 1: Issue Types (Bar)
    typeChart = new Chart(ctxType, {
        type: 'bar',
        data: {
            labels: tLabels,
            datasets: [{
                label: 'Count',
                data: tValues,
                backgroundColor: ['#3498db', '#e67e22', '#9b59b6', '#2ecc71', '#f1c40f'],
                borderWidth: 1
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // Chart 2: Status (Doughnut)
    statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: sLabels,
            datasets: [{
                data: sValues,
                backgroundColor: ['#3498db', '#27ae60', '#95a5a6'] // Open=Blue, Resolved=Green
            }]
        },
        options: { responsive: true }
    });
}
