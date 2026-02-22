/**
 * Live Agent Test — AI agent autonomously interacts with Solana devnet.
 *
 * This script proves the core bounty requirement:
 * "An AI agent that can create wallets, sign transactions, and interact with protocols"
 *
 * It connects a real LLM (OpenAI) to real Solana devnet tools.
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set in .env");
  process.exit(1);
}

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const MODEL = process.env.DEFAULT_MODEL || "gpt-4o";
const connection = new Connection(RPC_URL, "confirmed");

const KEYS_DIR = join(import.meta.dir, "..", ".keys");
const WALLET_PATH = join(KEYS_DIR, "devnet-wallet.json");
const RECIPIENT_PATH = join(KEYS_DIR, "devnet-recipient.json");

function loadKeypair(path: string): Keypair {
  if (!existsSync(path)) {
    console.error(`❌ Keypair not found at ${path}`);
    console.error("   Run 'bun run devnet:smoke' first to create and fund a wallet.");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

// ----- Tool Definitions (what the LLM sees) -----

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "check_balance",
      description: "Check the SOL balance of a Solana wallet address",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Solana wallet public key (base58)" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_sol",
      description: "Send SOL from the agent's wallet to a destination address on Solana devnet",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string", description: "Destination Solana address (base58)" },
          amount_sol: { type: "number", description: "Amount of SOL to send" },
        },
        required: ["destination", "amount_sol"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recent_transactions",
      description: "Get recent confirmed transaction signatures for a wallet",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Solana wallet public key" },
          limit: { type: "number", description: "Number of recent transactions (default 5)" },
        },
        required: ["address"],
      },
    },
  },
];

// ----- Tool Implementations (real devnet execution) -----

const wallet = loadKeypair(WALLET_PATH);
const recipient = loadKeypair(RECIPIENT_PATH);

async function executeCheckBalance(args: { address: string }): Promise<string> {
  const pubkey = new PublicKey(args.address);
  const lamports = await connection.getBalance(pubkey);
  const sol = lamports / LAMPORTS_PER_SOL;
  return JSON.stringify({ address: args.address, balance_sol: sol, lamports });
}

async function executeSendSol(args: { destination: string; amount_sol: number }): Promise<string> {
  const lamports = Math.round(args.amount_sol * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: new PublicKey(args.destination),
      lamports,
    }),
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
  return JSON.stringify({
    success: true,
    signature: sig,
    explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    amount_sol: args.amount_sol,
    destination: args.destination,
  });
}

async function executeGetRecentTransactions(args: { address: string; limit?: number }): Promise<string> {
  const pubkey = new PublicKey(args.address);
  const sigs = await connection.getSignaturesForAddress(pubkey, { limit: args.limit ?? 5 });
  const txs = sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    err: s.err ? "failed" : "success",
    explorer: `https://explorer.solana.com/tx/${s.signature}?cluster=devnet`,
  }));
  return JSON.stringify({ address: args.address, transactions: txs });
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "check_balance":
      return executeCheckBalance(args as { address: string });
    case "send_sol":
      return executeSendSol(args as { destination: string; amount_sol: number });
    case "get_recent_transactions":
      return executeGetRecentTransactions(args as { address: string; limit?: number });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ----- OpenAI Chat with Tool Calling Loop -----

interface ChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

async function chatCompletion(messages: ChatMessage[]): Promise<ChatMessage> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${text}`);
  }

  const data = await res.json() as { choices: Array<{ message: ChatMessage; finish_reason: string }>; usage: { prompt_tokens: number; completion_tokens: number } };
  console.log(`   [tokens: ${data.usage.prompt_tokens} in, ${data.usage.completion_tokens} out]`);
  return data.choices[0].message;
}

async function runAgent(userMessage: string): Promise<void> {
  console.log(`\n👤 User: ${userMessage}`);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You are an autonomous AI agent managing a Solana devnet wallet.",
        `Your wallet address: ${wallet.publicKey.toBase58()}`,
        `Known recipient address: ${recipient.publicKey.toBase58()}`,
        "You can check balances, send SOL, and view recent transactions.",
        "Always confirm actions with the user by describing what you did.",
        "When sending SOL, always check balance first to make sure you have enough.",
      ].join("\n"),
    },
    { role: "user", content: userMessage },
  ];

  const MAX_TURNS = 8;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await chatCompletion(messages);

    if (response.tool_calls?.length) {
      messages.push(response);

      for (const toolCall of response.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`\n🔧 Tool call: ${toolCall.function.name}(${JSON.stringify(args)})`);

        const result = await executeTool(toolCall.function.name, args);
        console.log(`   Result: ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result,
        });
      }
      continue;
    }

    console.log(`\n🤖 Agent: ${response.content}`);
    return;
  }

  console.log("\n⚠️  Max turns reached");
}

// ----- Main -----

async function main() {
  console.log("=== SolAgent Live Agent Test ===");
  console.log(`Model:     ${MODEL}`);
  console.log(`RPC:       ${RPC_URL}`);
  console.log(`Wallet:    ${wallet.publicKey.toBase58()}`);
  console.log(`Recipient: ${recipient.publicKey.toBase58()}`);

  // Test 1: Agent checks balance
  await runAgent("What is my current wallet balance?");

  // Test 2: Agent sends SOL autonomously
  await runAgent(
    `Send 0.005 SOL to ${recipient.publicKey.toBase58()}. Check my balance first to make sure I have enough.`,
  );

  // Test 3: Agent reviews recent transactions
  await runAgent("Show me my last 3 transactions.");

  console.log("\n=== LIVE AGENT TEST COMPLETE ===\n");
}

main().catch((err) => {
  console.error(`\n❌ Agent test failed: ${err.message || err}`);
  process.exit(1);
});
