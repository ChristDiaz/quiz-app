function validateFields(allowedFields, typeSchema = {}) {
    return (req, res, next) => {
      const incomingFields = Object.keys(req.body);
  
      const invalidFields = incomingFields.filter(field => !allowedFields.includes(field));
      if (invalidFields.length > 0) {
        return res.status(400).json({ 
          message: 'Invalid fields in request', 
          invalidFields 
        });
      }
  
      // Check types if typeSchema is provided
      for (const [field, expectedType] of Object.entries(typeSchema)) {
        const value = req.body[field];
        if (value !== undefined) {
          if (expectedType === 'array' && !Array.isArray(value)) {
            return res.status(400).json({
              message: `Invalid type for field '${field}': expected array`,
            });
          }
          if (expectedType === 'string' && typeof value !== 'string') {
            return res.status(400).json({
              message: `Invalid type for field '${field}': expected string`,
            });
          }
        }
      }
  
      next();
    };
  }
  
  module.exports = validateFields;