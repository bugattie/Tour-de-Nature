const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = id => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

const createAndSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);
    const cookieOptions = {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true, // Cannot be accessed or modified in any way by the browser
    };

    if (process.env.NODE_ENV === 'production') cookieOptions.secure = true; // only secure connections e.g https

    res.cookie('jwt', token, cookieOptions);
    // Remove the password from the output
    user.password = undefined;
    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user,
        },
    });
};

exports.signup = catchAsync(async(req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
    });

    const url = `${req.protocol}://${req.get ('host')}/me`;
    await new Email(newUser, url).sendWelcome();

    createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async(req, res, next) => {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
        return next(new AppError('Please provide email or password!', 400));
    }
    // 2) Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password');

    if (!user || !await user.correctPassword(password, user.password)) {
        return next(new AppError('Incorrect email or password', 401));
    }

    // 3. IF everything okay, send token to client
    createAndSendToken(user, 200, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async(req, res, next) => {
    let token;
    // 1. Getting token and check if it's exists
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(
            new AppError('You are not logged in! Please login to get access'),
            401
        );
    }

    // 2. Verification token
    // if someone manipulated the data or token is already expired.
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3. Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(
            new AppError(
                'The user belonging to this token does no longer exists.',
                401
            )
        );
    }

    // 4. Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(
            new AppError('User recently changed password. Please login again!', 401)
        );
    }

    // Putting the entire user data to request
    req.user = currentUser;
    // Make user accessible to our templates
    res.locals.user = currentUser;

    // Grant access to protected routes
    next();
});

// Only for rendered pages, no error
exports.isLoggedIn = async(req, res, next) => {
    if (req.cookies.jwt) {
        try {
            // 1. Verification token
            // if someone manipulated the data or token is already expired.
            const decoded = await promisify(jwt.verify)(
                req.cookies.jwt,
                process.env.JWT_SECRET
            );

            // 2. Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next();
            }

            // 3. Check if user changed password after the token was issued
            if (currentUser.changedPasswordAfter(decoded.iat)) {
                return next();
            }

            // There is a logged in user
            // Make user accessible to our templates
            res.locals.user = currentUser;

            // Grant access to protected routes
            return next();
        } catch (err) {
            return next();
        }
    }
    next();
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('You donot have persmission to perform this action.', 403)
            );
        }

        next();
    };
};

exports.forgotPassword = catchAsync(async(req, res, next) => {
    // 1. Get user based on POSTed email
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return next(
            new AppError('There is not error with this email address'),
            404
        );
    }

    // 2. Generate a random token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
        // 3. Send it to users email
        const resetURL = `${req.protocol}://${req.get ('host')}/api/v1/users/resetPassword/${resetToken}`;
        await new Email(user, resetURL).sendPasswordReset();

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!',
        });
    } catch (err) {
        user.createPasswordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(
            new AppError(
                'There was an error sending the email. Try again later!',
                500
            )
        );
    }

    next();
});

exports.resetPassword = catchAsync(async(req, res, next) => {
    // 1. Get user based on the token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });

    // 2. If token has expired, and there is user, set the new password
    if (!user) {
        return next(new AppError('Token in invalid or has expired'), 400);
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3. Update changedPasswordAt property for the user

    // 4. Log the user in, send the JWT
    createAndSendToken(user, 200, res);

    next();
});

exports.updatePassword = catchAsync(async(req, res, next) => {
    // 1. Get user from collection
    const user = await User.findById(req.user.id).select('+password');

    // 2. Check if POSTed current password is correct
    if (!await user.correctPassword(req.body.currentPassword, user.password)) {
        return next(new AppError('Your current password is wrong', 401));
    }

    // 3. If so, update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // 4. Log user in, send JWT
    createAndSendToken(user, 200, res);

    next();
});