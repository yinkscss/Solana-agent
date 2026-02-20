"use client";

import { TransactionTable } from "@/components/transactions/transaction-table";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          View and filter transaction history
        </p>
      </div>
      <TransactionTable />
    </div>
  );
}
