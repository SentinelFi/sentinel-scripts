/**
 * Flight Monitoring Script
 * 
 * This script sets up a cron job to check the status of flight UA2019
 * every 30 seconds and print that it's on route.
 */

import cron from 'node-cron';

/**
 * Check and report on the status of flight UA2019
 */
function checkFlightStatus() {
  console.log(`[${new Date().toISOString()}] UA2019 on route`);
}

// Schedule cron job to run every 30 seconds
// Cron format: second minute hour day-of-month month day-of-week
cron.schedule('*/30 * * * * *', checkFlightStatus);

console.log(`Flight monitoring started at ${new Date().toISOString()}`);
console.log(`Checks will run every 30 seconds.`);

// Run an initial check immediately
checkFlightStatus(); 