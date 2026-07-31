const jwt = require('jsonwebtoken');
require('dotenv').config();

// Verifies the JWT sent in the Authorization header (Bearer token)
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided. Please log in.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token. Please log in again.' });
  }
}

// Restricts a route to specific roles, e.g. authorize('admin', 'dco')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
