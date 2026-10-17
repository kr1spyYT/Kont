// API entry point
const express = require('express');
const router = require('./handlers');

const app = express();
app.use('/api', router);

module.exports = app;