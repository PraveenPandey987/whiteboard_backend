const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
  const authHeader = req.header('Authorization');
  
  // Check if Authorization header exists
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  // Extract token
  const token = authHeader.replace('Bearer ', '');

  
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_key);
    
    req.user = decoded;
    
    next();
  } catch (err) {
    console.log('JWT Error:', err.message); 

    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authenticateUser;