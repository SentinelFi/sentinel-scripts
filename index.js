// RUN: node index.js

import {
  Contract,
  Networks,
  TransactionBuilder,
  Keypair,
  xdr,
  BASE_FEE,
} from "@stellar/stellar-sdk";

import { Server } from "@stellar/stellar-sdk/rpc";

const contractAddress =
  "CAK6MJ7GZJUNXESY7WGLZRA2P4JBPARRI5LAOUEJG4KATT4XSNUS5OIZ";
const networkPassphrase = Networks.TESTNET;
const serverUrl = "https://soroban-testnet.stellar.org:443";
const userSecretKey = "YOUR_PRIVATE_KEY";

const booleanToXdr = (value) => xdr.ScVal.scvBool(value);

const optionalU64ToXdr = (value) =>
  value !== null && value !== undefined
    ? xdr.ScVal.scvU64(value)
    : xdr.ScVal.scvVoid();

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

// Example usage
async function main() {
  try {
    const event_occurred = false; // true;
    const event_time = null; // BigInt(1220351);
    const result = await callBumpFunction(event_occurred, event_time);
    console.log("Result:", result);
  } catch (error) {
    console.error("Main execution error:", error);
  }
}

main();
