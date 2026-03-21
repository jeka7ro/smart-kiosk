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

module.exports = { protect, restrictTo };
