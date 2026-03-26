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
    const response = await fetch('https://api.github.com/repos/builtnetworks/md.app/releases/latest');
    if (!response.ok) return null;
    
    const latest: GitHubRelease = await response.json();
    
    // Simple semver comparison (v1.0.7 -> 1.0.7)
    const latestNum = latest.tag_name.replace('v', '');
    const currentNum = currentVersion.replace('v', '');
    
    if (latestNum !== currentNum && isNewer(latestNum, currentNum)) {
      return latest;
    }
    
    return null;
  } catch (err) {
    console.error('Update check failed:', err);
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}
