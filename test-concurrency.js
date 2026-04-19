const axios = require('axios');

// CONFIGURATION
const API_URL = 'http://localhost:3001/api/registration/enroll/1'; // Course ID 1
const STUDENT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MywiZW1haWwiOiJzdHVkZW50QGV4YW1wbGUuY29tIiwiaWF0IjoxNzc2NjA5Mzg0LCJleHAiOjE3NzY2OTU3ODR9.dFOFOkxbwqIjl6Wb1Y0AUAcbmZaUOAAy9M9cxbpvTus'; // Get this from your login response
const REQUEST_COUNT = 10; 

async function runConcurrencyTest() {
    console.log(`🚀 Starting Concurrency Test: Sending ${REQUEST_COUNT} simultaneous requests...`);

    const requests = [];

    for (let i = 0; i < REQUEST_COUNT; i++) {
        requests.push(
            axios.post(API_URL, {}, {
                headers: { 'Authorization': `Bearer ${STUDENT_TOKEN}` }
            }).catch(err => err.response) // Catch errors to inspect status codes
        );
    }

    const results = await Promise.all(requests);

    let successCount = 0;
    let lockedCount = 0;
    let otherErrorCount = 0;

    results.forEach((res, index) => {
        if (res.status === 200) {
            successCount++;
            console.log(`Request ${index + 1}: ✅ Success (200)`);
        } else if (res.status === 429) {
            lockedCount++;
            console.log(`Request ${index + 1}: 🔒 Blocked by Redis Lock (429)`);
        } else {
            otherErrorCount++;
            console.log(`Request ${index + 1}: ❌ Failed with Status ${res.status}`);
            console.log('Error Data:', res.data);
        }
    });

    console.log('\n--- TEST SUMMARY ---');
    console.log(`Total Requests: ${REQUEST_COUNT}`);
    console.log(`Successful Enrollments: ${successCount}`);
    console.log(`Redis Protections (429): ${lockedCount}`);
    console.log(`Other Failures: ${otherErrorCount}`);
    
    if (successCount === 1 && lockedCount > 0) {
        console.log('\nRESULT: 🏆 Redis Lock is WORKING! Only one request passed.');
    } else if (successCount > 1) {
        console.log('\nRESULT: ⚠️ Redis Lock FAILED! Multiple requests passed.');
    }
}

runConcurrencyTest();