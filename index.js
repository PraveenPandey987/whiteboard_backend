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
// const io = new Server(server, {
//     cors: {
//         origin: '*',
//     }
// });


const io = new Server(server, {
    cors: {
        // origin: [
        //     'https://whiteboard-app-zeta.vercel.app',
        //     'http://localhost:5173',
        //     'http://localhost:3000',
        //     'http://localhost:3001'
        // ],
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Improved canvas data management with cleanup
const canvasData = new Map();
const canvasUsers = new Map(); // Track active users per canvas
const userCanvasMap = new Map(); // socketId -> canvasId

// Database update queue to prevent race conditions
const updateQueue = new Map(); // canvasId -> timeout

// Cleanup inactive canvas data
const cleanupCanvasData = (canvasId) => {
    const users = canvasUsers.get(canvasId) || new Set();
    if (users.size === 0) {
        // No active users, clean up canvas data after delay
        setTimeout(() => {
            const currentUsers = canvasUsers.get(canvasId) || new Set();
            if (currentUsers.size === 0) {
                canvasData.delete(canvasId);
                canvasUsers.delete(canvasId);
                console.log(`Cleaned up canvas data for ${canvasId}`);
            }
        }, 30000); // 30 seconds delay
    }
};

// Debounced database update
const scheduleCanvasUpdate = (canvasId, elements) => {
    // Clear existing timeout
    if (updateQueue.has(canvasId)) {
        clearTimeout(updateQueue.get(canvasId));
    }
    
    // Schedule new update
    const timeout = setTimeout(async () => {
        try {
            await Canvas.findByIdAndUpdate(
                canvasId, 
                { elements }, 
                { new: true, useFindAndModify: false }
            );
            updateQueue.delete(canvasId);
            console.log(`Canvas ${canvasId} updated in database`);
        } catch (error) {
            console.error(`Error updating canvas ${canvasId}:`, error);
            updateQueue.delete(canvasId);
        }
    }, 1000); // 1 second debounce
    
    updateQueue.set(canvasId, timeout);
};

app.use(cookieParser());
// app.use(cors({
//     origin: true,
//     credentials: true,
//     exposedHeaders: ['Authorization'],
// }));


app.use(cors({
    // origin: [
    //     'https://whiteboard-app-zeta.vercel.app',
    //     'http://localhost:5173',
    //     'http://localhost:3000',
    //     'http://localhost:3001'
    // ],
    origin: '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH','OPTIONS']
}));



app.use(express.json({ limit: '5mb' }));

connectToDatabse();

app.get('/', (req, res) => {
    res.send('<h1>Welcome</h1>');
});

app.use('/api/users', userRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/token', refreshTokenRoutes);

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
                await handleLeaveCanvas(socket, previousCanvas);
            }

            // Join new canvas
            socket.join(canvasId);
            userCanvasMap.set(socket.id, canvasId);
            
            // Track users per canvas
            if (!canvasUsers.has(canvasId)) {
                canvasUsers.set(canvasId, new Set());
            }
            canvasUsers.get(canvasId).add(socket.id);
            
            console.log(`User ${socket.id} joined canvas ${canvasId}`);

            // Send canvas data
            if (canvasData.has(canvasId)) {
                socket.emit("loadCanvas", canvasData.get(canvasId));
            } else {
                // Load from database and cache
                canvasData.set(canvasId, canvas.elements);
                socket.emit("loadCanvas", canvas.elements);
            }

        } catch (error) {
            console.log("Error joining canvas:", error.message);
            socket.emit("unauthorized", { message: "Invalid token" });
        }
    });

    // Helper function to handle leaving canvas
    const handleLeaveCanvas = async (socket, canvasId) => {
        try {
            console.log(`User ${socket.id} leaving canvas ${canvasId}`);
            
            // Remove from socket room
            socket.leave(canvasId);
            
            // Update user tracking
            if (canvasUsers.has(canvasId)) {
                canvasUsers.get(canvasId).delete(socket.id);
            }
            
            // Remove from user-canvas mapping
            if (userCanvasMap.get(socket.id) === canvasId) {
                userCanvasMap.delete(socket.id);
            }
            
            // Schedule cleanup if no users left
            cleanupCanvasData(canvasId);
            
            // Force any pending database updates
            if (updateQueue.has(canvasId)) {
                clearTimeout(updateQueue.get(canvasId));
                const elements = canvasData.get(canvasId);
                if (elements) {
                    try {
                        await Canvas.findByIdAndUpdate(
                            canvasId, 
                            { elements }, 
                            { new: true, useFindAndModify: false }
                        );
                        console.log(`Final update for canvas ${canvasId} completed`);
                    } catch (error) {
                        console.error(`Error in final update for canvas ${canvasId}:`, error);
                    }
                }
                updateQueue.delete(canvasId);
            }
            
        } catch (error) {
            console.error("Error in handleLeaveCanvas:", error);
        }
    };

    // Explicit leave canvas event
    socket.on("leaveCanvas", async ({ canvasId }) => {
        await handleLeaveCanvas(socket, canvasId);
    });

    socket.on("drawingUpdate", async ({ canvasId, elements, senderId }) => {
        try {
            // Verify user is still in the canvas
            const userCanvas = userCanvasMap.get(socket.id);
            if (userCanvas !== canvasId) {
                console.log(`User ${socket.id} not authorized for canvas ${canvasId}`);
                return;
            }

            // Update in-memory data
            canvasData.set(canvasId, elements);
            
            // Broadcast to other users in the canvas
            socket.to(canvasId).emit("receiveDrawingUpdate", { elements, senderId });

            // Schedule debounced database update
            scheduleCanvasUpdate(canvasId, elements);

        } catch (error) {
            console.error("Error in drawingUpdate:", error);
        }
    });

    socket.on('disconnect', async () => {
        try {
            const canvasId = userCanvasMap.get(socket.id);
            if (canvasId) {
                await handleLeaveCanvas(socket, canvasId);
            }
            console.log('User disconnected:', socket.id);
        } catch (error) {
            console.log("Error disconnecting user:", error);
        }
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Gracefully shutting down...');
    
    // Force all pending database updates
    const pendingUpdates = Array.from(updateQueue.entries()).map(async ([canvasId, timeout]) => {
        clearTimeout(timeout);
        const elements = canvasData.get(canvasId);
        if (elements) {
            try {
                await Canvas.findByIdAndUpdate(
                    canvasId, 
                    { elements }, 
                    { new: true, useFindAndModify: false }
                );
                console.log(`Final update for canvas ${canvasId} completed`);
            } catch (error) {
                console.error(`Error in final update for canvas ${canvasId}:`, error);
            }
        }
    });
    
    await Promise.all(pendingUpdates);
    process.exit(0);
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});