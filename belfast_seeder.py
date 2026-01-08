"""
Belfast CiviQ Data Seeder
Generates realistic civic issue reports with sentiment-driven descriptions
and diverse issue types across Belfast locations
No external dependencies required - uses only Python standard library
"""

import json
import random
import time
import urllib.request
import urllib.error

# YOUR ACTUAL LOGIC APP URL FROM APP.JS
SUBMIT_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/efe13b1eabd84a6ca949d9b687ba91d1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5T8mNlaNJshHKK7v91oBo7XEE5nYeZdnnHWgkTFV8tU"

# Belfast landmark coordinates for realistic distribution
BELFAST_LOCATIONS = [
    {"name": "City Hall", "lat": 54.5973, "lon": -5.9301},
    {"name": "Queens University", "lat": 54.5844, "lon": -5.9342},
    {"name": "Titanic Quarter", "lat": 54.6085, "lon": -5.9100},
    {"name": "Botanic Gardens", "lat": 54.5833, "lon": -5.9342},
    {"name": "St George's Market", "lat": 54.5965, "lon": -5.9185},
    {"name": "Ormeau Park", "lat": 54.5792, "lon": -5.9264},
    {"name": "Stormont", "lat": 54.6083, "lon": -5.8283},
    {"name": "Cathedral Quarter", "lat": 54.6025, "lon": -5.9275},
    {"name": "Victoria Square", "lat": 54.5983, "lon": -5.9267},
    {"name": "Falls Road", "lat": 54.5967, "lon": -5.9625},
]

# Issue types with sentiment-driven descriptions
ISSUE_DATA = {
    "Pothole": {
        "negative": [
            "Massive pothole causing severe damage to vehicles. This is extremely dangerous!",
            "Deep pothole has been here for months. Someone will get hurt!",
            "Urgent: Vehicle-destroying pothole at busy junction. Unacceptable!",
            "Dangerous pothole causing accidents. Immediate action needed!",
        ],
        "neutral": [
            "Pothole needs repair on main road.",
            "Road surface damaged, pothole forming near bus stop.",
            "Small pothole developing, should be fixed soon.",
            "Pothole reported near school entrance.",
        ],
        "positive": [
            "Thank you for fixing the pothole on Church Street quickly!",
            "Great work repairing the road damage. Much appreciated!",
            "Noticed the pothole was filled. Excellent response time!",
        ]
    },
    "Streetlight": {
        "negative": [
            "Streetlight broken for weeks! Area is pitch black and unsafe at night!",
            "Urgent: Multiple lights out creating dangerous dark zone. Crime risk!",
            "Broken light making walkway extremely dangerous after dark!",
            "Light flickering badly, concerned about safety for elderly residents.",
        ],
        "neutral": [
            "Streetlight not working on residential street.",
            "Light bulb needs replacement at pedestrian crossing.",
            "Intermittent streetlight near park entrance.",
            "Street lighting issue reported for inspection.",
        ],
        "positive": [
            "Streetlights fixed promptly! Thank you for making our area safer.",
            "Excellent work replacing the damaged lights. Community feels safer!",
            "Quick response to lighting issue. Well done council!",
        ]
    },
    "Flytipping": {
        "negative": [
            "Disgusting illegal dumping! Massive pile of waste attracting rats!",
            "Urgent: Commercial waste dumped illegally. Health hazard!",
            "Outrageous flytipping! This has been here for days. Completely unacceptable!",
            "Large-scale illegal dumping creating serious environmental hazard!",
        ],
        "neutral": [
            "Bags of waste left at alleyway entrance.",
            "Small amount of flytipping near commercial area.",
            "Household items dumped, needs collection.",
            "Waste materials left at car park corner.",
        ],
        "positive": [
            "Thank you for clearing the illegal dumping so quickly!",
            "Great response to flytipping complaint. Area cleaned up nicely.",
            "Appreciate the swift action on waste removal!",
        ]
    },
    "Other": {
        "negative": [
            "Broken glass all over children's playground! Extremely dangerous!",
            "Graffiti vandalism on historic building. Urgent cleaning needed!",
            "Blocked drain causing severe flooding. This is a disaster!",
            "Fallen tree blocking entire pavement. Urgent removal required!",
        ],
        "neutral": [
            "Cracked pavement at pedestrian crossing.",
            "Faded road markings need repainting.",
            "Park bench damaged, needs repair.",
            "Overgrown vegetation blocking street sign.",
        ],
        "positive": [
            "Great job maintaining the park! Looks fantastic.",
            "Thank you for the new bike racks. Very helpful!",
            "Excellent work on the playground renovation. Kids love it!",
        ]
    }
}

