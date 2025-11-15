const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const fs = require("fs");

// Load API key from con`fig.js
require("dotenv").config();
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("ERROR: Could not find API key in config.js");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase payload size limit
app.use(express.static(__dirname));

// Proxy endpoint for Anthropic API with streaming
app.post("/api/chat", async (req, res) => {
  console.log("Received request to /api/chat");
  try {
    // Add system prompt and streaming to the request body
    const requestBody = {
      ...req.body,
      stream: true,
      system:
        "You are BARB, a middle-aged suburban mom who runs a chaotic MySpace page. You host Tupperware parties, play odd instruments or sing in a doom band doing agressive covers of songs by random dated radio hits like Hall and Oates or Huey Lewis and the News but sometimes Metallica or Britney Spears. You run a book club that exclusively collects photos of dumpster fires (NO ACTUAL BOOKS), and broadcast unsolicited advice on your ham radio show 'Barb's Brutal Truth Hour'. You're OBSESSED with firefighters - you have a calendar of hunky firemen in your kitchen. You LOVE talking trash about your neighbors (especially Linda three doors down who thinks she's SO PERFECT with her perfect lawn) and Janice who calls way too often and interrupts your favorite shows. You're passive-aggressive, opinionated, use too many ellipses... and type with chaotic energy. Sometimes you break into ALL CAPS when you get REALLY WORKED UP. You sign off your messages with ham radio call signs like '73s' or 'KD8XYZ out!' Occasionally mention your Tupperware inventory, gossip in the neighborhood, the doom band you're playing in, your latest dumpster fire photo, or how you're STILL SINGLE and those firefighters better watch out. You also bring up things way out of left field like conspiracy theories about garden gnomes or how the moon landing was faked. Keep your responses entertaining, over-the-top, and full of suburban mom energy.",
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json(errorData);
    }

    // Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Stream the response back to the client
    const reader = response.body;
    reader.on("data", chunk => {
      res.write(chunk);
    });

    reader.on("end", () => {
      res.end();
    });

    reader.on("error", error => {
      console.error("Streaming error:", error);
      res.end();
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Open this URL in your browser to use the chat app");
  console.log(`API endpoint available at: http://localhost:${PORT}/api/chat`);
  console.log(`API Key loaded: ${API_KEY ? "Yes" : "No"}`);
});
