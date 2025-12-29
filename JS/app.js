// PASTE YOUR LOGIC APP POST URL HERE
const SUBMIT_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/efe13b1eabd84a6ca949d9b687ba91d1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5T8mNlaNJshHKK7v91oBo7XEE5nYeZdnnHWgkTFV8tU"; 

// === jQuery handlers ===
$(document).ready(function () {
  $("#retImages").click(getImages);
  $("#submitBtn").click(submitNewAsset);
  $("#logoutBtn").click(() => (window.location.href = "login.html"));
});

// === Submit issue report ===
function submitNewAsset() {
    
    // 1. Get data from HTML fields
    const issueType = document.getElementById('issueType').value;
    const description = document.getElementById('description').value;
    const lat = document.getElementById('latitude').value;
    const long = document.getElementById('longitude').value;
    const fileInput = document.getElementById('imageFile');

    if(fileInput.files.length === 0) {
        alert("Please select a photo!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    // 2. Read the file
    reader.readAsDataURL(file);
    
    reader.onload = function() {
        // --- THE CRITICAL FIX ---
        // The reader returns "data:image/png;base64,iVBOR..."
        // We split by comma to get ONLY the raw code: "iVBOR..."
        const rawBase64 = reader.result.split(',')[1]; 

        // 3. Create the JSON Payload (Matching your Logic App)
        const payload = {
            "description": description,
            "issueType": issueType,
            "latitude": lat,
            "longitude": long,
            "photoContent": rawBase64, // Sending the CLEAN string
            "fileName": file.name
        };

        // 4. Send to Azure
        fetch(SUBMIT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (response.ok) {
                document.getElementById('statusMessage').innerText = "✅ Report Submitted Successfully!";
            } else {
                document.getElementById('statusMessage').innerText = "❌ Error submitting report.";
            }
        })
        .catch(error => console.error('Error:', error));
    };
}

// Helper function to get browser location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            document.getElementById('latitude').value = position.coords.latitude;
            document.getElementById('longitude').value = position.coords.longitude;
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// === Retrieve and render media list (grid + numbered video links) ===
function getImages() {
  const $list = $("#ImageList");
  $list
    .addClass("media-grid")
    .html('<div class="spinner-border" role="status"><span>Loading...</span></div>');

  $.ajax({
    url: "https://prod-28.norwayeast.logic.azure.com:443/workflows/0c9b146dff084c6093ae46a93728b5c4/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=7lOihj3TYYaRmbq8Mza0-gDasbtcgGnf8XWCwuw52cQ",
    type: "GET",
    dataType: "json",
    success: function (data) {
      console.log("Raw data received:", data);
      if (!Array.isArray(data)) {
        $list.html("<p>No media found or invalid data format.</p>");
        return;
      }

      let videoCounter = 0;
      const cards = [];

      $.each(data, function (_, val) {
        try {
          // Extract fields (case-insensitive) + unwrap base64 if needed
          let fileName = unwrapMaybeBase64(val.fileName || val.FileName || "");
          let filePath = unwrapMaybeBase64(val.filePath || val.FilePath || "");
          let userName = unwrapMaybeBase64(val.userName || val.UserName || "");
          let userID   = unwrapMaybeBase64(val.userID   || val.UserID   || "");
          const contentType = val.contentType || val.ContentType || "";

          const fullUrl = buildBlobUrl(filePath);
          const isVideo = isLikelyVideo({ contentType, url: fullUrl, fileName });

          // Build a card for the grid
          if (isVideo) {
            videoCounter += 1;
            const label = `video${videoCounter}`;

            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <!-- Simple poster area for video -->
                  <a class="video-link" href="${fullUrl}" target="_blank" download="${fileName || label}">${label}</a>
                </div>
                <div class="media-body">
                  <span class="media-title">${escapeHtml(fileName || "(unnamed)")}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                </div>
              </div>
            `);
          } else {
            // Try as image; if it fails, we'll swap to a link
            const safeLabel = escapeHtml(fileName || fullUrl);
            cards.push(`
              <div class="media-card">
                <div class="media-thumb">
                  <img src="${fullUrl}"
                       alt="${safeLabel}"
                       onerror="imageFallbackToLink(this, '${fullUrl.replace(/'/g,"\\'")}', '${safeLabel.replace(/'/g,"\\'")}')" />
                </div>
                <div class="media-body">
                  <span class="media-title">${safeLabel}</span>
                  <div>Uploaded by: ${escapeHtml(userName || "(unknown)")} (id: ${escapeHtml(userID || "(unknown)")})</div>
                  <div class="image-error"></div>
                </div>
              </div>
            `);
          }
        } catch (err) {
          console.error("Error building card:", err, val);
          cards.push(`
            <div class="media-card">
              <div class="media-body">
                <span class="media-title" style="color:#b91c1c;">Error displaying this item</span>
              </div>
            </div>
          `);
        }
      });

      $list.html(cards.join(""));
    },
    error: (xhr, status, error) => {
      console.error("Error fetching media:", status, error, xhr?.responseText);
      $list.html("<p style='color:red;'>Error loading media. Check console.</p>");
    },
  });
}

// === Helpers ===
function unwrapMaybeBase64(value) {
  if (value && typeof value === "object" && "$content" in value) {
    try { return atob(value.$content); } catch { return value.$content || ""; }
  }
  return value || "";
}

function buildBlobUrl(filePath) {
  if (!filePath) return "";
  const trimmed = String(filePath).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed; // already absolute
  const left = ("https://blobstorageweek63.blob.core.windows.net" || "").replace(/\/+$/g, "");
  const right = trimmed.replace(/^\/+/g, "");
  return `${left}/${right}`;
}

// Only detect videos; everything else is attempted as an image
function isLikelyVideo({ contentType, url, fileName }) {
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  const target = ((url || "") + " " + (fileName || "")).toLowerCase();
  return /\.(mp4|m4v|webm|og[gv]|mov|avi)(\?|#|$)/.test(target);
}

// Fallback: if an <img> fails to load, replace it with a link in-place
function imageFallbackToLink(imgEl, url, label) {
  const card = imgEl.closest(".media-card");
  if (!card) return;
  const thumb = card.querySelector(".media-thumb");
  const errMsg = card.querySelector(".image-error");

  if (thumb) {
    thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="video-link">${label || url}</a>`;
  }
  if (errMsg) {
    errMsg.textContent = "Image failed to load — opened as link instead.";
    errMsg.style.display = "block";
  }
}

// Minimal HTML-escaper for labels
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}