# Digital Student Card - Wallet Pass Generator

Generate digital student cards that can be saved to your device's wallet using Google Wallet technology. Each card includes a QR code for verification.

## Features

- 🎓 Web-based form for student information input
- 📱 Generate Google Wallet passes
- 🔐 Secure QR code generation for student verification
- 🎨 Beautiful, responsive UI
- 🚀 Easy deployment

## Google Wallet Integration

This application creates **generic passes** for Google Wallet with the following information:
- Student Name
- Student ID
- Course/Program
- Academic Year
- QR Code with student ID for verification

## Setup Instructions

### Prerequisites

1. **Node.js** (v14 or higher)
2. **Google Cloud Account** with Wallet API enabled
3. **Service Account Key** from Google Cloud

### Google Wallet Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Wallet API**
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Download the JSON key file
5. Get your Issuer ID:
   - Go to [Google Pay & Wallet Console](https://pay.google.com/business/console)
   - Note your Issuer ID

### Installation

1. Clone the repository:
```bash
git clone https://github.com/KieronOei/soc-digital-student-card.git
cd soc-digital-student-card
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` file with your credentials:
```
GOOGLE_WALLET_ISSUER_ID=your_issuer_id_here
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
PORT=3000
```

### Usage

#### Step 1: Create Google Wallet Pass Class

Run this script once to create the pass class template:

```bash
npm run create-class
```

This creates a reusable template for all student cards.

#### Step 2: Start the Web Application

Start the server:

```bash
npm start
```

The application will be available at `http://localhost:3000`

#### Step 3: Generate Student Cards

1. Open your browser to `http://localhost:3000`
2. Fill in the student information form:
   - Full Name
   - Student ID
   - Course/Program
   - Academic Year
3. Click "Generate Student Card"
4. Click "Add to Google Wallet" to save the pass

## Project Structure

```
soc-digital-student-card/
├── scripts/
│   └── create-google-pass-class.js  # Script to create pass class
├── public/
│   ├── index.html                   # Web form UI
│   ├── styles.css                   # Styling
│   └── script.js                    # Client-side logic
├── server.js                        # Express server & pass object creation
├── package.json                     # Dependencies
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore rules
└── README.md                        # Documentation
```

## API Endpoints

### `POST /api/create-pass`

Creates a Google Wallet pass object for a student.

**Request Body:**
```json
{
  "studentName": "John Doe",
  "studentId": "S12345678",
  "course": "Computer Science",
  "year": "2023-2024"
}
```

**Response:**
```json
{
  "success": true,
  "passId": "issuer_id.student_id",
  "addToWalletLink": "https://pay.google.com/gp/v/save/..."
}
```

### `GET /health`

Health check endpoint.

## Apple Wallet Support

Apple Wallet support is planned for future releases. The current implementation focuses on Google Wallet integration.

## Security Notes

- Never commit `.env` files or service account keys to version control
- Store service account keys securely
- Use environment variables for all sensitive configuration
- Implement proper authentication for production deployments

## Troubleshooting

### "Cannot find module" errors
Make sure you've run `npm install` to install all dependencies.

### "Invalid credentials" errors
- Verify your service account key path in `.env`
- Ensure the service account has the correct permissions
- Check that the Google Wallet API is enabled

### "Class not found" errors
Run `npm run create-class` to create the pass class before generating passes.

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.
