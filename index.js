// RUN: node index.js

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  BASE_FEE,
  TimeoutInfinite,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";

import { Server } from "@stellar/stellar-sdk/rpc";

const contractAddress =
  "CCXPET3VSGNFRZMGDAQ2WLF5G4CRQN22J7XAQGY5VACJYK4IUGCR2ZOL";
const networkPassphrase = Networks.TESTNET;
const serverUrl = "https://soroban-testnet.stellar.org:443";
const userSecretKey = "YOUR_PRIVATE_KEY";

async function callBumpFunction(eventOccurred, eventTime) {
  try {
    const server = new Server(serverUrl);
    const userKeypair = Keypair.fromSecret(userSecretKey);
    const contract = new Contract(contractAddress);

    const eventOccurredParam = nativeToScVal(eventOccurred, { type: "bool" });

    let eventTimeParam;
    if (eventTime === null || eventTime === undefined) {
      eventTimeParam = xdr.ScVal.scvVoid(); // None/null case
    } else {
      eventTimeParam = nativeToScVal(BigInt(eventTime), { type: "u64" });
    }

    const account = await server.getAccount(userKeypair.publicKey());

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call("bump", eventOccurredParam, eventTimeParam))
      .setTimeout(TimeoutInfinite)
      .build();

    transaction.sign(userKeypair);
    console.log("Submitting transaction to call bump function...");

    const sendResponse = await server.sendTransaction(transaction);
    console.log("Transaction submission response:", sendResponse);

    if (sendResponse.status === "PENDING") {
      // Poll for transaction status
      let txResponse;
      do {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between polling
        txResponse = await server.getTransaction(sendResponse.hash);
        console.log("Transaction status:", txResponse.status);
      } while (txResponse.status === "NOT_FOUND");

      if (txResponse.status === "SUCCESS") {
        const result = scValToNative(txResponse.resultXdr.result().retval());
        console.log("Contract function result:", result);
        return result;
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

// Example usage
async function main() {
  try {
    const event_occurred = false;
    const event_time = 1234567890;
    const result = await callBumpFunction(event_occurred, event_time);
    console.log("Result:", result);
  } catch (error) {
    console.error("Main execution error:", error);
  }
}

main();
