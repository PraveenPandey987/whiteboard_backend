const Canvas = require('../models/canvas');

const User = require('../models/user');
const getUserCanvases = async (req, res) => {
    try {
        const { _id } = req.user;
        const canvases = await Canvas.find({
            $or: [{ owner: _id }, { shared: _id }]
        }).sort({ createdAt: -1 });

        res.json(canvases);
    }
    catch (err) {
        console.log("error fetching canvases ", err.message);
    }
}

const loadCanvas = async (req, res) => {

    try {
        const userId = req.user._id;
        const canvasId = req.params.id;
        const canvas = await Canvas.findById(canvasId);
        if (!canvas) {
            return res.status(404).json({ error: "Canvas not found" });
        }

        if (canvas.owner.toString() !== userId && !canvas.shared.includes(userId)) {
            return res.status(403).json({ error: "Unauthorized to access this canvas" });
        }

        res.json(canvas);
    } catch (error) {
        res.status(500).json({ error: "Failed to load canvas", details: error.message });
    }


}

const createCanvas = async (req, res) => {

    try {
        const id = req.user._id;
        const name = req.query.name;
        const newCanvas = new Canvas({
            name: name,
            owner: id,
            elements: [],
            shared: [],
            sharedEmail: [],
            
        });
        await newCanvas.save();

        res.status(201).json(newCanvas);
    } catch (error) {
        res.status(500).json({ error: "Failed to create canvas", details: error.message });
    }

}

const updateCanvas = async (req, res) => {

    try {
        const { elements, id } = req.body;
      
        const userId = req.user._id;
    
        const canvas = await Canvas.findById(id);
        if (!canvas) {
            return res.status(404).json({ error: "canvas not found" });
        }


        if (canvas.owner.toString() !== userId && !canvas.shared.includes(userId)) {
            return res.status(403).json({ error: "Unauthorized to update this canvas" });
        }
        canvas.elements = elements;

        await canvas.save();
        console.log("saved")
        res.json({ message: "Canvas updated successfully" });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to update canvas", details: err.message });
    }
}

const deleteCanvas = async (req,res) =>{

    try {
        const canvasId = req.params.canvasId;
        const userId = req.user._id;
        console.log(canvasId);
        const canvas = await Canvas.findById(canvasId);
        if (!canvas) {
            return res.status(404).json({ error: "Canvas not found" });
        }

        if (canvas.owner.toString() !== userId) {
            return res.status(403).json({ error: "Only the owner can delete this canvas" });
        }

        await Canvas.findByIdAndDelete(canvasId);
        res.json({ message: "Canvas deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete canvas", details: error.message });
    }
}

const shareCanvas = async(req,res)=>{
   
    const userId= req.user._id;
    console.log(userId)
    const canvasId = req.params.id;
    const {email} = req.body; 
const userToShare = await User.findOne({ email });
if (!userToShare) {
    return res.status(404).json({ error: "User with this email not found" });
}

const canvas = await Canvas.findById(canvasId);
if (!canvas || canvas.owner.toString() !== userId) {
    return res.status(403).json({ error: "Only the owner can share this canvas" });
}

const sharedUserId = userToShare._id;
if (canvas.owner.toString() === sharedUserId.toString()) {
    return res.status(400).json({ error: "Owner cannot be added to shared list" });
}
if (canvas.shared.some(id => id.toString() === sharedUserId.toString())) {
    return res.status(400).json({ error: "Already shared with user" });
}


canvas.shared.push(sharedUserId);
canvas.sharedEmail.push(email);
const newCanvas = await canvas.save();
res.status(201).json(newCanvas);

}
module.exports = { shareCanvas,getUserCanvases, loadCanvas, createCanvas, updateCanvas, deleteCanvas};