/*
 * CHAT WITH CLAUDE - A p5.js + AI Application
 * This sketch creates a chat interface where users can talk with Claude AI
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Where to send our messages (our server acts as a middleman to Claude)
const API_URL = "http://localhost:3000/api/chat";

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

let inputField;              // Text box where user types
let submitButton;            // Button to send messages
let conversationHistory = []; // Array storing all messages back and forth
let isLoading = false;       // Are we waiting for Claude to respond?

// =============================================================================
// SETUP - Runs once when the program starts
// =============================================================================

function setup() {
  createCanvas(400, 700); // Create canvas for drawing

  // Create text input box at top of screen
  inputField = createInput("");
  inputField.position(20, 20);
  inputField.size(320, 40);
  inputField.attribute("placeholder", "Type your message to Barb here...");

  // Create send button next to input box
  submitButton = createButton("Send");
  submitButton.position(350, 20);
  submitButton.size(80, 40);
  submitButton.mousePressed(sendMessage); // When clicked, call sendMessage()

  // Allow Enter key to send message (instead of clicking button)
  inputField.elt.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Set default text settings
  textAlign(LEFT, TOP);
  textSize(14);
}

// =============================================================================
// DRAW - Runs 60 times per second, displays everything on screen
// =============================================================================

function draw() {
  // White background for chat readability
  background(222, 255, 115);

  // Calculate total content height
  let totalHeight = 80;
  textSize(16);

  for (let msg of conversationHistory) {
    let msgText = (msg.role === "user" ? "You: " : "Barb: ") + msg.content;
    let words = msgText.split(' ');
    let line = '';
    let lineCount = 0;

    for (let i = 0; i < words.length; i++) {
      let testLine = line + words[i] + ' ';
      if (textWidth(testLine) > 360 && i > 0) {
        lineCount++;
        line = words[i] + ' ';
      } else {
        line = testLine;
      }
    }
    lineCount++; // Last line
    totalHeight += (lineCount * 20) + 10;
  }

  // Auto-scroll offset
  let scrollOffset = 0;
  if (totalHeight > height - 100) {
    scrollOffset = totalHeight - (height - 100);
  }

  // Draw messages with scroll offset
  let yPos = 80 - scrollOffset;

  for (let msg of conversationHistory) {
    if (msg.role === "user") {
      fill(0, 0, 255);
      yPos = drawWrappedText("You: " + msg.content, 20, yPos, 360);
    } else if (msg.role === "assistant") {
      fill(255, 0, 0);
      yPos = drawWrappedText("Barb: " + msg.content, 20, yPos, 360);
    }
    yPos += 10;
  }

  // Show loading indicator
  if (isLoading) {
    fill(100);
    textStyle(ITALIC);
    text("Barb is typing...", 20, yPos);
    textStyle(NORMAL);
  }
}

// ============================================================================
// SENDING MESSAGES TO CLAUDE
// ============================================================================

async function sendMessage() {
  // Don't send if we're already waiting or if input is empty
  if (isLoading || inputField.value().trim() === "") {
    return;
  }

  // Get the user's message and clear the input box
  let userMessage = inputField.value().trim();
  inputField.value("");

  // Add user's message to conversation history
  conversationHistory.push({
    role: "user",
    content: userMessage
  });

  // Show loading indicator
  isLoading = true;

  try {
    // Send request to our server (which talks to Claude)
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",  // Which AI model to use
        max_tokens: 1024,                      // Maximum length of response
        messages: conversationHistory          // All previous messages
      })
    });

    // Check if request was successful
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    // Read the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Add placeholder for assistant's response (after we know streaming started successfully)
    conversationHistory.push({
      role: "assistant",
      content: ""
    });

    // Hide loading indicator now that we have a response container
    isLoading = false;

    // Get reference to the assistant's message we're building
    const assistantMessage = conversationHistory[conversationHistory.length - 1];

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            // Handle content_block_delta events
            if (event.type === 'content_block_delta' && event.delta?.text) {
              assistantMessage.content += event.delta.text;
            }

          } catch (e) {
            // Skip unparseable lines
          }
        }
      }
    }

  } catch (error) {
    // If something goes wrong, show error message
    console.error("Error calling Anthropic API:", error);

    // Add error message to conversation
    conversationHistory.push({
      role: "assistant",
      content: "Error: " + error.message
    });

    // Hide loading indicator
    isLoading = false;
  }
}
// Helper function to wrap text
function drawWrappedText(txt, x, y, maxWidth) {
  let words = txt.split(' ');
  let line = '';
  let lineHeight = 20;

  for (let i = 0; i < words.length; i++) {
    let testLine = line + words[i] + ' ';
    let testWidth = textWidth(testLine);

    if (testWidth > maxWidth && i > 0) {
      text(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  text(line, x, y);
  return y + lineHeight;
}
