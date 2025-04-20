/**
 * Flight Monitoring Script
 * 
 * This script checks the status of flight UA1324
 * and calls a Stellar smart contract if the flight is on route.
 */

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";

import { Server } from "@stellar/stellar-sdk/rpc";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

// Define cutoff time in minutes for determining if a flight is late
const CUTOFF = 15; // 15 minutes

const contractAddress =
  "CAK6MJ7GZJUNXESY7WGLZRA2P4JBPARRI5LAOUEJG4KATT4XSNUS5OIZ";
const networkPassphrase = Networks.TESTNET;
const serverUrl = "https://soroban-testnet.stellar.org:443";
const userSecretKey = "YOUR_PRIVATE_KEY";

// Flight information
const FLIGHT_IDENT = "UA1324"; // Flight identifier
const AERO_API_BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
const AERO_API_KEY = process.env.AERO_API_KEY; // API key from environment variable

if (!AERO_API_KEY) {
  console.error("Error: AERO_API_KEY environment variable is not set.");
  console.error("Please set the API key in your .env file: AERO_API_KEY=your_api_key");
  process.exit(1);
}

// Create .env.example file if it doesn't exist
const envExamplePath = path.join(process.cwd(), '.env.example');
if (!fs.existsSync(envExamplePath)) {
  fs.writeFileSync(envExamplePath, 'AERO_API_KEY=your_flightaware_api_key_here\n');
  console.log("Created .env.example file. Please copy to .env and add your API key.");
}

const booleanToXdr = (value) => xdr.ScVal.scvBool(value);

const optionalU64ToXdr = (value) =>
  value !== null && value !== undefined
    ? xdr.ScVal.scvU64(value)
    : xdr.ScVal.scvVoid();

// Helper function to convert ISO date string to Unix timestamp
function isoToUnixTimestamp(isoString) {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

async function callBumpFunction(eventOccurred, eventTime) {
  try {
    const server = new Server(serverUrl);
    const userKeypair = Keypair.fromSecret(userSecretKey);
    const contract = new Contract(contractAddress);

    const eventOccurredParam = booleanToXdr(eventOccurred);
    const eventTimeParam = optionalU64ToXdr(eventTime);

    const account = await server.getAccount(userKeypair.publicKey());

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call("bump", eventOccurredParam, eventTimeParam))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(transaction);

    prepared.sign(userKeypair);

    console.log(
      "Submitting transaction to call bump function...",
      userKeypair.publicKey()
    );

    const sendResponse = await server.sendTransaction(prepared);
    console.log("👉 Transaction submission response:", sendResponse);

    if (sendResponse.status === "PENDING") {
      // Poll for transaction status
      let txResponse;
      do {
        console.log("Polling...");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between polling
        txResponse = await server.getTransaction(sendResponse.hash);
      } while (txResponse.status === "NOT_FOUND");

      if (txResponse.status === "SUCCESS") {
        const returnValue = txResponse.resultMetaXdr
          .v3()
          .sorobanMeta()
          ?.returnValue();
        const val = returnValue.value();
        console.log(val?.toString(), typeof val);
        return val;
      } else {
        console.error("Transaction failed:", txResponse);
        throw new Error(`Transaction failed with status: ${txResponse.status}`);
      }
    } else {
      throw new Error(
        `Transaction submission failed with status: ${sendResponse.status}`
      );
    }
  } catch (error) {
    console.error("Error calling bump function:", error);
    throw error;
  }
}

/**
 * Check and report on the status of flight UA1324 and call bump function
 */
async function checkFlightStatus() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Checking flight ${FLIGHT_IDENT} status...`);
  
  try {
    // Construct API URL for the specific flight
    const apiUrl = `${AERO_API_BASE_URL}/flights/${FLIGHT_IDENT}`;
    
    // Call flight API to get actual status with authentication
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-apikey': AERO_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const flightData = await response.json();
    
    // If we have flights in the response
    if (flightData.flights && flightData.flights.length > 0) {
      const flight = flightData.flights[0];
      
      // Extract scheduled and actual arrival times
      const scheduledIn = flight.scheduled_in;
      const actualIn = flight.actual_in;
      
      console.log(`Flight details - Scheduled arrival: ${scheduledIn}, Actual arrival: ${actualIn}`);
      
      // Only proceed if we have both times
      if (scheduledIn && actualIn) {
        // Convert to Unix timestamps
        const scheduledInTimestamp = isoToUnixTimestamp(scheduledIn);
        const actualInTimestamp = isoToUnixTimestamp(actualIn);
        
        // Calculate difference in minutes
        const diffMinutes = (actualInTimestamp - scheduledInTimestamp) / 60;
        
        // Determine if flight is late
        const isLate = diffMinutes > CUTOFF;
        
        console.log(`Flight is ${isLate ? 'LATE' : 'ON TIME'} (${diffMinutes.toFixed(1)} minutes difference, CUTOFF: ${CUTOFF} minutes)`);
        
        // Call the bump function with flight status
        const result = await callBumpFunction(isLate, BigInt(actualInTimestamp));
        console.log("Bump function call result:", result);
      } else {
        console.log("Missing scheduled or actual arrival time data");
      }
    } else {
      console.log("No flight data available");
    }
  } catch (error) {
    console.error("Error during flight status check:", error);
  }
}

// Main function to run the flight check
async function main() {
  console.log(`Flight monitoring started at ${new Date().toISOString()}`);
  // Run the flight status check
  await checkFlightStatus();
}

// Execute the main function
main(); 