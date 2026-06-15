'use client';

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem('pr_theme') || 'dark';
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('pr_theme', theme);
}

export function toggleTheme() {
  const current = getStoredTheme();
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}
