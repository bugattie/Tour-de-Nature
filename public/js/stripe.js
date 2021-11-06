/* eslint-disable */

import axios from 'axios';
import { showAlert } from './alerts';

const stripe = Stripe(
    'pk_test_51Gw3cnGYuP8OZLXD9KIMT2dJ2otaDo4nOSQoqLXoTfwBHmgNLqwE1YRZJKobAb0VfbfjNQmOLe0HXUGXsYoyUxii00uzeHcfRX'
);

export const bookTour = async tourId => {
    try {
        // 1) Get checkout session from API
        const session = await axios(`/api/v1/booking/checkout-session/${tourId}`);
        console.log(session);

        // 2) Create checkout form + chanre credit card
        await stripe.redirectToCheckout({
            sessionId: session.data.session.id,
        });
    } catch (err) {
        console.log(err);
        showAlert('error', err);
    }
};