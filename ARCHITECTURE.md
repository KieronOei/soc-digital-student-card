# Architecture Overview

## System Components

### 1. Script: `create-google-pass-class.js`

**Purpose:** Creates the Google Wallet Generic Pass Class (template)

**What it does:**
- Defines the structure and layout of student cards
- Creates a reusable template that all student cards will follow
- Configures card fields: Student Name, Student ID, Course, and Year
- Sets up the card layout with proper formatting

**When to run:** Once during initial setup, before generating any student cards

**Usage:**
```bash
npm run create-class
```

### 2. Web Application: `server.js`

**Purpose:** Express.js server that creates Google Wallet Pass Objects

**What it does:**
- Serves the web interface (HTML form)
- Receives student information from the form
- Creates individual Google Wallet pass objects for each student
- Generates "Add to Google Wallet" links
- Handles API requests for pass creation

**Key Functions:**
- `createPassObject()`: Creates a unique pass for each student
- `generateAddToWalletLink()`: Generates the wallet save link
- `POST /api/create-pass`: API endpoint for pass creation

**Usage:**
```bash
npm start
```

### 3. Web Interface: `public/` directory

**Purpose:** User-facing web form for entering student information

**Components:**
- `index.html`: Form interface for student data input
- `styles.css`: Beautiful, responsive design
- `script.js`: Client-side form handling and API communication

**Features:**
- Input validation
- Real-time feedback
- Google Wallet button integration
- Error handling

## Data Flow

1. **Setup Phase:**
   ```
   User runs create-class script
   → Creates Generic Pass Class in Google Wallet
   → Template ready for use
   ```

2. **Pass Generation:**
   ```
   Student fills form on web page
   → Submits to /api/create-pass endpoint
   → Server creates Pass Object using the Class template
   → Returns "Add to Google Wallet" link
   → Student clicks link to save to wallet
   ```

## Pass Structure

### Generic Pass Class (Template)
- Defines card layout and fields
- Created once, reused for all students
- Contains no student-specific data

### Generic Pass Object (Individual Cards)
- Created for each student
- Contains specific student information
- References the Pass Class template
- Includes:
  - Student Name
  - Student ID
  - Course/Program
  - Academic Year
  - QR Code (contains Student ID)

## Security Considerations

1. **Environment Variables:** Sensitive credentials stored in .env
2. **Service Account:** Google Cloud service account for API access
3. **Unique IDs:** Each pass has a unique identifier
4. **QR Codes:** Student ID encoded for verification

## Future Enhancements

### Apple Wallet Integration
- Create `.pkpass` files
- Sign passes with Apple certificates
- Implement push updates

### Additional Features
- Photo upload for student cards
- Expiration dates
- Pass updates (for year progression)
- Admin dashboard
- Batch pass creation
