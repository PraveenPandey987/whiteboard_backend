
const mongoose = require('mongoose');
const validator = require('validator');
const canvasSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shared: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    elements: [{ type: mongoose.Schema.Types.Mixed }],
    sharedEmail: [{
        type: String,
        
        lowercase: true,
        validate: {
            validator: validator.isEmail,
            message: 'Invalid email format',
        }

    }],
    createdAt: { type: Date, default: Date.now }
});

const Canvas = new mongoose.model('Canvas', canvasSchema);
module.exports = Canvas;
