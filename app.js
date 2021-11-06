const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const globalErrorHandler = require('./controllers/errorControllers');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');
const AppError = require('./utils/appError');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

/*****************************************************
 *                  MIDDLEWARES
 *****************************************************/

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security http headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(bodyParser.json({ limit: '10kb' }));
// Parse data coming from a url encoded form
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// Parses the data from the cookie
app.use(cookieParser());

// Data Sanitization against NOSQL query injection
app.use(mongoSanitize());

// Data Sanitization against XSS
app.use(xss());

// Prevent pollution parameter
app.use(
    hpp({
        whitelist: [
            'duration',
            'ratingsQuantity',
            'ratingsAverage',
            'maxGroupSize',
            'difficulty',
            'price',
        ],
    })
);

app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    // console.log(req.cookies);
    next();
});

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/booking', bookingRouter);

app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;

/*
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Hello from the server side!',
        app: 'Test',
    });
    // const html = '<h1>Hello frens</h1>';
    // res.status(200).send(html);
});

app.post('/', (req, res) => {
    res.send('You can post do this endpoint.....');
});
*/

/*
// Create Operating
app.post('/api/v1/tours', createTour);

// Read Operation
// We could also add optional params by putting a ? at the end of the var name
app.get('/api/v1/tours', getAllTours);
app.get('/api/v1/tours/:id', getTour);

// Update Operation
app.patch('/api/v1/tours/:id', updateTour);

// Delete Operation
app.delete('/api/v1/tours/:id', deleteTour);
*/

// app.use((req, res, next) => {
//     console.log('Hello from the middleware');
//     next();
// });