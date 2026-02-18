const express = require('express');
const router = express.Router();
const axios = require('axios');
const { instagramGetUrl } = require('instagram-url-direct');

/**
 * Instagram Reel URL validation regex
 * Supports various Instagram URL formats
 */
const INSTAGRAM_REEL_REGEX = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels)\/([a-zA-Z0-9_-]+)(?:\/|\?|$)/i;

/**
 * Validate Instagram Reel URL
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if valid Instagram Reel URL
 */
function isValidInstagramReelUrl(url) {
  return INSTAGRAM_REEL_REGEX.test(url);
}

/**
 * Extract shortcode from Instagram Reel URL
 * @param {string} url - The Instagram reel URL
 * @returns {string|null} - The reel shortcode
 */
function extractShortcode(url) {
  const match = url.match(INSTAGRAM_REEL_REGEX);
  return match ? match[3] : null;
}

/**
 * Decode escaped URL values found in Instagram HTML payloads
 * @param {string} value
 * @returns {string}
 */
function decodeEscapedUrl(value) {
  return value
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

/**
 * Extract video URL from Instagram page HTML
 * @param {string} html - The HTML content of the Instagram page
 * @returns {string|null} - The video URL if found, null otherwise
 */
function extractVideoUrl(html) {
  // Look for og:video / og:video:secure_url meta tags
  const ogVideoMatch = html.match(/<meta[^>]*property=["']og:video(?::secure_url)?["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:video(?::secure_url)?["'][^>]*>/i);
  if (ogVideoMatch && ogVideoMatch[1]) {
    return decodeEscapedUrl(ogVideoMatch[1]);
  }

  // Alternative: Look for video URL in JSON data
  const jsonDataMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]*)<\/script>/i);
  if (jsonDataMatch && jsonDataMatch[1]) {
    try {
      const jsonData = JSON.parse(jsonDataMatch[1]);
      if (jsonData.video && jsonData.video.contentUrl) {
        return decodeEscapedUrl(jsonData.video.contentUrl);
      }
    } catch (error) {
      console.error('Error parsing JSON-LD data:', error);
    }
  }

  // Look for serialized video_url in script payloads
  const serializedMatch = html.match(/"video_url":"([^"]+)"/i)
    || html.match(/"contentUrl":"([^"]+)"/i);
  if (serializedMatch && serializedMatch[1]) {
    return decodeEscapedUrl(serializedMatch[1]);
  }

  return null;
}

/**
 * Fetch Instagram reel page HTML with fallback endpoints
 * @param {string} shortcode
 * @returns {Promise<string>}
 */
