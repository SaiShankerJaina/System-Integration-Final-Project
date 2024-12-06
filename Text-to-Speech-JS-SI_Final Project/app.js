const express = require("express");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const cors = require('cors');

require("dotenv").config();

const app = express();
app.use(cors());
const port = process.env.PORT || 3002;

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json"); // Ensure this path matches your swagger.json location

// Serve Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Middleware for parsing JSON and serving static files
app.use(bodyParser.json());
app.use(express.static("public")); // Ensure this serves the public folder properly

// Helper to synthesize audio
const synthesizeAudio = (text, voiceName = "en-US-AvaMultilingualNeural") => {
    return new Promise((resolve, reject) => {
        const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
        // Generate unique output filename using timestamp
        const outputPath = path.join(__dirname, "public", `output_${Date.now()}.wav`);
        const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);
        speechConfig.speechSynthesisVoiceName = voiceName;

        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
        synthesizer.speakTextAsync(
            text,
            (result) => {
                if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                    console.log("Audio synthesis completed.");
                    resolve(outputPath); // Return the new output path
                } else {
                    console.error("Synthesis canceled:", result.errorDetails);
                    reject(new Error("Synthesis failed."));
                }
                synthesizer.close();
            },
            (err) => {
                console.error("Error during synthesis:", err);
                synthesizer.close();
                reject(err);
            }
        );
    });
};

// Root endpoint to test if the server is running
app.get("/status", (req, res) => {
    res.status(200).json({ status: "Server is running!" });
});

// Endpoint to synthesize text and serve the audio file
app.post("/synthesize", async (req, res) => {
    const { text, voiceName } = req.body;

    console.log("Received text:", text);
    console.log("Selected voice:", voiceName); // Debugging line to check the voiceName

    if (!text || text.trim() === "") {
        return res.status(400).json({ error: "Text is required for synthesis." });
    }

    if (!voiceName) {
        return res.status(400).json({ error: "Voice name is required." });
    }

    try {
        // Call the helper function to synthesize the audio
        const audioPath = await synthesizeAudio(text, voiceName);
        console.log(audioPath);
        const fileName = path.basename(audioPath);
        console.log(fileName);
        const audioUrl = `http://${req.headers.host}/${fileName}?v=${Date.now()}`; // Generate complete URL correctly

        console.log("Generated audio URL:", audioUrl); // Log the generated URL

        // Send the URL with a unique query parameter to avoid caching
        res.status(200).json({ audioUrl });
    } catch (error) {
        console.error("Unexpected error:", error);
        res.status(500).send({ error: "Internal Server Error." });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at local host:${port}`);
});