# Valid 100x100 pixel grey placeholder PNG (meets Azure Computer Vision requirements)
PLACEHOLDER_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAANElEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/BgeFAAB969X7gAAAABJRU5ErkJggg=="

def get_random_location_near(base_lat, base_lon, radius_km=0.5):
    """Generate random coordinates within radius of a base point"""
    # Rough approximation: 1 degree ≈ 111km at this latitude
    lat_offset = (random.random() - 0.5) * (radius_km / 111)
    lon_offset = (random.random() - 0.5) * (radius_km / (111 * 0.67))  # Adjust for latitude
    
    return round(base_lat + lat_offset, 6), round(base_lon + lon_offset, 6)

def create_report(issue_type, sentiment, location_base):
    """Create a single report with sentiment-appropriate description"""
    descriptions = ISSUE_DATA[issue_type][sentiment]
    description = random.choice(descriptions)
    
    lat, lon = get_random_location_near(location_base["lat"], location_base["lon"])
    
    # Weight status based on sentiment
    if sentiment == "positive":
        status = "Resolved"  # Positive descriptions are thank-you messages for resolved issues
    elif sentiment == "negative":
        status = random.choice(["Open", "Open", "Open"])  # Mostly open for urgent issues
    else:
        status = random.choice(["Open", "Open", "Resolved"])  # Mixed for neutral
    
    payload = {
        "description": description,
        "issueType": issue_type,
        "latitude": str(lat),
        "longitude": str(lon),
        "photoContent": PLACEHOLDER_IMAGE,
        "fileName": f"civic_issue_{random.randint(1000, 9999)}.png",
        "status": status
    }
    
    # Randomly add email for some reports
    if random.random() > 0.3:
        payload["userEmail"] = f"citizen{random.randint(1, 100)}@civiq.com"
    
    return payload

def seed_data(num_reports=30):
    """Generate and submit seeded reports"""
    print(f"🌱 Starting Belfast Data Seeding - {num_reports} reports")
    print(f"📍 Distributing across {len(BELFAST_LOCATIONS)} Belfast locations\n")
    
    success_count = 0
    fail_count = 0
    
    # Calculate distribution: 50% negative, 35% neutral, 15% positive
    sentiment_distribution = (
        ["negative"] * int(num_reports * 0.50) +
        ["neutral"] * int(num_reports * 0.35) +
        ["positive"] * int(num_reports * 0.15)
    )
    random.shuffle(sentiment_distribution)
    
    for i in range(num_reports):
        # Select random issue type and location
        issue_type = random.choice(list(ISSUE_DATA.keys()))
        location = random.choice(BELFAST_LOCATIONS)
        sentiment = sentiment_distribution[i] if i < len(sentiment_distribution) else "neutral"
        
        # Create payload
        payload = create_report(issue_type, sentiment, location)
        
        # Submit to Logic App using urllib (no external dependencies)
        try:
            # Prepare the request
            data = json.dumps(payload).encode('utf-8')
            req = urllib.request.Request(
                SUBMIT_URL,
                data=data,
                headers={'Content-Type': 'application/json'}
            )
            
            # Send request
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    success_count += 1
                    sentiment_icon = "🔴" if sentiment == "negative" else "🟢" if sentiment == "positive" else "🔵"
                    print(f"✅ [{i+1}/{num_reports}] {sentiment_icon} {payload['issueType']:12} | {sentiment:8} | {location['name']:20} | {payload['latitude']}, {payload['longitude']}")
                else:
                    fail_count += 1
                    print(f"❌ [{i+1}/{num_reports}] Failed: HTTP {response.status}")
                    
        except urllib.error.HTTPError as e:
            fail_count += 1
            print(f"❌ [{i+1}/{num_reports}] HTTP Error {e.code}: {e.reason}")
        except urllib.error.URLError as e:
            fail_count += 1
            print(f"❌ [{i+1}/{num_reports}] Network Error: {str(e.reason)[:50]}")
        except Exception as e:
            fail_count += 1
            print(f"❌ [{i+1}/{num_reports}] Error: {str(e)[:50]}")
        
        # Rate limiting: small delay between requests
        time.sleep(0.3)
    
    print(f"\n{'='*80}")
    print(f"✨ Seeding Complete!")
    print(f"   Success: {success_count}/{num_reports}")
    print(f"   Failed:  {fail_count}/{num_reports}")
    print(f"\n📊 Next Steps:")
    print(f"   1. Open your CiviQ application")
    print(f"   2. Click 'Refresh Data' button")
    print(f"   3. Click 'City Stats' to see analytics")
    print(f"   4. Check map for clustered pins across Belfast")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    # Generate 30 reports by default (adjust as needed)
    seed_data(num_reports=30)
