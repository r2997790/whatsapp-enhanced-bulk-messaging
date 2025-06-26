# Enhanced WhatsApp Messaging with Bulk Functionality

🚀 **BULK MESSAGING NOW ACTIVATED!** Professional WhatsApp automation platform with enhanced bulk messaging capabilities.

## ✨ Features

- **📱 Single Message**: Send individual messages to specific contacts
- **📢 Bulk Messaging**: Send messages to multiple contacts at once (NOW ACTIVE!)
- **⚡ Smart Formatting**: Automatic WhatsApp text formatting support
- **🔐 QR Authentication**: Secure WhatsApp Web integration
- **👥 Contact Management**: (Coming Soon)
- **📝 Message Templates**: (Coming Soon)
- **📊 Analytics & Logs**: (Coming Soon)

## 🎯 What's New in v6.0.0

- ✅ **Bulk messaging functionality fully activated**
- ✅ **Enhanced UI with mode switching**
- ✅ **Progress tracking for bulk sends**
- ✅ **Support for up to 50 contacts per bulk send**
- ✅ **Detailed send results and status**
- ✅ **Smart number parsing (comma or line-separated)**

## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/https://github.com/r2997790/whatsapp-enhanced-bulk-messaging)

## 📋 Requirements

- Node.js 18+
- WhatsApp account
- Modern web browser

## 🛠️ Local Installation

1. Clone the repository:
```bash
git clone https://github.com/r2997790/whatsapp-enhanced-bulk-messaging.git
cd whatsapp-enhanced-bulk-messaging
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and go to `http://localhost:8080`

## 📱 How to Use

### Single Messaging
1. Connect your WhatsApp by scanning the QR code
2. Select "Single Message" mode
3. Enter phone number (with country code)
4. Type your message
5. Click "Send Message"

### Bulk Messaging
1. Connect your WhatsApp by scanning the QR code
2. Select "Bulk Messaging" mode
3. Enter phone numbers (one per line or comma-separated)
4. Type your message
5. Click "Send Bulk Messages"
6. Monitor progress and results

## 📞 Phone Number Format

- **US**: 1234567890
- **UK**: 441234567890
- **India**: 919876543210
- **General**: [country_code][phone_number]

## 💬 Message Formatting

WhatsApp supports rich text formatting:
- **Bold**: `*text*`
- *Italic*: `_text_`
- ~~Strikethrough~~: `~text~`

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```
PORT=8080
NODE_ENV=production
SESSION_SECRET=your-session-secret-here
```

### Bulk Messaging Limits

- Maximum 50 phone numbers per bulk send
- 2-second delay between messages
- Automatic error handling and retry logic

## 🔐 Security & Compliance

- QR authentication ensures secure connection
- No message storage on servers
- Session data stored locally
- Rate limiting protection
- WhatsApp ToS compliant

## 🚨 Important Notes

- This tool is for **educational and legitimate business use only**
- Please comply with **WhatsApp's Terms of Service**
- Respect recipient privacy and consent
- Use responsibly for business communications

## 🐛 Troubleshooting

### Common Issues

1. **QR Code not appearing**: Click "Reset Connection"
2. **Connection timeout**: Wait 10 seconds and try again
3. **Messages not sending**: Check phone number format
4. **Bulk send failures**: Verify numbers and connection

### Support

For issues and questions:
- Check the application logs in the browser console
- Verify WhatsApp connection status
- Ensure proper phone number formatting

## 📊 API Endpoints

- `POST /api/send-message` - Send single message
- `POST /api/send-bulk` - Send bulk messages
- `GET /api/status` - Check connection status
- `POST /api/reset` - Reset connection

## 🛡️ License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**⚠️ Disclaimer**: This software is provided as-is for educational purposes. Users are responsible for complying with WhatsApp's Terms of Service and applicable laws.