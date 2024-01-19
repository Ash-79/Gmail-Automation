// Importing required modules
const express = require("express");
const { google } = require("googleapis");
require("dotenv").config();

// Creating an express app
const app = express();
const port = 3000;

// Setting up OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);
// Setting credentials for OAuth2 client
oAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

// Defining home route
app.get("/", async (req, res) => {
  try {
    // Creating Gmail client
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Creating a new label
    const labelId = await createLabel(gmail, "Auto-Response");

    // Setting interval to check for unread messages
    setInterval(async () => {
      // Getting unread messages
      const unreadMessages = await getUnreadMessages(gmail);

      // Processing unread messages
      await processUnreadMessages(gmail, unreadMessages, labelId);
    }, getRandomInterval());

    // Sending response
    res.json({ message: "Process started successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

// Function to get unread messages
async function getUnreadMessages(gmail) {
    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      q: 'is:unread',
    });
  
    return response.data.messages || [];
}

// Function to create label
async function createLabel(gmail, labelName) {
    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
  
      return response.data.id;
    } catch (error) {
      if (error.code === 409) {
        const response = await gmail.users.labels.list({ userId: 'me' });
        const label = response.data.labels.find((label) => label.name === labelName);
        return label.id;
      } else {
        throw error;
      }
    }
  }
  
  // Function to process unread messages
  async function processUnreadMessages(gmail, messages, labelId) {
    for (const message of messages) {
      const messageData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });
  
      const email = messageData.data;
      const hasReplied = email.payload.headers.some((header) => header.name === 'In-Reply-To');
  
      if (!hasReplied) {
        const replyMessage = createReplyMessage(email);
        await gmail.users.messages.send(replyMessage);
  
        await gmail.users.messages.modify({
          userId: 'me',
          id: message.id,
          resource: {
            addLabelIds: [labelId],
            removeLabelIds: ['INBOX'],
          },
        });
      }
    }
  }
  
  // Function to create reply message
  function createReplyMessage(email) {
    return {
      userId: 'me',
      resource: {
        raw: Buffer.from(
          `To: ${email.payload.headers.find((header) => header.name === 'From').value}\r\n` +
            `Subject: Re: ${email.payload.headers.find((header) => header.name === 'Subject').value}\r\n` +
            `Content-Type: text/plain; charset="UTF-8"\r\n` +
            `Content-Transfer-Encoding: 7bit\r\n\r\n` +
            `Thank you for your email. I'm currently on vacation and will reply to you when I return.\r\n`
        ).toString('base64'),
      },
    };
  }
  
  // Function to get random interval
  function getRandomInterval() {
    // Get random interval between 45 and 120 seconds
    return Math.floor(Math.random() * (120 - 45 + 1) + 45) * 1000;
  }

// Starting the server
app.listen(port, () => console.log(`App listening on port ${port}!`));