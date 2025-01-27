import express from "express";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { ocrService } from "./service/ocrService";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

// Create HTTP server
const server = http.createServer(app);

// Map to track clientId and socketId relationships
const clientIdToSocketMap = new Map<string, string>();

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*", // Update with your frontend's origin for security
    methods: ["GET", "POST"],
  },
});

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`[Backend] Created upload directory: ${UPLOAD_DIR}`);
}

// Serve a basic endpoint for testing
app.get("/", (_req, res) => {
  res.send({ message: "Server is running" });
});

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.info(`[backend] New Client Connected: ${socket.id}`);
  console.info(`[backend] ClientID SocketMAP: ${JSON.stringify([...clientIdToSocketMap])}`);

  // Handle client registration
  socket.on("register", ({ clientId }) => {
    clientIdToSocketMap.set(clientId, socket.id);
    console.info(`[backend] Registered clientId: ${clientId} -> socketId: ${socket.id}`);
  });

  // Handle file upload
  socket.on("file_upload", async (data) => {
    console.info("[backend] Received file upload data:", data.clientId);

    const targetSocketId = clientIdToSocketMap.get(data.clientId);
    console.info(`[backend] Target Socket Id: ${targetSocketId}`);

    // Call OCR service and process the file
    const { extracted, error, structuredData: guestInfo } = await ocrService(""); // Add actual implementation here

    if (error) {
      console.error("[backend] OCR service error:", error);
      socket.emit("ocr_error", { message: "Failed to process OCR" });
      return;
    }

    console.info("[backend] OCR results:", guestInfo);

    // Send success response to the target client
    if (targetSocketId) {
      io.to(targetSocketId).emit("file_upload_success", {
        filePath: "hi from wss",
        guestInfo,
        sessionId: targetSocketId,
      });
    }
  });

  // Handle client disconnection
  socket.on("disconnect", () => {
    console.info(`[backend] Client Disconnected: ${socket.id}`);

    // Remove disconnected socketId from the map
    clientIdToSocketMap.forEach((value, key) => {
      if (value === socket.id) {
        clientIdToSocketMap.delete(key);
      }
    });
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`[Backend] Server is running on http://localhost:${PORT}`);
});


export default app