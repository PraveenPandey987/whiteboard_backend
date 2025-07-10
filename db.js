const mongoose = require('mongoose')
require('dotenv').config();
const connectionParams = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};
const mongoURI = process.env.MONGODB_URI;

const connectToDatabse = async () =>{
try{
    await mongoose.connect(mongoURI,connectionParams);
    console.log("database connected succesfully");
}
catch(err){
    console.log("database connection error",err);
}

};

module.exports =connectToDatabse;