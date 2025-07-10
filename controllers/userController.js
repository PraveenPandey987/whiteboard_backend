

const User = require('../models/user');
const jwt = require('jsonwebtoken');
require('dotenv').config();

function create_jwt_token(data) {

  const token = jwt.sign(data, process.env.JWT_SECRET_KEY, { expiresIn: '3d' });
  const refresh_token = jwt.sign(data, process.env.JWT_REFRESH_SECRET_KEY, { expiresIn: '7d' });
  return { token, refresh_token };
}
const register = async (req, res) => {


  try {
    const newUser = new User(req.body);

    const savedUser = await User.register(newUser);


    const data = {
      email: savedUser.email,
      _id: savedUser._id,


    }


    const { token, refresh_token } = create_jwt_token(data);
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/token',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });


    res.setHeader('Authorization', `Bearer ${token}`)
    res.status(201).json(savedUser);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getUser = async (req, res) => {
  try {



    const user = await User.getUser(req.user.email);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const { _id } = user;
    const { token, refresh_token } = create_jwt_token({ email, _id });
   

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/token',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.setHeader('Authorization', `Bearer ${token}`);
    res.status(200).json(user);
  }
  catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error. Please try again later." });
  }


};



module.exports = { login, register, getUser };
