'use client';

import Link from 'next/link';
import { FullScreenScrollFX } from '@/components/ui/full-screen-scroll-fx';

const sections = [
  {
    id: 'create-wallet',
    title: 'Create Wallet',
    leftLabel: 'Autonomous',
    rightLabel: 'Solana Devnet',
    background: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80',
  },
  {
    id: 'fund-it',
    title: 'Fund It',
    leftLabel: 'Airdrop SOL',
    rightLabel: 'Instant',
    background: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1280&q=50',
  },
  {
    id: 'ai-agent',
    title: 'AI Agent Executes',
    leftLabel: 'GPT-4o',
    rightLabel: 'Tool Calling',
    background: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1280&q=50',
  },
  {
    id: 'tx-confirmed',
    title: 'Transaction Confirmed',
    leftLabel: 'On-Chain',
    rightLabel: 'Verified',
    background: 'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=1280&q=50',
  },
  {
    id: 'explorer',
    title: 'View on Explorer',
    leftLabel: 'Real Proof',
    rightLabel: 'Zero Trust',
    background: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=50',
  },
];

export default function Home() {
  return (
    <FullScreenScrollFX
      sections={sections}
      header={<span>SolAgent</span>}
      footer={
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '1rem 2.5rem',
            background: '#7c3aed',
            color: '#fff',
            borderRadius: '0.5rem',
            fontSize: '1.1rem',
            fontWeight: 700,
            textDecoration: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background = '#6d28d9')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLAnchorElement).style.background = '#7c3aed')
          }
        >
          Get Started
        </Link>
      }
      colors={{
        text: 'rgba(245,245,245,0.92)',
        overlay: 'rgba(0,0,0,0.45)',
        pageBg: '#0a0a12',
        stageBg: '#000000',
      }}
    />
  );
}
