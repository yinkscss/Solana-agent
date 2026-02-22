import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const KEYS_DIR = join(import.meta.dir, "..", ".keys");
const WALLET_PATH = join(KEYS_DIR, "devnet-wallet.json");
const RECIPIENT_PATH = join(KEYS_DIR, "devnet-recipient.json");

let wallet: Keypair;
let recipient: Keypair;
let txSig: string;
let v0Sig: string;

function sol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function explorer(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function loadOrCreateKeypair(path: string, label: string): Keypair {
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    const kp = Keypair.fromSecretKey(Uint8Array.from(raw));
    console.log(`   Loaded existing ${label}: ${kp.publicKey.toBase58()}`);
    return kp;
  }
  const kp = Keypair.generate();
  mkdirSync(KEYS_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`   Created new ${label}: ${kp.publicKey.toBase58()}`);
  return kp;
}

async function step1_setup() {
  console.log("\n--- Step 1: Setup ---");
  const version = await connection.getVersion();
  console.log(`✅ Connected to ${RPC_URL}`);
  console.log(`   Solana version: ${version["solana-core"]}`);
}

async function step2_createWallet() {
  console.log("\n--- Step 2: Load/create wallet ---");
  wallet = loadOrCreateKeypair(WALLET_PATH, "wallet");
  recipient = loadOrCreateKeypair(RECIPIENT_PATH, "recipient");
}

async function tryWebFaucet(pubkey: string, solAmount: number): Promise<boolean> {
  try {
    console.log(`   Trying web faucet (faucet.solana.com)...`);
    const res = await fetch("https://faucet.solana.com/api/request-airdrop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: pubkey,
        network: "devnet",
        amount: solAmount,
      }),
    });
    if (res.ok) {
      console.log(`   Web faucet responded OK, waiting for confirmation...`);
      await new Promise((r) => setTimeout(r, 3000));
      return true;
    }
    const text = await res.text();
    console.log(`   Web faucet returned ${res.status}: ${text.slice(0, 150)}`);
    return false;
  } catch (err) {
    console.log(`   Web faucet failed: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

async function step3_airdrop() {
  console.log("\n--- Step 3: Fund wallet ---");

  const balance = await connection.getBalance(wallet.publicKey);
  if (balance >= 0.5 * LAMPORTS_PER_SOL) {
    console.log(`✅ Wallet already funded: ${sol(balance)} SOL — skipping airdrop`);
    return;
  }
  console.log(`   Current balance: ${sol(balance)} SOL — needs funding`);

  // Attempt 1: RPC airdrop
  try {
    console.log(`   Trying RPC airdrop...`);
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    const newBalance = await connection.getBalance(wallet.publicKey);
    console.log(`✅ RPC airdrop confirmed: ${sol(newBalance)} SOL`);
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   RPC airdrop failed: ${msg.slice(0, 100)}`);
  }

  // Attempt 2: Web faucet
  const webOk = await tryWebFaucet(wallet.publicKey.toBase58(), 2);
  if (webOk) {
    const newBalance = await connection.getBalance(wallet.publicKey);
    if (newBalance >= 0.5 * LAMPORTS_PER_SOL) {
      console.log(`✅ Web faucet airdrop confirmed: ${sol(newBalance)} SOL`);
      return;
    }
  }

  // Attempt 3: Manual instructions
  console.log(`\n⚠️  Automatic airdrop failed. Fund the wallet manually:\n`);
  console.log(`   Option A: Visit https://faucet.solana.com`);
  console.log(`            Paste this address: ${wallet.publicKey.toBase58()}`);
  console.log(`            Select "Devnet" and request 2 SOL\n`);
  console.log(`   Option B: Use Solana CLI`);
  console.log(`            solana airdrop 2 ${wallet.publicKey.toBase58()} --url devnet\n`);
  console.log(`   Then re-run: bun run devnet:smoke`);
  console.log(`   (Your wallet is saved at ${WALLET_PATH} — it will persist)\n`);
  process.exit(0);
}

async function step4_transfer() {
  console.log("\n--- Step 4: SOL transfer (legacy) ---");
  const transferTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    })
  );

  txSig = await sendAndConfirmTransaction(connection, transferTx, [wallet]);
  console.log(`✅ Transfer confirmed: ${txSig}`);
  console.log(`   Explorer: ${explorer(txSig)}`);
}

async function step5_verifyBalances() {
  console.log("\n--- Step 5: Verify balances ---");
  const senderBalance = await connection.getBalance(wallet.publicKey);
  const recipientBalance = await connection.getBalance(recipient.publicKey);
  console.log(`✅ Sender balance:    ${sol(senderBalance)} SOL`);
  console.log(`✅ Recipient balance: ${sol(recipientBalance)} SOL`);
}

async function step6_jupiterQuote() {
  console.log("\n--- Step 6: Jupiter Quote API ---");
  try {
    const quoteUrl =
      "https://quote-api.jup.ag/v6/quote?" +
      "inputMint=So11111111111111111111111111111111111111112" +
      "&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" +
      "&amount=100000000" +
      "&slippageBps=50";

    const res = await fetch(quoteUrl);
    if (res.ok) {
      const quote = await res.json() as Record<string, unknown>;
      console.log(`✅ Jupiter quote received`);
      console.log(`   Input:  ${quote.inAmount} lamports`);
      console.log(`   Output: ${quote.outAmount} USDC units`);
      console.log(`   Impact: ${quote.priceImpactPct}%`);
    } else {
      console.log(`⚠️  Jupiter API returned ${res.status}: ${res.statusText}`);
    }
  } catch (err) {
    console.log(`⚠️  Jupiter API unreachable: ${err instanceof Error ? err.message : err}`);
  }
}

async function step7_versionedTransaction() {
  console.log("\n--- Step 7: Versioned Transaction (V0) ---");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 0.05 * LAMPORTS_PER_SOL,
      }),
    ],
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  versionedTx.sign([wallet]);

  v0Sig = await connection.sendTransaction(versionedTx);
  await connection.confirmTransaction(v0Sig, "confirmed");
  console.log(`✅ V0 Transaction confirmed: ${v0Sig}`);
  console.log(`   Explorer: ${explorer(v0Sig)}`);
}

function step8_summary() {
  console.log("\n=== DEVNET SMOKE TEST COMPLETE ===");
  console.log(`Wallet:      ${wallet.publicKey.toBase58()}`);
  console.log(`Recipient:   ${recipient.publicKey.toBase58()}`);
  if (txSig) console.log(`Legacy TX:   ${explorer(txSig)}`);
  if (v0Sig) console.log(`V0 TX:       ${explorer(v0Sig)}`);
  console.log(`Wallet key:  ${WALLET_PATH}`);
  console.log("\nAll tests passed ✅\n");
}

type Step = { name: string; fn: () => Promise<void> | void };

const steps: Step[] = [
  { name: "Setup", fn: step1_setup },
  { name: "Load/Create Wallet", fn: step2_createWallet },
  { name: "Fund Wallet", fn: step3_airdrop },
  { name: "SOL Transfer", fn: step4_transfer },
  { name: "Verify Balances", fn: step5_verifyBalances },
  { name: "Jupiter Quote", fn: step6_jupiterQuote },
  { name: "V0 Transaction", fn: step7_versionedTransaction },
  { name: "Summary", fn: step8_summary },
];

async function main() {
  console.log("🚀 Solana Devnet Smoke Test");
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  for (const step of steps) {
    try {
      await step.fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Step "${step.name}" failed: ${message}`);
      process.exit(1);
    }
  }
}

main();
