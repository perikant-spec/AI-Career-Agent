// Ported from the web app's tailwind.config.ts — same palette, same intent, native RN doesn't
// support oklch() in style objects, so accent colors are converted to the nearest sRGB hex here.
// Keeping both files' comments in sync by hand is a known small maintenance cost of not sharing
// a token package across the two clients yet.
export const colors = {
  bg: "#F4F1EA",
  card: "#FFFDF9",
  border: "#E6E1D6",
  borderStrong: "#D8D2C4",
  ink: {
    primary: "#211F1A",
    secondary: "#5C584D",
    tertiary: "#6E6A5F",
    quaternary: "#8C877A",
  },
  sidebar: {
    default: "#1B1A17",
    hover: "#282621",
    text: "#EDE9DF",
    textDim: "#8C877A",
    border: "#2C2A25",
  },
  accent: {
    teal: "#3FBFA4",
    tealInk: "#10201D",
    link: "#3E8E86",
    success: "#3FAE8A",
    successBg: "#E8F5EF",
    successBorder: "#BFE3D2",
    successText: "#256B52",
    warning: "#D9A441",
    warningBg: "#FBF2E1",
    risk: "#C96B4A",
    riskBg: "#FBEAE3",
    riskBorder: "#EFC9B8",
    riskText: "#9C4A2E",
  },
} as const;

export const radii = {
  card: 16,
  btn: 10,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fonts = {
  serif: "InstrumentSerif_400Regular",
  sans: "InstrumentSans_400Regular",
  sansMedium: "InstrumentSans_500Medium",
  sansSemibold: "InstrumentSans_600SemiBold",
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;
