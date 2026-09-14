// Middleware to expose the current CSRF token to every rendered view
function exposeCsrfToken(req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    next();
}

module.exports = exposeCsrfToken;
