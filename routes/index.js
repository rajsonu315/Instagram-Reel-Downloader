const express = require('express');
const router = express.Router();

/**
 * Homepage route
 * Renders the main page with the Instagram Reel downloader form
 */
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Instagram Reel Downloader',
    description: 'Download Instagram Reels easily and quickly'
  });
});

module.exports = router;