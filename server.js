/**
 * Web Application Server for Digital Student Card Wallet Passes
 * Generates Google Wallet passes based on user input
 */

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { auth, walletobjects } = require("@googleapis/walletobjects");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// More permissive rate limiter for static content
const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Higher limit for static content
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Configuration
const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
const classId = `${issuerId}.student_card_class`;

/**
 * Create Google Wallet credentials
 */
function getServiceAccountCredentials() {
  const credentialsPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  if (!credentialsPath || credentialsPath === ".") {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS must be set to a service account JSON file path",
    );
  }

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at: ${credentialsPath}`);
  }

  return JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
}

function getCredentials() {
  const credentials = getServiceAccountCredentials();
  return new auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
}

/**
 * Create a Google Wallet pass object for a student
 */
async function createPassObject(studentData) {
  console.log("studentData:", JSON.stringify(studentData));
  const jwtClient = getCredentials();
  const walletClient = walletobjects({ version: "v1", auth: jwtClient });

  const sanitizedId = studentData.studentId.replace(/[^a-zA-Z0-9]/g, "_");
  if (!sanitizedId) {
    throw new Error(
      "Student ID must contain at least one alphanumeric character",
    );
  }
  const objectId = `${issuerId}.${sanitizedId}`;

  const genericObject = {
    id: objectId,
    classId: classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    logo: {
      sourceUri: {
        uri: "https://ires.ubc.ca/files/2020/05/national-university-of-singapore-nus-logo-singapore.jpg",
      },
    },
    cardTitle: {
      defaultValue: {
        language: "en-US",
        value: "[DEMO] eCard",
      },
    },
    subheader: {
      defaultValue: {
        language: "en-US",
        value: "Student",
      },
    },
    header: {
      defaultValue: {
        language: "en",
        value: studentData.studentId,
      },
    },
    textModulesData: [
      {
        id: "student_id",
        header: "Student ID",
        body: studentData.studentId,
      },
      {
        id: "career",
        header: "Career",
        body: studentData.career,
      },
      {
        id: "admit_term",
        header: "Admit Term",
        body: studentData.admitTerm,
      },
    ],
    hexBackgroundColor: "#ffffff",
  };

  try {
    // Try to get the object first
    const response = await walletClient.genericobject.get({
      resourceId: objectId,
    });
    console.log("Object already exists:", response.data.id);
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Object doesn't exist, create it
      try {
        const response = await walletClient.genericobject.insert({
          requestBody: genericObject,
        });
        console.log("Object created successfully:", response.data.id);
        return response.data;
      } catch (insertErr) {
        console.error(
          "Error creating object:",
          insertErr.response ? insertErr.response.data : insertErr.message,
        );
        throw insertErr;
      }
    } else {
      console.error(
        "Error checking object:",
        err.response ? err.response.data : err.message,
      );
      throw err;
    }
  }
}

/**
 * Generate the "Add to Google Wallet" link
 */
function generateAddToWalletLink(objectId, origins) {
  const baseUrl = "https://pay.google.com/gp/v/save/";
  const credentials = getServiceAccountCredentials();

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    origins,
    typ: "savetowallet",
    payload: {
      genericObjects: [
        {
          id: objectId,
        },
      ],
    },
  };

  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: "RS256",
  });

  return `${baseUrl}${token}`;
}

// Routes

// Home page
app.get("/", staticLimiter, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Create student pass
app.post("/api/create-pass", apiLimiter, async (req, res) => {
  try {
    const { studentId, career, admitTerm } = req.body;

    // Validate input
    if (!studentId || !career || !admitTerm) {
      return res.status(400).json({
        error: "All fields are required: studentId, career, admitTerm",
      });
    }

    // Create the pass object
    const passObject = await createPassObject({
      studentId,
      career,
      admitTerm,
    });

    // Generate the add to wallet link
    const requestOrigin = req.get("origin");
    const fallbackOrigin = `${req.protocol}://${req.get("host")}`;
    const origins = [requestOrigin || fallbackOrigin];
    const addToWalletLink = generateAddToWalletLink(passObject.id, origins);

    res.json({
      success: true,
      passId: passObject.id,
      addToWalletLink: addToWalletLink,
    });
  } catch (error) {
    console.error("Error creating pass:", error);
    res.status(500).json({
      error: "Failed to create pass",
      message: error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(
    "Make sure to create the pass class first by running: npm run create-class",
  );
});

module.exports = app;
