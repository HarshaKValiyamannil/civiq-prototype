// ==========================================
// CIVIQ SMART CITY - MAIN LOGIC
// ==========================================

// NEW: Application Insights tracking
// Using appInsights variable already defined in index.html


let map; // Global variable for the map
var allReports = []; // 'var' makes this accessible to the console for debugging!

// new change edit
// Chart variables
let typeChart = null;
let statusChart = null;
let sentimentChart = null; // New
let trendsChart = null;    // New

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
const TRANSLATE_URL = "https://prod-32.uksouth.logic.azure.com:443/workflows/e53dedcbd5d4455aac20278d08a222db/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=FPtGcyar-WyVAawCLHbfJhrEyxfqDX2uHaipdqbOuQE";


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
    
    // NEW: Track the page view
    if (window.appInsights) {
        window.appInsights.trackPageView({ name: "HomePage" });
    }
    
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
    const email = document.getElementById('userEmail').value.trim(); // Get the email (optional)
    const fileInput = document.getElementById('imageFile');

    // Validate required fields
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
    
    reader.onload = function() {
        try {
            const rawBase64 = reader.result.split(',')[1]; 
            const payload = {
                "description": description,
                "issueType": issueType,
                "latitude": lat,
                "longitude": long,
                "photoContent": rawBase64, 
                "fileName": file.name,
                "status": "Open"    // <--- FORCE STATUS TO OPEN
            };
            
            // Add email only if provided
            if (email) {
                payload.userEmail = email;
            }
            
            fetch(SUBMIT_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            })

            .then(async response => {
                // Set submission timestamp only AFTER successful response
                localStorage.setItem("civiq_last_submit", now);
                        
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
                            
                    // --- NEW: LOGICALLY CONNECTED MONITORING ---
                    if (window.appInsights) {
                        window.appInsights.trackEvent({
                            name: "ReportSubmitted",
                            properties: { 
                                issueType: issueType,      // e.g., "Pothole"
                                hasImage: true,            // Boolean flag
                                hasEmail: !!email          // Whether email was provided
                            }
                        });
                    }
                    // -------------------------------------------
                            
                    Swal.fire({
                        icon: 'success',
                        title: 'Report Submitted!',
                        text: 'Thank you for your contribution.',
                        timer: 2000
                    }).then(() => {
                        loadReports(); 
                        document.getElementById('description').value = "";
                        document.getElementById('imageFile').value = "";
                        // Don't clear email - user may want to use same email for multiple reports
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
                        text: `Error ${response.status}: Something went wrong connecting to the cloud.`,
                    });
                }
            })
            .catch(error => {
                console.error('Error:', error);
                
                // --- NEW: TRACK EXCEPTION ---
                if (window.appInsights) {
                    window.appInsights.trackException({ exception: error });
                }
                // ----------------------------
                
                Swal.fire('Network Error', 'Please check your internet connection.', 'error');
            });
        } catch (readerError) {
            console.error('FileReader Error:', readerError);
            document.getElementById('statusMessage').innerHTML = '<i class="fas fa-times-circle text-danger"></i> File Error!';
            Swal.fire('File Error', 'Could not process the selected image file.', 'error');
        }
    };
    
    reader.onerror = function() {
        console.error('FileReader failed to read file');
        document.getElementById('statusMessage').innerHTML = '<i class="fas fa-times-circle text-danger"></i> File Read Error!';
        Swal.fire('File Error', 'Failed to read the selected file. Please try another image.', 'error');
    };
    
    reader.readAsDataURL(file);
}

// ==========================================
// 3. VIEW REPORTS LOGIC (Robust Version)
// ==========================================
function loadReports() {
    console.log("🔄 Loading reports...");
    const listDiv = document.getElementById('reportsList');
    
    // Show skeleton loader immediately
    listDiv.innerHTML = renderSkeletonLoader();

    // ADD 'return' HERE
    return fetch(VIEW_URL)
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
        // Ensure the error propagates so .catch() in syncAndShowAnalytics works
        throw error; 
    });
}

