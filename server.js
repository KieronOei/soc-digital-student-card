/**
 * Web Application Server for Digital Student Card Wallet Passes
 * Generates Google Wallet passes based on user input
 */

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
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
const classId = `${issuerId}.nus_ecard_demo_class`;
const ownershipStorePath = path.join(__dirname, "data", "pass-ownership.json");
const walletObjectsBaseUrl =
  "https://walletobjects.googleapis.com/walletobjects/v1";

function normalizeStudentId(studentId) {
  return String(studentId || "")
    .trim()
    .toUpperCase();
}

function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getOwnerKey(studentId) {
  const normalized = normalizeStudentId(studentId);
  return hashValue(`${issuerId}:${normalized}`);
}

function buildObjectId() {
  const randomPart = crypto.randomUUID().replace(/-/g, "_");
  return `${issuerId}.${randomPart}`;
}

function createOwnershipToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function safeEqualHexHash(a, b) {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function readOwnershipStore() {
  if (!fs.existsSync(ownershipStorePath)) {
    return {};
  }

  const raw = fs.readFileSync(ownershipStorePath, "utf8");
  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw);
}

function writeOwnershipStore(store) {
  const dir = path.dirname(ownershipStorePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(ownershipStorePath, JSON.stringify(store, null, 2), "utf8");
}

/**
 * Create Google Wallet credentials
 */
function getCredentials() {
  const credentialsPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at: ${credentialsPath}`);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
}

function getWalletHttpClient() {
  return new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
}

function getServiceAccountCredentials() {
  const credentialsPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at: ${credentialsPath}`);
  }

  return JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
}

/**
 * Create a Google Wallet pass object for a student
 */
async function createPassObject(studentData) {
  const httpClient = getWalletHttpClient();

  const normalizedStudentId = normalizeStudentId(studentData.studentId);
  const sanitizedId = normalizedStudentId.replace(/[^A-Z0-9]/g, "_");
  if (!sanitizedId || !/[A-Z0-9]/.test(sanitizedId)) {
    throw new Error(
      "Student ID must contain at least one alphanumeric character",
    );
  }

  const ownerKey = getOwnerKey(normalizedStudentId);
  const ownershipStore = readOwnershipStore();
  const existingOwnership = ownershipStore[ownerKey];

  if (existingOwnership) {
    if (!studentData.ownershipToken) {
      const error = new Error(
        "Ownership token required for existing student pass",
      );
      error.statusCode = 403;
      throw error;
    }

    const providedTokenHash = hashValue(studentData.ownershipToken);
    if (!safeEqualHexHash(providedTokenHash, existingOwnership.tokenHash)) {
      const error = new Error("Invalid ownership token for this student pass");
      error.statusCode = 403;
      throw error;
    }

    try {
      const response = await httpClient.request({
        url: `${walletObjectsBaseUrl}/genericObject/${existingOwnership.objectId}`,
        method: "GET",
      });
      console.log("Owned object already exists:", response.data.id);
      return { passObject: response.data, ownershipToken: null };
    } catch (err) {
      if (!(err.response && err.response.status === 404)) {
        console.error(
          "Error checking owned object:",
          err.response ? err.response.data : err.message,
        );
        throw err;
      }
    }
  }

  const objectId = existingOwnership
    ? existingOwnership.objectId
    : buildObjectId();

  const genericObject = {
    id: objectId,
    classId: classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#ffffff",
    logo: {
      sourceUri: {
        uri: "https://ires.ubc.ca/files/2020/05/national-university-of-singapore-nus-logo-singapore.jpg",
      },
      contentDescription: {
        defaultValue: {
          language: "en-US",
          value: "NUS Logo",
        },
      },
    },
    cardTitle: {
      defaultValue: {
        language: "en-US",
        value: "NUS eCard",
      },
    },
    header: {
      defaultValue: {
        language: "en",
        value: studentData.studentName,
      },
    },
    textModulesData: [
      {
        id: "student_name",
        header: "Name",
        body: studentData.studentName,
      },
      {
        id: "student_id",
        header: "Student ID",
        body: normalizedStudentId,
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
  };

  try {
    const response = await httpClient.request({
      url: `${walletObjectsBaseUrl}/genericObject`,
      method: "POST",
      data: genericObject,
    });
    console.log("Object created successfully:", response.data.id);

    if (!existingOwnership) {
      const ownershipToken = createOwnershipToken();
      ownershipStore[ownerKey] = {
        objectId,
        tokenHash: hashValue(ownershipToken),
        createdAt: new Date().toISOString(),
      };
      writeOwnershipStore(ownershipStore);
      return { passObject: response.data, ownershipToken };
    }

    return { passObject: response.data, ownershipToken: null };
  } catch (insertErr) {
    console.error(
      "Error creating object:",
      insertErr.response ? insertErr.response.data : insertErr.message,
    );
    throw insertErr;
  }
}

/**
 * Generate the "Add to Google Wallet" link
 */
function generateAddToWalletLink(genericObject, requestOrigin) {
  const baseUrl = "https://pay.google.com/gp/v/save/";
  const credentials = getServiceAccountCredentials();
  const fallbackOrigin =
    process.env.WALLET_ALLOWED_ORIGIN || "http://localhost:3000";
  const origin = requestOrigin || fallbackOrigin;

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    origins: [origin],
    typ: "savetowallet",
    payload: {
      genericObjects: [genericObject],
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
    const { studentName, studentId, career, admitTerm, ownershipToken } =
      req.body;

    // Validate input
    if (!studentName || !studentId || !career || !admitTerm) {
      return res.status(400).json({
        error:
          "All fields are required: studentName, studentId, career, admitTerm",
      });
    }

    // Create the pass object
    const creationResult = await createPassObject({
      studentName,
      studentId,
      career,
      admitTerm,
      ownershipToken,
    });
    const { passObject, ownershipToken: issuedOwnershipToken } = creationResult;

    // Generate the add to wallet link
    const requestOrigin = `${req.protocol}://${req.get("host")}`;
    const addToWalletLink = generateAddToWalletLink(passObject, requestOrigin);

    res.json({
      success: true,
      passId: passObject.id,
      addToWalletLink: addToWalletLink,
      ownershipToken: issuedOwnershipToken,
    });
  } catch (error) {
    console.error("Error creating pass:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 403 ? "Forbidden" : "Failed to create pass",
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
