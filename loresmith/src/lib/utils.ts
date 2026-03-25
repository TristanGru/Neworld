import fantasyTheme from '../themes/fantasy.json';
import neutralTheme from '../themes/neutral.json';

const themeMap: Record<string, Record<string, string>> = {
  fantasy: fantasyTheme,
  'sci-fi': neutralTheme,
  horror: neutralTheme,
  romance: neutralTheme,
  mystery: neutralTheme,
  historical: neutralTheme,
  contemporary: neutralTheme,
  custom: neutralTheme,
  neutral: neutralTheme,
};

export function applyTheme(genre: string, customTokens?: Record<string, string>) {
  const tokens = customTokens ?? themeMap[genre] ?? neutralTheme;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k words`;
  }
  return `${count} words`;
}

export function genreLabel(genre: string): string {
  const labels: Record<string, string> = {
    fantasy: 'Fantasy',
    'sci-fi': 'Sci-Fi',
    horror: 'Horror',
    romance: 'Romance',
    mystery: 'Mystery / Noir',
    historical: 'Historical',
    contemporary: 'Contemporary',
    custom: 'Custom',
  };
  return labels[genre] ?? genre;
}

export function genreIcon(genre: string): string {
  const icons: Record<string, string> = {
    fantasy: '🏰',
    'sci-fi': '🚀',
    horror: '💀',
    romance: '💕',
    mystery: '🔍',
    historical: '📜',
    contemporary: '🏙️',
    custom: '✏️',
  };
  return icons[genre] ?? '📖';
}
