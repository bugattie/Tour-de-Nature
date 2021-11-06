module.exports = fn => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

/* Why catch(next) only? In JS, we could simplify it like this, all we need to pass in here is the function and it will then be called automatically with the parameter that this callback receives. */