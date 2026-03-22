const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      req.user = decoded; // { id, email, role, locations }
      
      // Global read-only enforcement for demo role
      if (req.user.role === 'demo' && !['GET', 'OPTIONS'].includes(req.method)) {
        return res.status(403).json({ error: 'Read-only mode. Modificările sunt dezactivate pentru contul Demo.' });
      }

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acțiune interzisă pentru rolul tău.' });
    }
    next();
  };
};

const requireApiKey = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  const apiKey = req.headers['x-api-key'] || req.query.apikey;
  const validKey = process.env.VITE_API_KEY || 'sk-live-2024-secure';

  if (apiKey === validKey) {
    return next();
  }
  
  let jwtError = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      return next(); 
    } catch (e) {
      jwtError = e.message;
    }
  }

  res.status(401).json({ 
    error: 'Unauthorized API Access. Missing or invalid API Key.', 
    jwtDetail: jwtError 
  });
};

module.exports = { protect, restrictTo, requireApiKey };
