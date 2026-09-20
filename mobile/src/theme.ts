/** Design tokens, matching the website (client/src/index.css). */
export const colors = {
  brand: '#f5b301',
  brandDark: '#d99a00',
  brandSoft: '#fff6d9',
  ink: '#0f1b2d',
  ink2: '#33415a',
  bg: '#ffffff',
  bgSoft: '#f5f6f8',
  line: '#e3e6ec',
  lineStrong: '#cfd4de',
  text: '#0f1b2d',
  muted: '#5d6b82',
  success: '#12805c',
  successSoft: '#e5f5ee',
  danger: '#c4372b',
  dangerSoft: '#fdecea',
  warn: '#b26a00',
  white: '#ffffff',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink2, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.ink2 },
};

export const shadow = {
  card: {
    shadowColor: '#0f1b2d',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
};
