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
  console.log(`[Backend] New client connected: ${socket.id}`);


  socket.emit("session_id", {
    sessionId:socket.id
  })

  // Handle file upload
  socket.on("file_upload", async (data) => {
    console.log("[Backend] Received file upload data:", data.sessionId);

    const { sessionId, fileData } = data;
    const fileName = `${uuidv4()}.jpg`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Save file
    const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFile(filePath, Buffer.from(base64Data, "base64"), async (err) => {
      if (err) {
        console.error("[Backend] Error saving file:", err);
        socket.emit("upload_error", { message: "Failed to save file" });
        return;
      }

      console.log("sending this information to the clinet ::", sessionId)

      console.log(`[Backend] File saved: ${filePath}`);

      // Call OCR service
      try {
        const { extracted, error, structuredData: guestInfo } = await ocrService(filePath);

        if (error) {
          console.error("[Backend] OCR service error:", error);
          socket.emit("ocr_error", { message: "Failed to process OCR" });
          return;
        }

        console.log("[Backend] OCR results:", guestInfo);

        // Send success response
        io.to(sessionId).emit("file_upload_success", {
          filePath,
          guestInfo,
          sessionId,
        });
      } catch (ocrError) {
        console.error("[Backend] Error in OCR service:", ocrError);
        socket.emit("ocr_error", { message: "Unexpected OCR error" });
      }
    });
  });

  // Handle client disconnection
  socket.on("disconnect", () => {
    console.log(`[Backend] Client disconnected: ${socket.id}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`[Backend] Server is running on http://localhost:${PORT}`);
});


export default app