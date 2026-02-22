const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

console.log('Testing Jupiter V6 API...\n');

const amount = 1_000_000_000; // 1 SOL in lamports
const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${amount}&slippageBps=50`;

console.log('Fetching quote: 1 SOL → USDC');
let quoteRes: Response;
try {
  quoteRes = await fetch(quoteUrl);
} catch (err) {
  console.error(`Network error reaching Jupiter API: ${(err as Error).message}`);
  console.error('Ensure DNS can resolve quote-api.jup.ag and outbound HTTPS is not blocked.');
  process.exit(1);
}
if (!quoteRes.ok) {
  console.error(`Quote API failed: ${quoteRes.status} ${await quoteRes.text()}`);
  process.exit(1);
}
const quote = await quoteRes.json();
console.log('Quote received:');
console.log(`   Input: ${quote.inAmount} lamports (${parseInt(quote.inAmount) / 1e9} SOL)`);
console.log(`   Output: ${quote.outAmount} (USDC atomic units)`);
console.log(`   Price impact: ${quote.priceImpactPct}%`);
console.log(
  `   Route: ${quote.routePlan?.map((r: { swapInfo?: { label?: string } }) => r.swapInfo?.label).join(' → ')}`,
);

const DUMMY_PUBKEY = 'BKGHvVx3xyYgKNYN3c2CYXTxTGPH1H4Szmw67Kq7ByP';
console.log('\nFetching swap transaction...');
const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    quoteResponse: quote,
    userPublicKey: DUMMY_PUBKEY,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
  }),
});

if (swapRes.ok) {
  const swapData = await swapRes.json();
  console.log(`Swap transaction received (${swapData.swapTransaction?.length} bytes base64)`);
} else {
  const errText = await swapRes.text();
  console.log(`Swap API returned ${swapRes.status}: ${errText.slice(0, 200)}`);
  console.log('   (This may fail with dummy pubkey — that is expected)');
}

console.log('\nFetching supported tokens...');
const tokensRes = await fetch('https://tokens.jup.ag/tokens?tags=verified');
if (tokensRes.ok) {
  const tokens = await tokensRes.json();
  console.log(`${tokens.length} verified tokens available`);
  const sol = tokens.find((t: { symbol: string }) => t.symbol === 'SOL');
  const usdc = tokens.find((t: { symbol: string }) => t.symbol === 'USDC');
  console.log(`   SOL mint: ${sol?.address}`);
  console.log(`   USDC mint: ${usdc?.address}`);
} else {
  console.log(`Token list failed: ${tokensRes.status}`);
}

console.log('\n=== JUPITER API VALIDATION COMPLETE ===');
