module.exports = async function (context, req) {
    // Enable CORS
    context.res = {
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    };

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        context.res.status = 200;
        context.res.body = "";
        return;
    }

    try {
        // Read credentials from environment variables
        const speechKey = process.env.SPEECH_KEY;
        const speechRegion = process.env.SPEECH_REGION;

        if (!speechKey || !speechRegion) {
            context.res = {
                status: 500,
                body: { error: "Server configuration error: Missing SPEECH_KEY or SPEECH_REGION" },
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            };
            return;
        }

        // Request a token from Azure Cognitive Services
        const tokenUrl = `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
        
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey,
                'Content-Length': '0'
            }
        });

        if (!tokenResponse.ok) {
            throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
        }

        const token = await tokenResponse.text();

        // Return the token and region
        context.res = {
            status: 200,
            body: {
                token: token,
                region: speechRegion
            },
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        };

    } catch (error) {
        context.log.error('Error in SpeechToken function:', error);

        context.res = {
            status: 500,
            body: { 
                error: "Failed to obtain speech token",
                message: error.message 
            },
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        };
    }
};