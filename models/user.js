const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');
const userSchema = new mongoose.Schema({

    name: {

        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        validate: {
            validator: validator.isEmail,
            message: 'Invalid email format',
        }

    },
    password: {
        type: String,
        required: true,
        validate: {
            validator: (value) => 
                validator.isStrongPassword(value, {
                    minLength: 8,
                    minLowercase: 1,
                    minUppercase: 1,
                    minNumbers: 1,
                    minSymbols: 1
                })
            ,
             message: 'Password must be at least 8 characters long and include an uppercase letter, a number, and a special character.'
        }
    },
  



});


userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.statics.register = async function (userData) {
    const user = new this(userData);
    return await user.save();
};

userSchema.methods.comparePassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};


userSchema.statics.getUser = async function (email) {
    return await this.findOne({email});
};



const User = mongoose.model('User', userSchema);
module.exports = User;