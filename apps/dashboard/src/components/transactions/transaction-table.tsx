"use client";

import { useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { mockTransactions } from "@/lib/mock-data";
import { TransactionStatusBadge } from "./transaction-status-badge";
import type { Transaction, TransactionStatus, TransactionType } from "@/types";

function truncateSig(sig: string) {
  return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface TransactionTableProps {
  lastWsEvent?: { type: string; data: unknown; timestamp: string } | null;
}

export function TransactionTable({ lastWsEvent }: TransactionTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (typeFilter !== "all") params.type = typeFilter;

    api
      .listTransactions(params)
      .then((txs) => {
        txs.forEach((tx) => seenIdsRef.current.add(tx.id));
        setTransactions(txs);
      })
      .catch(() => {
        mockTransactions.forEach((tx) => seenIdsRef.current.add(tx.id));
        setTransactions(mockTransactions);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    if (!lastWsEvent || lastWsEvent.type !== "transaction") return;
    const tx = lastWsEvent.data as Transaction;
    if (!tx?.id || seenIdsRef.current.has(tx.id)) return;
    seenIdsRef.current.add(tx.id);
    setTransactions((prev) => [tx, ...prev]);
  }, [lastWsEvent]);

  const filtered = transactions.filter((tx) => {
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="swap">Swap</SelectItem>
            <SelectItem value="stake">Stake</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Signature</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <div className="h-8 animate-pulse rounded bg-muted/50" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs">
                    {tx.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={tx.status as TransactionStatus} />
                  </TableCell>
                  <TableCell className="font-mono">
                    {tx.amount} {tx.token}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncateAddr(tx.from)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncateAddr(tx.to)}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs text-violet-400 hover:text-violet-300"
                    >
                      {truncateSig(tx.signature)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
