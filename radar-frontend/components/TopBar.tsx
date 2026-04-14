'use client'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, Bell, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
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

  const { theme, setTheme } = useTheme()

  return (
    <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-4 shrink-0 z-30">
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
        className="object-contain"
      />

      {/* Separator */}
      <div className="w-px h-5 bg-white/20" />

      {/* Project name */}
      <span className="text-sidebar-primary font-medium text-sm">
        Radar B2B
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications bell (placeholder) */}
      <button type="button" className="text-white/60 hover:text-white transition-colors">
        <Bell className="w-5 h-5" />
      </button>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Cambiar tema"
        className="text-white/60 hover:text-white transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* User avatar → link to /profile */}
      <Link href="/profile" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 rounded-full bg-sidebar-primary/30 border border-sidebar-border flex items-center justify-center text-sidebar-foreground text-xs font-bold group-hover:bg-sidebar-primary/50 transition-colors select-none">
          {initials}
        </div>
        <span className="text-white/80 text-sm font-medium hidden md:block group-hover:text-white transition-colors">
          {session.name.split(' ')[0]}
        </span>
      </Link>
    </header>
  )
}
