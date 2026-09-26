// Runs before first paint (inlined in layout) so there's no light/dark flash.
// Keep the storage key in sync with app/lib/theme.ts.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('cfh-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;if(d)e.classList.add('dark');e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;
