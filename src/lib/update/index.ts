export interface AppVersion {
  version: string;
  buildDate: string;
}

export interface GitHubRelease {
  tag_name: string;
  html_url: string;
  name: string;
  body: string;
}

export async function checkUpdates(currentVersion: string): Promise<GitHubRelease | null> {
  try {
    // Add cache buster to bypass GitHub API caching
    const url = `https://api.github.com/repos/bangsmackpow/md.app/releases/latest?t=${Date.now()}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) console.warn('GitHub API rate limit reached');
      return null;
    }
    
    const latest: GitHubRelease = await response.json();
    if (!latest.tag_name) return null;

    // Clean versions: remove 'v' and any non-numeric parts for comparison
    const latestClean = latest.tag_name.trim().replace(/^v/, '');
    const currentClean = currentVersion.trim().replace(/^v/, '');
    
    console.log(`Update Check: Current=${currentClean}, Latest=${latestClean}`);

    if (latestClean !== currentClean && isNewer(latestClean, currentClean)) {
      return latest;
    }
    
    return null;
  } catch (err) {
    console.error('Update check failed:', err);
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  // Split by '.' and filter out non-numeric parts
  const l = latest.split('.').map(s => parseInt(s.replace(/\D/g, ''), 10));
  const c = current.split('.').map(s => parseInt(s.replace(/\D/g, ''), 10));
  
  const maxLength = Math.max(l.length, c.length);
  
  for (let i = 0; i < maxLength; i++) {
    const lPart = l[i] || 0;
    const cPart = c[i] || 0;
    if (lPart > cPart) return true;
    if (lPart < cPart) return false;
  }
  return false;
}
