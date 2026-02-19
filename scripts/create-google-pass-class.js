/**
 * Script to create a Google Wallet Generic Pass Class
 * This class defines the template for student cards
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// Configuration
const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
const classId = `${issuerId}.nus_ecard_demo_class`;
const walletObjectsBaseUrl =
  "https://walletobjects.googleapis.com/walletobjects/v1";

/**
 * Create Wallet HTTP client
 */
function getWalletHttpClient() {
  const credentialsPath = path.resolve(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at: ${credentialsPath}`);
  }

  return new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
}

/**
 * Create a generic pass class for student cards
 */
async function createPassClass() {
  const httpClient = getWalletHttpClient();

  const genericClass = {
    id: `${classId}`,
    enableSmartTap: true,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            threeItems: {
              startItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['student_id']",
                    },
                  ],
                },
              },
              middleItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['career']",
                    },
                  ],
                },
              },
              endItem: {
                firstValue: {
                  fields: [
                    {
                      fieldPath: "object.textModulesData['admit_term']",
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
    const response = await httpClient.request({
      url: `${walletObjectsBaseUrl}/genericClass/${classId}`,
      method: "GET",
    });
    console.log("Class already exists:", response.data.id);
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      // Class doesn't exist, create it
      try {
        const response = await httpClient.request({
          url: `${walletObjectsBaseUrl}/genericClass`,
          method: "POST",
          data: genericClass,
        });
        console.log("Class created successfully:", response.data.id);
        return response.data;
      } catch (insertErr) {
        console.error(
          "Error creating class:",
          insertErr.response ? insertErr.response.data : insertErr.message,
        );
        throw insertErr;
      }
    } else {
      console.error(
        "Error checking class:",
        err.response ? err.response.data : err.message,
      );
      throw err;
    }
  }
}

// Run the script
if (require.main === module) {
  createPassClass()
    .then(() => {
      console.log("Google Wallet pass class setup complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Failed to create pass class:", error);
      process.exit(1);
    });
}

module.exports = { createPassClass };
