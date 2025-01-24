import express from "express";
import dotenv from "dotenv";
import WebSocket, { RawData } from "ws";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { ocrService } from "./service/ocrService";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

// Create a single HTTP server
const server = http.createServer(app);

// Create a WebSocket server that listens on the same port
const wss = new WebSocket.Server({ server });

// Store WebSocket connections by sessionId
const clients = new Map<string, WebSocket>();

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[Backend] Created upload directory: ${UPLOAD_DIR}`);
}

// WebSocket connection handler
wss.on("connection", (ws) => {
  console.log("[Backend] New client connected");

  // Generate a unique session ID for the client
  const sessionId = uuidv4();
  clients.set(sessionId, ws);
  console.log(`[Backend] Client assigned sessionId: ${sessionId}`);

  // Send the session ID to the client
  ws.send(
    JSON.stringify({
      type: "session_id",
      sessionId,
    })
  );

  // Handle incoming messages from the client
  ws.on("message", async (message: RawData) => {
    const data = JSON.parse(message.toString());
  
    if (data.type === "file_upload") {
      console.log("Session ID from the upload page:", data.sessionId);
  
      const fileData = data.fileData; // Base64 string (may include data: URL prefix)
      const fileName = `${uuidv4()}.jpg`; // Generate a unique file name
      const filePath = path.join(UPLOAD_DIR, fileName);
  
      console.log(`[Backend] Saving file to: ${filePath}`);
  
      // Strip the data: URL prefix (if present)
      const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
  
      // Decode the Base64 string and save the file
      fs.writeFile(filePath, Buffer.from(base64Data, "base64"), async (err) => {
        if (err) {
          console.error("[Backend] Failed to save file:", err);
          return;
        }
  
        console.log(`[Backend] File saved: ${filePath}`);
  
        // Call the OCR service with the relative file path
        try {
          const { extracted, error,  structuredData : guestInfo} = await ocrService(filePath);
  
          if (error) {
            console.error("[Backend] OCR service error:", error);
            return;
          }
  
          console.log("[Backend] OCR results:", guestInfo);
  
          // Broadcast the file information and OCR results to all connected clients
          clients.forEach((client, clientSessionId) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  type: "file_upload_success",
                  filePath, 
                  guestInfo, // OCR results
                  sessionId: data.sessionId, // The session ID of the client who uploaded the file
                  clientSessionId, // The session ID of the client receiving the message
                })
              );
            }
          });
        } catch (ocrError) {
          console.error("[Backend] Error in OCR service:", ocrError);
        }
      });
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    clients.delete(sessionId);
    console.log(`[Backend] Client with sessionId ${sessionId} disconnected`);
  });
});

// Start the HTTP server (which also handles WebSocket connections)
server.listen(PORT, () => {
  console.log(`[Backend] Server is running on http://localhost:${PORT}`);
});
