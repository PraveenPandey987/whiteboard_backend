
const jwt = require('jsonwebtoken');
require('dotenv').config();

function create_jwt_token(data) {

    const token = jwt.sign(data, process.env.JWT_SECRET_KEY, { expiresIn: '3d' });
    
    return token;
}
const refreshTokenController = async (req, res)=>{
  
 
      const refreshToken =  req.cookies.refresh_token;
     

        if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }
   try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET_KEY);
    const token = create_jwt_token({email: decoded.email, _id: decoded._id});
    res.setHeader('Authorization',`Bearer ${token}`);
    res.json({ message: 'new token is create', user: decoded });
  } catch (err) {
    return res.status(403).json({ message: 'Invalid refresh token' });
  }
}

module.exports = refreshTokenController