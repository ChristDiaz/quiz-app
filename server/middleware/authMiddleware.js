const jwt = require('jsonwebtoken');

// Load the secret key from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Check if the secret key is loaded, fail fast if not configured
if (!JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    process.exit(1); // Exit the application if the secret is missing
}

const authMiddleware = (req, res, next) => {
    // 1. Get token from header
    const authHeader = req.headers.authorization;

    // 2. Check if token exists and has correct format ('Bearer <token>')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Auth Middleware: No token or invalid format');
        return res.status(401).json({ message: 'Authentication failed: No token provided or invalid format.' });
    }

    // 3. Extract token
    const token = authHeader.split(' ')[1];

    try {
        // 4. Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // 5. Attach user info to request object
        // !!! PLACEHOLDER LOGIC - Requires User Model & JWT Payload !!!
        // This assumes your JWT payload (once created during login) will have
        // a field named 'id' or '_id' containing the MongoDB user ObjectId.
        // Adjust this ('decoded.id || decoded._id') if your payload structure is different.
        if (!decoded.id && !decoded._id) {
             console.error('Auth Middleware: JWT payload missing user ID (expected "id" or "_id"). This needs to be set during token creation (login/signup).');
             // Even though we don't have users yet, we enforce the expected payload structure.
             return res.status(401).json({ message: 'Authentication failed: Invalid token payload structure.' });
        }
        req.user = {
            id: decoded.id || decoded._id // Make user ID available as req.user.id
        };
        // !!! END PLACEHOLDER LOGIC !!!

        console.log(`Auth Middleware: User ${req.user.id} authenticated (based on token).`);
        next();

    } catch (error) {
        console.error('Auth Middleware: Token verification failed:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Authentication failed: Token expired.' });
        }
        // For any other verification error (invalid signature, etc.)
        return res.status(401).json({ message: 'Authentication failed: Invalid token.' });
    }
};

module.exports = authMiddleware;
