"""
Diagnostic Belfast CiviQ Seeder
Tests your Logic App with a single request and detailed error reporting
"""

import json
import urllib.request
import urllib.error
import ssl

# YOUR LOGIC APP URL
SUBMIT_URL = "https://prod-34.uksouth.logic.azure.com:443/workflows/efe13b1eabd84a6ca949d9b687ba91d1/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5T8mNlaNJshHKK7v91oBo7XEE5nYeZdnnHWgkTFV8tU"

# Simple test payload
test_payload = {
    "description": "Diagnostic test report - please ignore",
    "issueType": "Pothole",
    "latitude": "54.5973",
    "longitude": "-5.9301",
    "photoContent": "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAANElEQVR42u3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/BgeFAAB969X7gAAAABJRU5ErkJggg==",
    "fileName": "diagnostic_test.png",
    "status": "Open"
}

def test_logic_app():
    """Send one test request and provide detailed diagnostics"""
    print("🔍 DIAGNOSTIC TEST FOR YOUR LOGIC APP")
    print("=" * 50)
    print(f"Target URL: {SUBMIT_URL[:80]}...")
    print(f"Test Payload: {json.dumps(test_payload, indent=2)}")
    print("=" * 50)
    
    try:
        # Prepare request
        data = json.dumps(test_payload).encode('utf-8')
        req = urllib.request.Request(
            SUBMIT_URL,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'CiviQ-Diagnostic-Tool/1.0'
            }
        )
        
        print("📡 Sending test request...")
        
        # Create SSL context that ignores certificate issues (for debugging)
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        # Send request with detailed error handling
        with urllib.request.urlopen(req, timeout=30, context=context) as response:
            print(f"✅ SUCCESS! Status Code: {response.status}")
            print(f"Headers: {dict(response.headers)}")
            
            # Try to read response
            try:
                response_data = response.read().decode('utf-8')
                print(f"Response Body: {response_data[:200]}...")
            except:
                print("No readable response body")
                
            return True
            
    except urllib.error.HTTPError as e:
        print(f"❌ HTTP ERROR {e.code}: {e.reason}")
        print(f"URL: {e.url}")
        print(f"Headers: {dict(e.headers)}")
        
        # Try to read error response
        try:
            error_body = e.read().decode('utf-8')
            print(f"Error Response: {error_body[:500]}")
        except:
            print("Could not read error response")
            
        # Specific troubleshooting for common codes
        if e.code == 502:
            print("\n🔧 TROUBLESHOOTING 502 BAD GATEWAY:")
            print("1. Your Logic App might be DISABLED")
            print("2. Cosmos DB connection might be broken")
            print("3. Computer Vision API might be timing out")
            print("4. Internal Logic App workflow error")
            
        elif e.code == 401:
            print("\n🔧 TROUBLESHOOTING 401 UNAUTHORIZED:")
            print("1. Check your Logic App trigger signature")
            print("2. Verify the URL hasn't expired")
            
        elif e.code == 404:
            print("\n🔧 TROUBLESHOOTING 404 NOT FOUND:")
            print("1. Logic App workflow might be deleted")
            print("2. Incorrect URL path")
            
        return False
        
    except urllib.error.URLError as e:
        print(f"❌ URL ERROR: {e.reason}")
        print("Possible causes:")
        print("- Internet connection issues")
        print("- Firewall blocking the request")
        print("- DNS resolution problems")
        return False
        
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {type(e).__name__}: {str(e)}")
        return False

def main():
    print("Starting diagnostic test...\n")
    
    success = test_logic_app()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Logic App is working! You can now run the full seeder.")
        print("Run: python belfast_seeder.py")
    else:
        print("🚨 Logic App has issues that need fixing in Azure Portal.")
        print("\nNext steps:")
        print("1. Go to Azure Portal → Logic Apps → Your Submit Logic App")
        print("2. Check if it's ENABLED (top right)")
        print("3. Go to Run History and see the latest error")
        print("4. Check API Connections for Cosmos DB and Computer Vision")
        print("5. Verify all services are active in Azure")

if __name__ == "__main__":
    main()
