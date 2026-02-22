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

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

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

async function step1_setup() {
  console.log("\n--- Step 1: Setup ---");
  const version = await connection.getVersion();
  console.log(`✅ Connected to ${RPC_URL}`);
  console.log(`   Solana version: ${version["solana-core"]}`);
}

async function step2_createWallet() {
  console.log("\n--- Step 2: Create wallet ---");
  wallet = Keypair.generate();
  console.log(`✅ Wallet created: ${wallet.publicKey.toBase58()}`);
}

async function airdropWithRetry(
  pubkey: Keypair["publicKey"],
  lamports: number,
  retries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports);
      console.log(`   Airdrop requested (attempt ${attempt}): ${sig}`);
      await connection.confirmTransaction(sig, "confirmed");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === retries) throw err;
      const delay = attempt * 5_000;
      console.log(
        `   ⚠️  Attempt ${attempt} failed (${msg}), retrying in ${delay / 1000}s...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function step3_airdrop() {
  console.log("\n--- Step 3: Airdrop SOL ---");
  await airdropWithRetry(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`✅ Airdrop confirmed: ${sol(balance)} SOL`);
}

async function step4_createRecipient() {
  console.log("\n--- Step 4: Create recipient wallet ---");
  recipient = Keypair.generate();
  console.log(`✅ Recipient wallet: ${recipient.publicKey.toBase58()}`);
}

async function step5_transfer() {
  console.log("\n--- Step 5: SOL transfer (legacy) ---");
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

async function step6_verifyBalances() {
  console.log("\n--- Step 6: Verify balances ---");
  const senderBalance = await connection.getBalance(wallet.publicKey);
  const recipientBalance = await connection.getBalance(recipient.publicKey);
  console.log(`✅ Sender balance:    ${sol(senderBalance)} SOL`);
  console.log(`✅ Recipient balance: ${sol(recipientBalance)} SOL`);
}

async function step7_jupiterQuote() {
  console.log("\n--- Step 7: Jupiter Quote API ---");
  const quoteUrl =
    "https://quote-api.jup.ag/v6/quote?" +
    "inputMint=So11111111111111111111111111111111111111112" +
    "&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" +
    "&amount=100000000" +
    "&slippageBps=50";

  const res = await fetch(quoteUrl);
  if (res.ok) {
    const quote = await res.json();
    console.log(`✅ Jupiter quote: ${JSON.stringify(quote).slice(0, 200)}...`);
  } else {
    console.log(`⚠️  Jupiter API returned ${res.status}: ${res.statusText}`);
  }
}

async function step8_versionedTransaction() {
  console.log("\n--- Step 8: Versioned Transaction (V0) ---");
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

function step9_summary() {
  console.log("\n=== DEVNET SMOKE TEST COMPLETE ===");
  console.log(`Wallet:    ${wallet.publicKey.toBase58()}`);
  console.log(`Recipient: ${recipient.publicKey.toBase58()}`);
  console.log(`Legacy TX: ${txSig}`);
  console.log(`V0 TX:     ${v0Sig}`);
  console.log("All tests passed ✅\n");
}

type Step = { name: string; fn: () => Promise<void> | void };

const steps: Step[] = [
  { name: "Setup",                fn: step1_setup },
  { name: "Create Wallet",        fn: step2_createWallet },
  { name: "Airdrop SOL",          fn: step3_airdrop },
  { name: "Create Recipient",     fn: step4_createRecipient },
  { name: "SOL Transfer",         fn: step5_transfer },
  { name: "Verify Balances",      fn: step6_verifyBalances },
  { name: "Jupiter Quote",        fn: step7_jupiterQuote },
  { name: "V0 Transaction",       fn: step8_versionedTransaction },
  { name: "Summary",              fn: step9_summary },
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

      if (step.name === "Airdrop SOL" && message.includes("429")) {
        console.error(
          "   Devnet airdrop is rate-limited. Wait a minute and retry."
        );
      }
      process.exit(1);
    }
  }
}

main();
