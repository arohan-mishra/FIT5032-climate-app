const { onRequest } = require('firebase-functions/v2/https')
const logger = require('firebase-functions/logger')

exports.apiStatus = onRequest({ cors: true }, (request, response) => {
  logger.info('API status checked')

  response.status(200).json({
    message: 'Pedal Melbourne API is running',
  })
})
