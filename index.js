const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
const PORT = process.env.PORT || 3306;

app.use(bodyParser.urlencoded({ extended: false }));

// Database connection details
const dbConfig = {
    host: 'b0zuaedlennbtqhvlusj-mysql.services.clever-cloud.com',
    user: 'uvku5pyjotwbezzf',
    password: 'I3Q9ULdG9PuPICj1l2Gl', 
    database: 'b0zuaedlennbtqhvlusj'
};

let db;

// Function to handle connection
function handleDisconnect() {
    db = mysql.createConnection(dbConfig);

    db.connect(err => {
        if (err) {
            console.error('Error connecting to database:', err.stack);
            setTimeout(handleDisconnect, 2000); // Reconnect after 2 seconds
        } else {
            console.log('Connected to database.');
        }
    });

    db.on('error', err => {
        console.error('Database error:', err.stack);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect(); // Reconnect on connection loss
        } else {
            throw err;
        }
    });
}

// Initial connection
handleDisconnect();

let votes = {
    "BUTOTO. ": 0,
    "MARTIN. ": 0,
    "KWIZERA. ": 0,
    "KEVIN. ": 0,
    "ALINE. ": 0
};

// In-memory storage for user data (for simplicity)
let userNames = {};
let voters = new Set(); // Set to track phone numbers that have already voted
let userLanguages = {}; // Object to store the language preference of each user

app.post('/ussd', (req, res) => {
    let response = '';

    // Extract USSD input
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    // Parse user input
    const userInput = text.split('*').map(option => option.trim());

    // Determine next action based on user input
    if (userInput.length === 1 && userInput[0] === '') {
        // First level menu: Language selection
        response = `CON Welcome to the County President Voting System\n Hitamo ururimi.`;
        response += `1. English\n`;
        response += `2. Kinyarwanda`;
    } else if (userInput.length === 1 && userInput[0] !== '') {
        // Save user's language choice and move to the name input menu
        userLanguages[phoneNumber] = userInput[0] === '1' ? 'en' : 'rw';
        response = userLanguages[phoneNumber] === 'en' ? 
            `CON Please Enter your name:` : 
            `CON Andika Amazina ryawe:`;
    } else if (userInput.length === 2) {
        // Save user's name
        userNames[phoneNumber] = userInput[1];

        // Third level menu: Main menu
        response = userLanguages[phoneNumber] === 'en' ? 
            `CON Hello ${userNames[phoneNumber]}, choose an option:\n1. Vote Candidate\n2. View Votes` : 
            `CON Muraho ${userNames[phoneNumber]}, hitamo:\n1. Tora umukandida\n2. Reba amajwi`;
    } else if (userInput.length === 3) {
        if (userInput[2] === '1') {
            // Check if the phone number has already voted
            if (voters.has(phoneNumber)) {
                response = userLanguages[phoneNumber] === 'en' ? 
                    `END You have already voted. Thank you!` : 
                    `END Mwamaze gutora. Murakoze!`;
            } else {
                // Voting option selected
                response = userLanguages[phoneNumber] === 'en' ? 
                    `CON Select a candidate:\n1. BUTOTO\n2. MARTIN\n3. KWIZERA\n4. KEVIN\n5. ALINE` : 
                    `CON Hitamo umukandida:\n1. BUTOTO\n2. MARTIN\n3. KWIZERA\n4. KEVIN\n5. ALINE`;
            }
        } else if (userInput[2] === '2') {
            // View votes option selected
            response = userLanguages[phoneNumber] === 'en' ? 
                `END Votes:\n` : 
                `END Amajwi:\n`;
            for (let candidate in votes) {
                response += `${candidate}: ${votes[candidate]} votes\n`;
            }
        }
    } else if (userInput.length === 4) {
        // Fourth level menu: Voting confirmation
        let candidateIndex = parseInt(userInput[3]) - 1;
        let candidateNames = Object.keys(votes);
        if (candidateIndex >= 0 && candidateIndex < candidateNames.length) {
            votes[candidateNames[candidateIndex]] += 1;
            voters.add(phoneNumber); // Mark this phone number as having voted
            response = userLanguages[phoneNumber] === 'en' ? 
                `END Thank you for voting for ${candidateNames[candidateIndex]}!` : 
                `END Murakoze gutora ${candidateNames[candidateIndex]}!`;

            // Insert voting record into the database
            const voteData = {
                session_id: sessionId,
                phone_number: phoneNumber,
                user_name: userNames[phoneNumber],
                language_used: userLanguages[phoneNumber],
                voted_candidate: candidateNames[candidateIndex]
            };

            const query = 'INSERT INTO votes SET ?';
            db.query(query, voteData, (err, result) => {
                if (err) {
                    console.error('Error inserting data into database:', err.stack);
                }
            });
        } else {
            response = userLanguages[phoneNumber] === 'en' ? 
                `END Invalid selection. Please try again.` : 
                `END Amahitamo siyo. Ongera mugerageze.`;
        }
    }

    res.send(response);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});