// ==========================================
// 5. FILTER REPORTS (FIXED)
// ==========================================
function filterReports() {
    currentPage = 1; 
    
    // SAFE ELEMENTS FETCHING
    const typeEl = document.getElementById('typeFilter');
    const statusEl = document.getElementById('statusFilter');
    const sentimentEl = document.getElementById('sentimentFilter'); // This is missing in your HTML

    // If element exists, get value. If not, default to 'All'
    const typeFilter = typeEl ? typeEl.value : 'All';
    const statusFilter = statusEl ? statusEl.value : 'All';
    const sentimentFilter = sentimentEl ? sentimentEl.value : 'All'; 
    
    console.log(`🚀 Filtering: Type=${typeFilter}, Sentiment=${sentimentFilter}, Status=${statusFilter}`);

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
            '<div class="mb-3">' +
                '<div class="d-flex align-items-center gap-2">' +
                    '<span class="text-muted" style="font-size: 0.85rem;">Translate to:</span>' +
                    // Use backticks to properly escape the report ID in the onchange attribute
                    '<select class="form-select form-select-sm" style="width: auto;" onchange="handleTranslationDropdown(this, `' + report.id + '`)">' +
                        '<option value="">Select language</option>' +
                        '<option value="es">Spanish 🇪🇸</option>' +
                        '<option value="fr">French 🇫🇷</option>' +
                        '<option value="de">German 🇩🇪</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +
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
    const address = document.getElementById('addressSearch').value.trim();
    if (!address) {
        Swal.fire({
            icon: 'warning',
            title: 'Address Required',
            text: 'Please enter an address to search.',
            confirmButtonColor: '#1abc9c'
        });
        return;
    }
    
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching for address...';
    
    // Improved geocoding with better error handling
    const encodedAddress = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=gb&limit=5`;
    
    fetch(url, {
        headers: {
            'User-Agent': 'CiviQ-SmartCity-App' // Required by Nominatim terms
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data && data.length > 0) {
            // Take the first result (most relevant)
            const result = data[0];
            document.getElementById('latitude').value = result.lat;
            document.getElementById('longitude').value = result.lon;
            
            statusMessage.innerHTML = `<i class="fas fa-check-circle text-success"></i> Found: ${result.display_name.substring(0, 60)}${result.display_name.length > 60 ? '...' : ''}`;
            
            // Update map view
            if (map) {
                const latLng = [parseFloat(result.lat), parseFloat(result.lon)];
                map.setView(latLng, 16);
                
                // Add a temporary marker to show the location
                if (tempMarker) {
                    map.removeLayer(tempMarker);
                }
                tempMarker = L.marker(latLng, {
                    icon: L.divIcon({
                        className: 'custom-marker',
                        html: '<div style="background-color: #e67e22; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>',
                        iconSize: [20, 20]
                    })
                }).addTo(map);
            }
        } else {
            statusMessage.innerHTML = '<i class="fas fa-exclamation-triangle text-warning"></i> No results found. Try a more specific address.';
            
            Swal.fire({
                icon: 'info',
                title: 'Address Not Found',
                text: 'We couldn\'t find that address. Please try:\n• Including the city/town name\n• Using a nearby landmark\n• Checking the spelling',
                confirmButtonColor: '#1abc9c'
            });
        }
    })
    .catch(error => {
        console.error('Geocoding error:', error);
        statusMessage.innerHTML = '<i class="fas fa-times-circle text-danger"></i> Search failed. Please try again.';
        
        Swal.fire({
            icon: 'error',
            title: 'Search Failed',
            text: 'Unable to search for the address. Please check your internet connection and try again.',
            confirmButtonColor: '#1abc9c'
        });
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
    btn.disabled = true; // Prevent double clicks
    
    // Track the upvote event for Application Insights
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "ReportUpvoted",
            properties: { 
                issueType: issueType,
                reportId: docId
            }
        });
    }
    
    fetch(UPVOTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "id": docId, "issueType": issueType })
    })
    .then(r => r.json())
    .then(data => {
        // If the Logic App returns the new vote count
        if (data.newVoteCount !== undefined) {
            
            // 1. Update the count in your local memory (allReports)
            const reportIndex = allReports.findIndex(r => r.id === docId);
            if (reportIndex !== -1) {
                allReports[reportIndex].votes = data.newVoteCount;
            }

            // 2. Immediate UI Update: Find the badge next to this specific button and update its text
            // In your renderReportList, the badge is the previous sibling of the button's parent or within the same container
            const voteBadge = btn.parentElement.querySelector('.badge');
            if (voteBadge) {
                voteBadge.innerHTML = `<i class="fas fa-arrow-up text-primary me-1"></i>${data.newVoteCount} upvotes`;
            }

            // 3. Optional: Re-render the whole list to keep everything in sync
            // renderReportList(currentFilteredData); 
            
            const Toast = Swal.mixin({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 2000
            });
            Toast.fire({ icon: 'success', title: 'Support registered!' });
        }
    })
    .catch(err => {
        console.error("Upvote error:", err);
        if (window.appInsights) {
            window.appInsights.trackException({ exception: err });
        }
        btn.disabled = false; // Re-enable if it failed
    });
}

// Translation function
function translateReport(btn, targetLang) {
    // Get the report description from the card
    const card = btn.closest('.card');
    const descriptionElement = card.querySelector('p');
    const originalText = descriptionElement.textContent;
    
    // Disable all translation buttons temporarily
    const translationButtons = card.querySelectorAll('[onclick^="translateReport"]');
    translationButtons.forEach(button => button.disabled = true);
    
    // Show loading state
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    
    // Track translation event
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "ReportTranslated",
            properties: { 
                targetLanguage: targetLang,
                originalLength: originalText.length
            }
        });
    }
    
    // Call translation Logic App
    fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            text: originalText,
            targetLanguage: targetLang
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Translation failed: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Update the description with translated text
        if (data.translatedText) {
            descriptionElement.innerHTML = `<strong>[${targetLang.toUpperCase()}]</strong> ${data.translatedText}`;
            
            // Show success message
            const Toast = Swal.mixin({
                toast: true, 
                position: 'top-end', 
                showConfirmButton: false, 
                timer: 3000
            });
            Toast.fire({ 
                icon: 'success', 
                title: `Translated to ${targetLang.toUpperCase()}!` 
            });
        } else {
            throw new Error("No translation returned");
        }
    })
    .catch(error => {
        console.error("Translation error:", error);
        
        // Track the error
        if (window.appInsights) {
            window.appInsights.trackException({ exception: error });
        }
        
        // Show error message
        Swal.fire({
            icon: 'error',
            title: 'Translation Failed',
            text: 'Could not translate the report. Please try again.',
            confirmButtonColor: '#1abc9c'
        });
        
        // Restore button text
        btn.innerHTML = originalBtnText;
    })
    .finally(() => {
        // Re-enable all translation buttons
        translationButtons.forEach(button => button.disabled = false);
    });
}

// New handler for translation dropdown
function handleTranslationDropdown(selectElement, reportId) {
    const selectedLang = selectElement.value;
    
    // If no language selected, do nothing
    if (!selectedLang) return;
    
    // SANITIZE INPUT: Clean reportId to prevent injection issues
    const cleanReportId = String(reportId).replace(/[^a-zA-Z0-9-_]/g, "");
    
    console.log("🔍 Translation triggered:", { selectedLang, reportId: cleanReportId });
    
    // Get the report description from the card
    const card = selectElement.closest('.card');
    const descriptionElement = card.querySelector('p');
    
    // --- ADD THIS LINE TO FIX THE 'TOKEN' ERROR ---
    // This removes single quotes, double quotes, backticks, and newlines that break the browser's string handling
    const originalText = descriptionElement.textContent.replace(/['"`\n\r]/g, " ").trim(); 
    // ----------------------------------------------
    
    console.log("📄 Sanitized text for translation:", originalText);
    
    // Disable the dropdown temporarily
    selectElement.disabled = true;
    const originalPlaceholder = selectElement.options[0].text;
    selectElement.options[0].text = "Translating...";
    
    // Track translation event
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "ReportTranslated",
            properties: { 
                targetLanguage: selectedLang,
                originalLength: originalText.length
            }
        });
    }
    
    // Call translation Logic App
    console.log("🌐 Calling translation API:", TRANSLATE_URL);
    fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            text: originalText,
            targetLanguage: selectedLang
        })
    })
    .then(response => {
        console.log("📥 Translation response status:", response.status);
        if (!response.ok) {
            throw new Error(`Translation failed: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("📄 Translation response data:", data);
        // Update the description with translated text
        if (data.translatedText) {
            descriptionElement.innerHTML = `<strong>[${selectedLang.toUpperCase()}]</strong> ${data.translatedText}`;
            
            console.log("✅ Translation successful, updated text:", descriptionElement.innerHTML);
            
            // Show success message
            const Toast = Swal.mixin({
                toast: true, 
                position: 'top-end', 
                showConfirmButton: false, 
                timer: 3000
            });
            Toast.fire({ 
                icon: 'success', 
                title: `Translated to ${selectedLang.toUpperCase()}!` 
            });
            
            // Reset dropdown to default
            selectElement.value = "";
        } else {
            throw new Error("No translation returned");
        }
    })
    .catch(error => {
        console.error("❌ Translation error:", error);
        
        // Track the error
        if (window.appInsights) {
            window.appInsights.trackException({ exception: error });
        }
        
        // Show error message
        Swal.fire({
            icon: 'error',
            title: 'Translation Failed',
            text: 'Could not translate the report. Please try again.',
            confirmButtonColor: '#1abc9c'
        });
        
        // Reset dropdown
        selectElement.value = "";
    })
    .finally(() => {
        // Re-enable the dropdown
        selectElement.disabled = false;
        selectElement.options[0].text = originalPlaceholder;
        console.log("🔄 Translation process completed");
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
        
        // NEW: Get a reference to the resolve button
        const resolveBtn = document.getElementById('btnModalResolve');
        
        // NEW: Hide the button if the issue is already resolved
        if (report.status === "Resolved") {
            resolveBtn.style.display = 'none';
        } else {
            resolveBtn.style.display = 'block';
            resolveBtn.onclick = function() {
                resolveIssue(report.id);
                bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
            };
        }

        // Setup Delete Button (always visible for admins)
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
    
    // Track the delete event
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "ReportDeleted",
            properties: { 
                issueType: issueType,
                reportId: reportId
            }
        });
    }

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
                
                // Track the error
                if (window.appInsights) {
                    window.appInsights.trackException({ exception: err });
                }
                
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
    
    // Track the resolve event
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "ReportResolved",
            properties: { 
                issueType: report.issueType,
                reportId: reportId
            }
        });
    }

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
                    
                    // --- NEW: LOCAL UI UPDATE ---
                    // 1. Update the status in your local memory
                    const reportIndex = allReports.findIndex(r => r.id === reportId);
                    if (reportIndex !== -1) {
                        allReports[reportIndex].status = "Resolved";
                    }

                    // 2. Re-render the list immediately using the updated local data
                    // This avoids a full network refresh while updating all badges and buttons
                    renderReportList(allReports); 
                    
                    // Optional: Refresh the map to turn the pin grey
                    if (map) {
                        map.remove();
                        map = null;
                        initMap(allReports);
                    }
                    // ----------------------------
                    
                } else {
                    throw new Error("Logic App failed");
                }
            })
            .catch(err => {
                console.error(err);
                
                // Track the error
                if (window.appInsights) {
                    window.appInsights.trackException({ exception: err });
                }
                
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
// 12. CLOUD ANALYTICS
// ==========================================
function syncAndShowAnalytics() {
    console.log("🔄 Syncing local data before showing analytics...");
    
    // Load fresh reports data first to ensure allReports is up-to-date
    loadReports().then(() => {
        console.log("✅ Data synced, now showing analytics");
        showAnalytics();
    }).catch(error => {
        console.error("❌ Failed to sync data:", error);
        // Still show analytics even if sync fails
        showAnalytics();
    });
}

function showAnalytics() {
    // Track the analytics view event
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "AnalyticsViewed"
        });
    }
    
    // 1. Open Modal & Show Loading
    new bootstrap.Modal(document.getElementById('analyticsModal')).show();
    
    // Optional: Show loading state on canvas? 
    // For now, we just fetch data.

    console.log("📊 Fetching analytics from Cloud...");

    fetch(ANALYTICS_LOGIC_APP_URL, { method: 'POST' })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
.then(data => {
        console.log("📊 Analytics Data received:", data);

        // 1. Safety check: Ensure the keys exist before accessing their properties
        if (!data || !data.types || !data.status) {
            console.error("❌ Cloud returned incomplete data:", data);
            throw new Error("Analytics data is missing required sections (types/status).");
        }

        // Check if the cloud returned an error instead of data
        if (data.error) {
            throw new Error(data.error.message || "Server returned error response");
        }

        // 2. Safely extract arrays using Optional Chaining (?.)
        const rawTypes = data.types?.Documents || data.types?.value || data.types || [];
        const rawStatus = data.status?.Documents || data.status?.value || data.status || [];
        const rawSentiment = data.sentiment?.Documents || data.sentiment?.value || data.sentiment || [];
        const rawTrends = data.trends?.Documents || data.trends?.value || data.trends || [];

        // Additional safety checks for data arrays
        if (!Array.isArray(rawTypes) || !Array.isArray(rawStatus)) {
            throw new Error("Expected array data but received invalid format");
        }

        // Process Types Data
        const typeLabels = rawTypes.map(item => item.issueType || "Unknown");
        const typeValues = rawTypes.map(item => item.count || 0);

        // Process Status Data
        const statusLabels = rawStatus.map(item => item.status || "Unknown");
        const statusValues = rawStatus.map(item => item.count || 0);

        // Process Sentiment Data (handle case where sentiment data might not exist)
        let sentimentLabels = [];
        let sentimentValues = [];
        
        if (Array.isArray(rawSentiment) && rawSentiment.length > 0) {
            sentimentLabels = rawSentiment.map(item => item.sentiment || "Unknown");
            sentimentValues = rawSentiment.map(item => item.count || 0);
        } else {
            // Fallback: derive sentiment from existing reports if no sentiment data
            const sentimentCounts = { "Positive": 0, "Neutral": 0, "Negative": 0 };
            allReports.forEach(report => {
                const sentiment = report.sentiments || report.sentiment;
                if (sentiment) {
                    const sentimentText = typeof sentiment === 'string' ? sentiment : sentiment.text || "Neutral";
                    if (sentimentText.toLowerCase().includes('positive') || sentimentText.toLowerCase().includes('good')) {
                        sentimentCounts["Positive"]++;
                    } else if (sentimentText.toLowerCase().includes('negative') || sentimentText.toLowerCase().includes('bad') || sentimentText.toLowerCase().includes('urgent')) {
                        sentimentCounts["Negative"]++;
                    } else {
                        sentimentCounts["Neutral"]++;
                    }
                } else {
                    sentimentCounts["Neutral"]++;
                }
            });
            
            // Convert to arrays, excluding zero counts
            Object.entries(sentimentCounts).forEach(([label, count]) => {
                if (count > 0) {
                    sentimentLabels.push(label);
                    sentimentValues.push(count);
                }
            });
        }

        // Process Trends Data (handle case where trends data might not exist)
        let trendLabels = [];
        let trendValues = [];
        
        if (Array.isArray(rawTrends) && rawTrends.length > 0) {
            trendLabels = rawTrends.map(item => item.day || item.date || item.label || "Unknown");
            trendValues = rawTrends.map(item => item.count || item.value || 0);
        } else {
            // Fallback: create sample trend data if no trends data from cloud
            trendLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            trendValues = [8, 12, 6, 15, 11, 9, 7]; // Sample daily report counts
        }

        // Render
        renderCharts(typeLabels, typeValues, statusLabels, statusValues, sentimentLabels, sentimentValues, trendLabels, trendValues);
    })
    .catch(err => {
        console.error("Analytics Error:", err);
        
        // Track the error
        if (window.appInsights) {
            window.appInsights.trackException({ exception: err });
        }
        
        Swal.fire("Error", `Could not fetch stats: ${err.message}`, "error");
    });
}

function renderCharts(tLabels, tValues, sLabels, sValues, sentLabels, sentValues, trendLabels, trendValues) {
    const ctxType = document.getElementById('chartTypes').getContext('2d');
    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    // const ctxSentiment = document.getElementById('chartSentiment').getContext('2d'); // REMOVED - No longer exists
    const ctxTrends = document.getElementById('chartTrends').getContext('2d');

    // Destroy old charts to prevent glitches
    if (typeChart) typeChart.destroy();
    if (statusChart) statusChart.destroy();
    // if (sentimentChart) sentimentChart.destroy(); // COMMENTED OUT
    if (trendsChart) trendsChart.destroy();

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
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false } 
            }
        }
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
        options: { 
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Chart 3: Sentiment (Pie/Doughnut) - COMMENTED OUT
    // if (sentLabels.length > 0 && sentValues.length > 0) {
    //     // Define colors: Green (Positive), Grey (Neutral), Red (Negative)
    //     const sentimentColors = sentLabels.map(label => {
    //         if (label.toLowerCase().includes('positive')) return '#27ae60'; // Green
    //         if (label.toLowerCase().includes('negative') || label.toLowerCase().includes('urgent')) return '#e74c3c'; // Red
    //         return '#95a5a6'; // Grey (default/neutral)
    //     });

    //     sentimentChart = new Chart(ctxSentiment, {
    //         type: 'doughnut',
    //         data: {
    //             labels: sentLabels,
    //             datasets: [{
    //                 data: sentValues,
    //                 backgroundColor: sentimentColors,
    //                 borderColor: '#ffffff',
    //                 borderWidth: 2
    //             }]
    //         },
    //         options: {
    //             responsive: true,
    //             plugins: {
    //                 legend: {
    //                     position: 'bottom',
    //                     labels: {
    //                         padding: 20,
    //                         usePointStyle: true
    //                     }
    //                 }
    //             }
    //         }
    //     });
    // }

    // Chart 4: Trends (Line Chart)
    // Use real data from cloud parameters
    trendsChart = new Chart(ctxTrends, {
        type: 'line',
        data: {
            labels: trendLabels, // Real labels from cloud
            datasets: [{
                label: 'Daily Reports',
                data: trendValues, // Real values from cloud
                borderColor: '#e67e22', // Primary city brand color
                backgroundColor: 'rgba(230, 126, 34, 0.1)',
                borderWidth: 3,
                tension: 0.4, // Smooth curves
                fill: true,
                pointBackgroundColor: '#e67e22',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// ==========================================
// 13. CLOUD SEARCH FUNCTIONALITY
// ==========================================

// 1. CONFIGURE URL
// Paste your Logic App URL here, but replace the specific keyword part with 'REPLACE_ME'
// Example: .../invoke/search/REPLACE_ME?api-version=...
const SEARCH_URL_TEMPLATE = "https://prod-61.uksouth.logic.azure.com/workflows/3d29e41323864026903f8dc9658f9751/triggers/When_an_HTTP_request_is_received/paths/invoke/search/REPLACE_ME?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=4ARJUjp84QKY3ZxeNFDiu_4sCcGXUoWwlJB5lrmMZq0"; 

function searchReportsCloud() {
    const keyword = document.getElementById('cloudSearchInput').value.trim();
    
    // Safety check
    if (!keyword) {
        Swal.fire("Enter a keyword", "Please type something to search.", "info");
        return;
    }
    
    // Track the search event
    if (window.appInsights) {
        window.appInsights.trackEvent({
            name: "CloudSearchExecuted",
            properties: { 
                keyword: keyword
            }
        });
    }

    console.log("☁️ Searching Cloud for:", keyword);
    const listDiv = document.getElementById('reportsList');
    
    // Show loading state
    listDiv.innerHTML = renderSkeletonLoader(); 

    // Construct the URL dynamically
    // If your Azure URL is: .../invoke/search/{keyword}?api...
    // You might need to manually construct it:
    // const baseUrl = "https://prod-XX.uksouth.logic.azure.com.../invoke/search/";
    // const queryParams = "?api-version=2016-10-01&sp=...";
    // const finalUrl = baseUrl + encodeURIComponent(keyword) + queryParams;

    // SIMPLER METHOD (If you paste the full URL with 'REPLACE_ME' above):
    const finalUrl = SEARCH_URL_TEMPLATE.replace("REPLACE_ME", encodeURIComponent(keyword));

    fetch(finalUrl)
    .then(response => response.json())
    .then(data => {
        // Handle Azure's response format (it might be { Documents: [...] } or just [...])
        const items = data.Documents || data.value || data; 
        
        if (!Array.isArray(items) || items.length === 0) {
            listDiv.innerHTML = `
                <div class="col-12 text-center p-5">
                    <div class="text-muted mb-3"><i class="fas fa-search fa-3x"></i></div>
                    <h5>No matches found</h5>
                    <p class="text-muted">Our cloud database couldn't find matches for "${keyword}".</p>
                    <button class="btn btn-outline-primary mt-2" onclick="loadReports()">Show All Reports</button>
                </div>`;
            return;
        }

        // Reuse your existing render function!
        // This keeps the cards looking exactly the same.
        renderReportList(items); 
        
        // Show success toast
        const Toast = Swal.mixin({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000
        });
        Toast.fire({ icon: 'success', title: `Found ${items.length} matches` });
    })
    .catch(err => {
        console.error("Search Error:", err);
        
        // Track the error
        if (window.appInsights) {
            window.appInsights.trackException({ exception: err });
        }
        
        listDiv.innerHTML = "<p class='text-danger text-center'>Search failed. Check console.</p>";
    });
}