async function fetchInstagramHtml(shortcode) {
  const candidateUrls = [
    `https://www.instagram.com/reel/${shortcode}/`,
    `https://www.instagram.com/reels/${shortcode}/`,
    `https://www.instagram.com/reel/${shortcode}/embed/`
  ];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.instagram.com/'
  };

  let lastError;
  for (const candidateUrl of candidateUrls) {
    try {
      const response = await axios.get(candidateUrl, {
        headers,
        timeout: 15000,
        maxRedirects: 5
      });

      if (typeof response.data === 'string' && response.data.length > 0) {
        return response.data;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to fetch Instagram HTML');
}

/**
 * Try extracting video URL via instagram-url-direct package.
 * @param {string} reelUrl
 * @returns {Promise<string|null>}
 */
async function extractVideoUrlWithPackage(reelUrl) {
  try {
    const data = await instagramGetUrl(reelUrl);
    if (!data) {
      return null;
    }

    if (Array.isArray(data.media_details)) {
      const videoMedia = data.media_details.find((media) => media && media.type === 'video' && media.url);
      if (videoMedia && videoMedia.url) {
        return videoMedia.url;
      }
    }

    if (Array.isArray(data.url_list)) {
      const firstVideoUrl = data.url_list.find((value) => typeof value === 'string' && /\.mp4(\?|$)/i.test(value));
      if (firstVideoUrl) {
        return firstVideoUrl;
      }
    }

    return null;
  } catch (error) {
    console.error('instagram-url-direct fallback failed:', error.message);
    return null;
  }
}

/**
 * Build a safe local download URL
 * @param {string} videoUrl
 * @returns {string}
 */
function buildDownloadUrl(videoUrl) {
  return `/api/download-file?videoUrl=${encodeURIComponent(videoUrl)}`;
}

/**
 * POST /api/download
 * Download Instagram Reel
 * Expects JSON body with { url: 'instagram_reel_url' }
 */
router.post('/download', async (req, res) => {
  try {
    const { url } = req.body;

    // Validate input
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an Instagram Reel URL'
      });
    }

    // Validate Instagram Reel URL format
    if (!isValidInstagramReelUrl(url)) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid Instagram Reel URL. Example: https://www.instagram.com/reel/ABC123DEF/'
      });
    }

    const shortcode = extractShortcode(url);
    if (!shortcode) {
      return res.status(400).json({
        success: false,
        error: 'Could not extract reel identifier from the URL.'
      });
    }

    try {
      // Fetch the Instagram page
      const html = await fetchInstagramHtml(shortcode);

      // Extract video URL from HTML, then try fallback package
      let videoUrl = extractVideoUrl(html);
      if (!videoUrl) {
        videoUrl = await extractVideoUrlWithPackage(`https://www.instagram.com/reel/${shortcode}/`);
      }

      if (!videoUrl) {
        return res.status(404).json({
          success: false,
          error: 'Could not find video URL. The reel might be private or unavailable.'
        });
      }

      // Return the video URL
      res.json({
        success: true,
        videoUrl,
        downloadUrl: buildDownloadUrl(videoUrl),
        message: 'Video URL extracted successfully'
      });

    } catch (axiosError) {
      if (axiosError.response) {
        // Instagram returned an error response
        if (axiosError.response.status === 404) {
          return res.status(404).json({
            success: false,
            error: 'Reel not found. The link might be broken or the content was removed.'
          });
        } else if (axiosError.response.status === 403) {
          return res.status(403).json({
            success: false,
            error: 'Access denied. The reel might be from a private account.'
          });
        }
      }
      
      // Network or other error
      console.error('Axios error:', axiosError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch the Instagram page. Please try again later.'
      });
    }

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    });
  }
});

/**
 * GET /api/download-file
 * Proxies the remote video and forces browser download.
 */
router.get('/download-file', async (req, res) => {
  try {
    const { videoUrl } = req.query;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing videoUrl query parameter'
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(videoUrl);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid video URL format'
      });
    }

    const allowedHostPatterns = [/\.cdninstagram\.com$/i, /\.fbcdn\.net$/i, /\.instagram\.com$/i];
    const isAllowedHost = allowedHostPatterns.some((pattern) => pattern.test(parsedUrl.hostname));

    if (!isAllowedHost) {
      return res.status(400).json({
        success: false,
        error: 'Video host is not allowed'
      });
    }

    const upstreamResponse = await axios.get(videoUrl, {
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/'
      }
    });

    const contentType = upstreamResponse.headers['content-type'] || 'application/octet-stream';
    if (!contentType.includes('video') && !contentType.includes('octet-stream')) {
      return res.status(400).json({
        success: false,
        error: 'Upstream resource is not a downloadable video'
      });
    }

    const filename = `instagram-reel-${Date.now()}.mp4`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (upstreamResponse.headers['content-length']) {
      res.setHeader('Content-Length', upstreamResponse.headers['content-length']);
    }

    upstreamResponse.data.on('error', (streamError) => {
      console.error('Stream error:', streamError.message);
      if (!res.headersSent) {
        res.status(500).end('Failed to stream video');
      } else {
        res.end();
      }
    });

    upstreamResponse.data.pipe(res);
  } catch (error) {
    console.error('Download file error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Unable to download file at the moment. Please try again later.'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;