import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/{**,.client,.server}/**/**.{js,jsx,ts,tsx}"],
  safelist: [
    'bg-faction-ax',
		'bg-faction-br',
		'bg-faction-ly',
		'bg-faction-mu',
		'bg-faction-or',
		'bg-faction-yz',
		'text-faction-ax',
		'text-faction-br',
		'text-faction-ly',
		'text-faction-mu',
		'text-faction-or',
		'text-faction-yz',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji'
        ]
      },
      colors: {
        subtle: {
          background: 'var(--subtle-background)',
          foreground: 'var(--subtle-foreground)'
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        
        palette: {
          red: 'hsl(var(--palette-red))',
          orange: 'hsl(var(--palette-orange))',
          carrot: 'hsl(var(--palette-carrot))',
          gold: 'hsl(var(--palette-gold))',
          fern: 'hsl(var(--palette-fern))',
          teal: 'hsl(var(--palette-teal))',
          charcoal: 'hsl(var(--palette-charcoal))',
        },

        'faction-ax': 'hsl(var(--axiom))',
        'faction-br': 'hsl(var(--bravos))',
        'faction-ly': 'hsl(var(--lyra))',
        'faction-mu': 'hsl(var(--muna))',
        'faction-or': 'hsl(var(--ordis))',
        'faction-yz': 'hsl(var(--yzmir))',

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      borderRadius: {
        'alt-card': '4%/3%',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
