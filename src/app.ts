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
    origin: "*", // Update with your frontend's origin for better security
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
  console.info(`[Backend] New client connected: ${socket.id}`);

  // Handle client registration
  socket.on("register", ({ clientId }) => {
    if (!clientId) {
      console.error("[Backend] Missing clientId in registration.");
      return;
    }

    clientIdToSocketMap.set(clientId, socket.id);
    console.info(`[Backend] Registered clientId: ${clientId} -> socketId: ${socket.id}`);
  });

  // Handle file upload
  socket.on("file_upload", async (data) => {
    try {
      console.info("[Backend] Received file upload request:", data.clientId);

      const { clientId, fileData } = data;
      if (!clientId || !fileData) {
        console.error("[Backend] Missing required file upload data.");
        socket.emit("upload_error", { message: "Invalid file upload data" });
        return;
      }

      const fileName = `${clientId}.jpg`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      // Save file to the server
      const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      console.log(`[Backend] File saved: ${filePath}`);

      // Call OCR service to process the uploaded file
      const { extracted, error, structuredData: guestInfo } = await ocrService(filePath);

      if (error) {
        console.error("[Backend] OCR service error:", error);
        socket.emit("ocr_error", { message: "Failed to process OCR" });
        return;
      }

      console.info("[Backend] OCR results:", guestInfo);

      // Find the target socket ID using the clientId
      const targetSocketId = clientIdToSocketMap.get(clientId);
      console.info(`[Backend] Target socket ID for clientId ${clientId}: ${targetSocketId}`);

      // Send success response to the client
      if (targetSocketId) {
        io.to(targetSocketId).emit("file_upload_success", {
          filePath,
          guestInfo,
          sessionId: targetSocketId,
        });
      } else {
        console.warn("[Backend] No active connection for clientId:", clientId);
      }
    } catch (err) {
      console.error("[Backend] Error handling file upload:", err);
      socket.emit("upload_error", { message: "Internal server error" });
    }
  });

  // Handle client disconnection
  socket.on("disconnect", () => {
    console.info(`[Backend] Client disconnected: ${socket.id}`);

    // Remove disconnected socketId from the map
    clientIdToSocketMap.forEach((value, key) => {
      if (value === socket.id) {
        clientIdToSocketMap.delete(key);
        console.info(`[Backend] Removed clientId: ${key} from map.`);
      }
    });
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`[Backend] Server is running on http://localhost:${PORT}`);
});


export default app