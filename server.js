/**
 * Web Application Server for Digital Student Card Wallet Passes
 * Generates Google Wallet passes based on user input
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuration
const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
const classId = `${issuerId}.student_card_class`;

/**
 * Create Google Wallet credentials
 */
function getCredentials() {
  const credentialsPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at: ${credentialsPath}`);
  }
  
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });
}

/**
 * Create a Google Wallet pass object for a student
 */
async function createPassObject(studentData) {
  const auth = getCredentials();
  const walletobjects = google.walletobjects({
    version: 'v1',
    auth: auth,
  });

  const sanitizedId = studentData.studentId.replace(/[^a-zA-Z0-9]/g, '_');
  if (!sanitizedId) {
    throw new Error('Student ID must contain at least one alphanumeric character');
  }
  const objectId = `${issuerId}.${sanitizedId}`;

  const genericObject = {
    id: objectId,
    classId: classId,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    hexBackgroundColor: '#4285f4',
    logo: {
      sourceUri: {
        uri: 'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg',
      },
    },
    cardTitle: {
      defaultValue: {
        language: 'en',
        value: 'Student Card',
      },
    },
    subheader: {
      defaultValue: {
        language: 'en',
        value: 'Digital Student ID',
      },
    },
    header: {
      defaultValue: {
        language: 'en',
        value: studentData.studentName,
      },
    },
    textModulesData: [
      {
        id: 'student_name',
        header: 'Name',
        body: studentData.studentName,
      },
      {
        id: 'student_id',
        header: 'Student ID',
        body: studentData.studentId,
      },
      {
        id: 'course',
        header: 'Course',
        body: studentData.course,
      },
      {
        id: 'year',
        header: 'Year',
        body: studentData.year,
      },
    ],
    barcode: {
      type: 'QR_CODE',
      value: studentData.studentId,
    },
  };

  try {
    // Try to get the object first
    const response = await walletobjects.genericobject.get({
      resourceId: objectId,
    });
    console.log('Object already exists:', response.data.id);
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Object doesn't exist, create it
      try {
        const response = await walletobjects.genericobject.insert({
          requestBody: genericObject,
        });
        console.log('Object created successfully:', response.data.id);
        return response.data;
      } catch (insertErr) {
        console.error('Error creating object:', insertErr.response ? insertErr.response.data : insertErr.message);
        throw insertErr;
      }
    } else {
      console.error('Error checking object:', err.response ? err.response.data : err.message);
      throw err;
    }
  }
}

/**
 * Generate the "Add to Google Wallet" link
 */
function generateAddToWalletLink(objectId) {
  const baseUrl = 'https://pay.google.com/gp/v/save/';
  const payload = {
    genericObjects: [
      {
        id: objectId,
      },
    ],
  };
  
  const jsonPayload = JSON.stringify(payload);
  const encodedPayload = Buffer.from(jsonPayload).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return `${baseUrl}${encodedPayload}`;
}

// Routes

// Home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create student pass
app.post('/api/create-pass', apiLimiter, async (req, res) => {
  try {
    const { studentName, studentId, course, year } = req.body;

    // Validate input
    if (!studentName || !studentId || !course || !year) {
      return res.status(400).json({
        error: 'All fields are required: studentName, studentId, course, year',
      });
    }

    // Create the pass object
    const passObject = await createPassObject({
      studentName,
      studentId,
      course,
      year,
    });

    // Generate the add to wallet link
    const addToWalletLink = generateAddToWalletLink(passObject.id);

    res.json({
      success: true,
      passId: passObject.id,
      addToWalletLink: addToWalletLink,
    });
  } catch (error) {
    console.error('Error creating pass:', error);
    res.status(500).json({
      error: 'Failed to create pass',
      message: error.message,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Make sure to create the pass class first by running: npm run create-class');
});

module.exports = app;
