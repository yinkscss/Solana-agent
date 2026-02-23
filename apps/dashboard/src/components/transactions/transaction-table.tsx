'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExternalLink, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { mockTransactions } from '@/lib/mock-data';
import { TransactionStatusBadge } from './transaction-status-badge';
import type { Transaction, TransactionStatus } from '@/types';

function truncateAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const typeBadgeColors: Record<string, string> = {
  transfer: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  swap: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  stake: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  other: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

interface TransactionTableProps {
  lastWsEvent?: { type: string; data: unknown; timestamp: string } | null;
}

export function TransactionTable({ lastWsEvent }: TransactionTableProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'all') params.type = typeFilter;

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
    if (!lastWsEvent || lastWsEvent.type !== 'transaction') return;
    const tx = lastWsEvent.data as Transaction;
    if (!tx?.id || seenIdsRef.current.has(tx.id)) return;
    seenIdsRef.current.add(tx.id);
    setTransactions((prev) => [tx, ...prev]);
  }, [lastWsEvent]);

  const filtered = transactions.filter((tx) => {
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        tx.signature.toLowerCase().includes(q) ||
        tx.from.toLowerCase().includes(q) ||
        tx.to.toLowerCase().includes(q) ||
        tx.token.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by address, signature..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="hidden md:table-cell">From</TableHead>
              <TableHead className="hidden md:table-cell">To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="w-[100px]">Explorer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-8 animate-pulse rounded bg-muted/50" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.length > 0 &&
              filtered.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs capitalize ${typeBadgeColors[tx.type] ?? typeBadgeColors.other}`}
                    >
                      {tx.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {tx.amount} {tx.token}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {truncateAddr(tx.from)}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {truncateAddr(tx.to)}
                  </TableCell>
                  <TableCell>
                    <TransactionStatusBadge status={tx.status as TransactionStatus} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {relativeTime(tx.createdAt)}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-violet-400 transition-colors hover:text-violet-300"
                    >
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
