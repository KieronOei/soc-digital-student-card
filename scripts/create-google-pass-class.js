/**
 * Script to create a Google Wallet Generic Pass Class
 * This class defines the template for student cards
 */

require('dotenv').config();
const { google } = require('googleapis');

// Configuration
const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
const classId = `${issuerId}.student_card_class`;

/**
 * Create Google Wallet credentials
 */
function getCredentials() {
  const fs = require('fs');
  const path = require('path');
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
 * Create a generic pass class for student cards
 */
async function createPassClass() {
  const auth = getCredentials();
  const walletobjects = google.walletobjects({
    version: 'v1',
    auth: auth,
  });

  const genericClass = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['student_name']",
                    },
                  ],
                },
              },
              endItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['student_id']",
                    },
                  ],
                },
              },
            },
          },
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['course']",
                    },
                  ],
                },
              },
              endItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['year']",
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  };

  try {
    // Try to get the class first
    const response = await walletobjects.genericclass.get({
      resourceId: classId,
    });
    console.log('Class already exists:', response.data.id);
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Class doesn't exist, create it
      try {
        const response = await walletobjects.genericclass.insert({
          requestBody: genericClass,
        });
        console.log('Class created successfully:', response.data.id);
        return response.data;
      } catch (insertErr) {
        console.error('Error creating class:', insertErr.response ? insertErr.response.data : insertErr.message);
        throw insertErr;
      }
    } else {
      console.error('Error checking class:', err.response ? err.response.data : err.message);
      throw err;
    }
  }
}

// Run the script
if (require.main === module) {
  createPassClass()
    .then(() => {
      console.log('Google Wallet pass class setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to create pass class:', error);
      process.exit(1);
    });
}

module.exports = { createPassClass };
