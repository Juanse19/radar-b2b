'use client'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, Bell } from 'lucide-react'
import type { SessionUser } from '@/lib/auth/types'

interface TopBarProps {
  session: SessionUser
  onMobileMenuToggle?: () => void
}

export function TopBar({ session, onMobileMenuToggle }: TopBarProps) {
  const initials = session.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="h-14 bg-[#142e47] border-b border-white/10 flex items-center px-4 gap-4 shrink-0 z-30">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMobileMenuToggle}
        aria-label="Abrir menú"
        className="md:hidden text-white/70 hover:text-white transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Logo + app name — solo en mobile (sm..md); en desktop el sidebar ya muestra el branding */}
      <Image
        src="/matec-logo.png"
        alt="Matec"
        width={80}
        height={22}
        className="object-contain hidden sm:block md:hidden"
      />

      {/* Separator */}
      <div className="w-px h-5 bg-white/20 hidden sm:block md:hidden" />

      {/* Project name */}
      <span className="text-[#71acd2] font-medium text-sm hidden sm:block md:hidden">
        Radar B2B
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications bell (placeholder) */}
      <button type="button" className="text-white/60 hover:text-white transition-colors">
        <Bell className="w-5 h-5" />
      </button>

      {/* User avatar → link to /profile */}
      <Link href="/profile" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-full bg-[#71acd2]/30 border border-white/20 flex items-center justify-center text-white text-xs font-bold group-hover:bg-[#71acd2]/50 transition-colors select-none">
          {initials}
        </div>
        <span className="text-white/80 text-sm font-medium hidden md:block group-hover:text-white transition-colors">
          {session.name.split(' ')[0]}
        </span>
      </Link>
    </header>
  )
}
