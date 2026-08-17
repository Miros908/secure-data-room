type HistoryRouter = {
  back: () => void;
  replace: (href: string) => void;
};

export function goBackOrReplace(
  router: HistoryRouter,
  fallbackHref: string,
  historyLength = typeof window === 'undefined' ? 0 : window.history.length,
) {
  if (historyLength > 1) {
    router.back();
    return;
  }

  router.replace(fallbackHref);
}
