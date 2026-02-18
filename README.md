# 🚀 Instagram Reel Downloader

A fast, secure, and user-friendly web application to download Instagram Reels. Built with Node.js, Express.js, and Bootstrap 5.

## ✨ Features

- **📱 Mobile Responsive**: Works perfectly on all devices
- **⚡ Fast & Easy**: Download reels in seconds
- **🔒 Secure**: No login required, privacy-focused
- **🛡️ Rate Limited**: Prevents abuse with IP-based rate limiting
- **🎨 Modern UI**: Beautiful Bootstrap 5 interface with animations
- **⚠️ Error Handling**: Comprehensive error messages and validation
- **📋 Auto-paste**: Automatically detects Instagram URLs in clipboard
- **⌨️ Keyboard Shortcuts**: Support for Ctrl+V and Enter key

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: EJS templating, Bootstrap 5, Vanilla JavaScript
- **HTTP Client**: Axios
- **Security**: Express Rate Limit, input validation
- **Environment**: dotenv for configuration management

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd instagram-reel-downloader
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
PORT=3000
NODE_ENV=development
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
```

### Step 4: Run the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

### Step 5: Access the Application
Open your browser and navigate to:
```
http://localhost:3000
```

## 🚀 Production Deployment Guide (VPS)

### Step 1: Server Preparation

#### Update System (Ubuntu/Debian)
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Node.js and npm
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Install PM2 Process Manager
```bash
sudo npm install -g pm2
```

#### Install Nginx
```bash
sudo apt install nginx -y
```

### Step 2: Application Setup

#### Clone Repository
```bash
cd /var/www
git clone <your-repo-url>
cd instagram-reel-downloader
```

#### Install Dependencies
```bash
npm install --production
```

#### Set Environment Variables
```bash
sudo nano .env
```

Production `.env`:
```env
PORT=3000
NODE_ENV=production
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
```

### Step 3: PM2 Configuration

#### Create PM2 Ecosystem File
```bash
sudo nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'instagram-reel-downloader',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

#### Start Application with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Set up PM2 to start on boot
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save
```

### Step 4: Nginx Configuration

#### Create Nginx Server Block
```bash
sudo nano /etc/nginx/sites-available/instagram-downloader
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
```

#### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/instagram-downloader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 5: SSL Certificate (Let's Encrypt)

#### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

#### Obtain SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

#### Auto-renewal
```bash
sudo crontab -e
```

Add line:
```
0 12 * * * /usr/bin/certbot renew --quiet
```

### Step 6: Firewall Configuration

#### Configure UFW
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### Step 7: Monitoring & Maintenance

#### PM2 Monitoring
```bash
pm2 monit
pm2 logs
```

#### Log Rotation
```bash
sudo nano /etc/logrotate.d/pm2-logs
```

```
/var/www/instagram-reel-downloader/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### System Updates
```bash
sudo apt update && sudo apt upgrade -y
pm2 restart all
```

## 📁 Project Structure

```
instagram-reel-downloader/
├── server.js                 # Main server file
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables
├── routes/
│   ├── index.js            # Homepage routes
│   └── api.js              # API routes for downloads
├── views/
│   ├── layout.ejs          # Main layout template
│   ├── index.ejs           # Homepage view
│   └── error.ejs           # Error page template
├── public/
│   ├── css/
│   │   └── style.css       # Custom styles
│   └── js/
│       └── main.js         # Client-side JavaScript
└── logs/                   # Log files (created by PM2)
```

## 🔧 Configuration

### Rate Limiting
Configure rate limiting in `.env`:
```env
RATE_LIMIT_WINDOW=60000    # 1 minute in milliseconds
RATE_LIMIT_MAX=10          # Max requests per IP per window
```

### Request Timeout
Set request timeout for Instagram API calls:
```env
REQUEST_TIMEOUT=10000      # 10 seconds
```

## 🛡️ Security Features

- **Input Validation**: URL validation with regex patterns
- **Rate Limiting**: Prevents abuse with IP-based limits
- **XSS Protection**: Input sanitization and CSP headers
- **Error Handling**: No sensitive information exposed
- **HTTPS**: SSL/TLS encryption in production
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.

## 📋 Usage Instructions

1. **Copy Instagram Reel URL**: Open Instagram, find a reel, click the three dots (⋯), select "Copy link"
2. **Paste URL**: Paste the URL in the input field on the homepage
3. **Download**: Click "Download Reel" button
4. **Save Video**: The video will be downloaded to your device

## 🚨 Disclaimer

**Important**: This tool is for educational purposes only. Users are responsible for complying with Instagram's Terms of Service and respecting copyright laws. Only download content you own or have permission to use.

## 🐛 Troubleshooting

### Common Issues

1. **"Could not find video URL"**
   - The reel might be from a private account
   - The content may have been removed
   - Try a different reel URL

2. **"Too many requests"**
   - Wait 1 minute and try again
   - The rate limit is 10 requests per minute per IP

3. **"Network error"**
   - Check your internet connection
   - Try refreshing the page

4. **Application won't start**
   - Check if port 3000 is available: `sudo lsof -i :3000`
   - Verify Node.js installation: `node --version`
   - Check logs: `pm2 logs`

### Debug Mode
Set environment variable for detailed error messages:
```bash
NODE_ENV=development npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Legal Notice

This tool is provided as-is for educational purposes. Users must comply with:
- Instagram's Terms of Service
- Copyright laws and regulations
- Fair use policies

The developers are not responsible for any misuse of this tool.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the GitHub issues
3. Create a new issue with detailed information

---

**Made with ❤️ by the Instagram Reel Downloader Team**