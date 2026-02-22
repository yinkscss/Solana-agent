import {
  Connection,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const connection = new Connection(RPC_URL, "confirmed");

const AGENT_COUNT = 3;
const AIRDROP_SOL = 1;

function sol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(4);
}

function explorer(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

async function airdropWithRetry(
  pubkey: Keypair["publicKey"],
  lamports: number,
  retries = 3
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports);
      await connection.confirmTransaction(sig, "confirmed");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === retries) throw err;
      const delay = attempt * 5_000;
      console.log(
        `   ⚠️  Airdrop attempt ${attempt} failed (${msg}), retrying in ${delay / 1000}s...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function transferSOL(
  from: Keypair,
  to: Keypair,
  lamports: number,
  label: string
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to.publicKey,
      lamports,
    })
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

  // Step 1: Create agent wallets
  console.log("--- Step 1: Create agent wallets ---");
  const agents: Keypair[] = [];
  for (let i = 0; i < AGENT_COUNT; i++) {
    const kp = Keypair.generate();
    agents.push(kp);
    console.log(`✅ Agent ${i + 1}: ${kp.publicKey.toBase58()}`);
  }

  // Step 2: Airdrop SOL to each agent
  console.log("\n--- Step 2: Airdrop SOL to each agent ---");
  for (let i = 0; i < agents.length; i++) {
    try {
      await airdropWithRetry(
        agents[i].publicKey,
        AIRDROP_SOL * LAMPORTS_PER_SOL
      );
      const balance = await connection.getBalance(agents[i].publicKey);
      console.log(`✅ Agent ${i + 1} funded: ${sol(balance)} SOL`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Airdrop to Agent ${i + 1} failed: ${msg}`);
      if (msg.includes("429")) {
        console.error(
          "   Devnet airdrop is rate-limited. Wait a minute and retry."
        );
      }
      process.exit(1);
    }
  }

  // Step 3: Agent 1 sends 0.1 SOL to Agent 2
  console.log("\n--- Step 3: Agent 1 → Agent 2 (0.1 SOL) ---");
  const tx1 = await transferSOL(
    agents[0],
    agents[1],
    0.1 * LAMPORTS_PER_SOL,
    "Agent 1 → Agent 2"
  );

  // Step 4: Agent 2 sends 0.05 SOL to Agent 3
  console.log("\n--- Step 4: Agent 2 → Agent 3 (0.05 SOL) ---");
  const tx2 = await transferSOL(
    agents[1],
    agents[2],
    0.05 * LAMPORTS_PER_SOL,
    "Agent 2 → Agent 3"
  );

  // Step 5: Final balances
  console.log("\n--- Step 5: Final balances ---");
  for (let i = 0; i < agents.length; i++) {
    const balance = await connection.getBalance(agents[i].publicKey);
    console.log(`   Agent ${i + 1}: ${sol(balance)} SOL`);
  }

  // Summary
  console.log("\n=== MULTI-AGENT TEST COMPLETE ===");
  for (let i = 0; i < agents.length; i++) {
    console.log(`Agent ${i + 1}: ${agents[i].publicKey.toBase58()}`);
  }
  console.log(`TX 1 (Agent 1→2): ${tx1}`);
  console.log(`TX 2 (Agent 2→3): ${tx2}`);
  console.log("All tests passed ✅\n");
}

main().catch((err) => {
  console.error(`\n❌ Multi-agent test failed: ${err.message || err}`);
  process.exit(1);
});
