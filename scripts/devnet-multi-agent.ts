import {
  Connection,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const KEYS_DIR = join(import.meta.dir, "..", ".keys");
const AGENT_COUNT = 3;

function sol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function explorer(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function loadOrCreateKeypair(name: string): Keypair {
  const path = join(KEYS_DIR, `${name}.json`);
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const kp = Keypair.generate();
  mkdirSync(KEYS_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function tryWebFaucet(pubkey: string, solAmount: number): Promise<boolean> {
  try {
    const res = await fetch("https://faucet.solana.com/api/request-airdrop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: pubkey, network: "devnet", amount: solAmount }),
    });
    if (res.ok) {
      await new Promise((r) => setTimeout(r, 3000));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function fundAgent(kp: Keypair, label: string): Promise<boolean> {
  const balance = await connection.getBalance(kp.publicKey);
  if (balance >= 0.3 * LAMPORTS_PER_SOL) {
    console.log(`✅ ${label} already funded: ${sol(balance)} SOL`);
    return true;
  }

  // Try RPC airdrop
  try {
    const sig = await connection.requestAirdrop(kp.publicKey, 1 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    const newBal = await connection.getBalance(kp.publicKey);
    console.log(`✅ ${label} funded via RPC: ${sol(newBal)} SOL`);
    return true;
  } catch {
    // Fall through
  }

  // Try web faucet
  const webOk = await tryWebFaucet(kp.publicKey.toBase58(), 1);
  if (webOk) {
    const newBal = await connection.getBalance(kp.publicKey);
    if (newBal >= 0.3 * LAMPORTS_PER_SOL) {
      console.log(`✅ ${label} funded via web faucet: ${sol(newBal)} SOL`);
      return true;
    }
  }

  return false;
}

async function transferSOL(
  from: Keypair,
  to: Keypair,
  lamports: number,
  label: string,
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to.publicKey,
      lamports,
    }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [from]);
  console.log(`✅ ${label}: ${sig}`);
  console.log(`   Explorer: ${explorer(sig)}`);
  return sig;
}

async function main() {
  console.log("🤖 Multi-Agent Devnet Test");
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Time: ${new Date().toISOString()}\n`);

  // Step 1: Load/create agent wallets (persistent)
  console.log("--- Step 1: Load/create agent wallets ---");
  const agents: Keypair[] = [];
  for (let i = 0; i < AGENT_COUNT; i++) {
    const kp = loadOrCreateKeypair(`agent-${i + 1}`);
    agents.push(kp);
    console.log(`   Agent ${i + 1}: ${kp.publicKey.toBase58()}`);
  }

  // Step 2: Fund each agent
  console.log("\n--- Step 2: Fund agents ---");
  const unfunded: string[] = [];
  for (let i = 0; i < agents.length; i++) {
    const ok = await fundAgent(agents[i], `Agent ${i + 1}`);
    if (!ok) unfunded.push(`Agent ${i + 1}: ${agents[i].publicKey.toBase58()}`);
  }

  if (unfunded.length > 0) {
    console.log(`\n⚠️  Could not auto-fund ${unfunded.length} agent(s).`);
    console.log(`   Visit https://faucet.solana.com and airdrop to each:\n`);
    for (const line of unfunded) console.log(`   ${line}`);
    console.log(`\n   Then re-run: bun run devnet:multi-agent`);
    console.log(`   (Wallets are saved in .keys/ — they persist across runs)\n`);
    process.exit(0);
  }

  // Step 3: Agent 1 → Agent 2
  console.log("\n--- Step 3: Agent 1 → Agent 2 (0.1 SOL) ---");
  const tx1 = await transferSOL(agents[0], agents[1], 0.1 * LAMPORTS_PER_SOL, "Agent 1 → Agent 2");

  // Step 4: Agent 2 → Agent 3
  console.log("\n--- Step 4: Agent 2 → Agent 3 (0.05 SOL) ---");
  const tx2 = await transferSOL(agents[1], agents[2], 0.05 * LAMPORTS_PER_SOL, "Agent 2 → Agent 3");

  // Step 5: Final balances
  console.log("\n--- Step 5: Final balances ---");
  for (let i = 0; i < agents.length; i++) {
    const balance = await connection.getBalance(agents[i].publicKey);
    console.log(`   Agent ${i + 1}: ${sol(balance)} SOL`);
  }

  console.log("\n=== MULTI-AGENT TEST COMPLETE ===");
  for (let i = 0; i < agents.length; i++) {
    console.log(`Agent ${i + 1}: ${agents[i].publicKey.toBase58()}`);
  }
  console.log(`TX 1 (Agent 1→2): ${explorer(tx1)}`);
  console.log(`TX 2 (Agent 2→3): ${explorer(tx2)}`);
  console.log("All tests passed ✅\n");
}

main().catch((err) => {
  console.error(`\n❌ Multi-agent test failed: ${err.message || err}`);
  process.exit(1);
});
