const express = require('express')
require('dotenv').config();
const cors = require('cors')
const connectToDatabse = require('./db.js');
const userRoutes = require('./routes/userRoutes.js')
const canvasRoutes = require('./routes/canvasRoutes')
const refreshTokenRoutes = require('./routes/refreshTokenRoutes')
const cookieParser = require('cookie-parser')
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Canvas = require('./models/canvas.js');
const PORT = process.env.PORT || 3000;


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        // origin: '*',
         origin: 'https://your-frontend.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true

    }
});


const canvasData = {};


app.use(cookieParser());
app.use(cors({
    // origin: true,
    // credentials: true,
    // exposedHeaders: ['Authorization'],

     origin: 'https://whiteboard-2qe0646so-praveens-projects-12e70f4f.vercel.app',
    credentials: true,
}));
app.use(express.json({ limit: '5mb' }));



connectToDatabse();

app.use('/api/users', userRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/token', refreshTokenRoutes);



// Add this to your server index.js

// Track user-canvas relationships
const userCanvasMap = new Map(); // socketId -> canvasId

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on("joinCanvas", async ({ canvasId }) => {
        console.log("Joining canvas:", canvasId);

        try {
            const authHeader = socket.handshake.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                socket.emit("unauthorized", { message: "Access Denied: No Token" });
                return;
            }

            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            const userId = decoded._id;

            const canvas = await Canvas.findById(canvasId);
            if (!canvas || (String(canvas.owner) !== String(userId) && !canvas.shared.includes(userId))) {
                socket.emit("unauthorized", { message: "You are not authorized to join this canvas." });
                return;
            }

            // Leave previous canvas if any
            const previousCanvas = userCanvasMap.get(socket.id);
            if (previousCanvas) {
                socket.leave(previousCanvas);
                console.log(`User ${socket.id} left previous canvas ${previousCanvas}`);
            }

            // Join new canvas
            socket.join(canvasId);
            userCanvasMap.set(socket.id, canvasId);
            console.log(`User ${socket.id} joined canvas ${canvasId}`);

            // Send canvas data
            if (canvasData[canvasId]) {
                socket.emit("loadCanvas", canvasData[canvasId]);
            } else {
                socket.emit("loadCanvas", canvas.elements);
            }

        } catch (error) {
            console.log("Error joining canvas:", error.message);
            socket.emit("unauthorized", { message: "Invalid token" });
        }
    });

    // Add explicit leave canvas event
    socket.on("leaveCanvas", ({ canvasId }) => {
        console.log(`User ${socket.id} leaving canvas ${canvasId}`);
        socket.leave(canvasId);
        userCanvasMap.delete(socket.id);
    });

    socket.on("drawingUpdate", async ({ canvasId, elements, senderId }) => {
        try {
            // Verify user is still in the canvas
            const userCanvas = userCanvasMap.get(socket.id);
            if (userCanvas !== canvasId) {
                console.log(`User ${socket.id} not authorized for canvas ${canvasId}`);
                return;
            }

            canvasData[canvasId] = elements;
            socket.to(canvasId).emit("receiveDrawingUpdate", { elements, senderId });

            const canvas = await Canvas.findById(canvasId);
            if (canvas) {
                await Canvas.findByIdAndUpdate(canvasId, { elements }, { new: true, useFindAndModify: false });
            }

        } catch (error) {
            console.error("Error in drawingUpdate:", error);
        }
    });

    socket.on('disconnect', () => {
        try {
            const canvasId = userCanvasMap.get(socket.id);
            if (canvasId) {
                console.log(`User ${socket.id} disconnected from canvas ${canvasId}`);
                userCanvasMap.delete(socket.id);
            }
            console.log('User disconnected:', socket.id);
        } catch (error) {
            console.log("Error disconnecting user:", error);
        }
    });
});

server.listen(PORT, () => {
    console.log("server is listening on port 8000");
})