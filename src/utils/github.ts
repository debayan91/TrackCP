import { GitHubSettings, ProblemMetadata } from './metadata';
import { Logger, safeBase64, safeDecodeBase64 } from './helpers';

const GITHUB_API = 'https://api.github.com';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const pushToGitHub = async (
  settings: GitHubSettings,
  files: { path: string; content: string; encoding?: 'utf-8' | 'base64' }[],
  message: string
): Promise<{ path: string; status: 'created' | 'updated' | 'unchanged' }[]> => {
  const { token, owner, repo } = settings;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const results: { path: string; status: 'created' | 'updated' | 'unchanged' }[] = [];

  for (const file of files) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${file.path}`;

    // Retry Logic
    let attempts = 0;
    let success = false;
    
    while (attempts < 3 && !success) {
      try {
        // 1. Get SHA
        let sha: string | undefined;
        const getResp = await fetch(url, { headers });
        if (getResp.ok) {
          const data = await getResp.json();
          sha = data.sha;
        //   existingContent = data.content; // If we wanted to check unchanged
        } else if (getResp.status === 401 || getResp.status === 403) {
          throw new Error('GitHub Authorization Failed. Check Token/Scopes.');
        }

        // 2. PUT
        // Determine content encoding
        let finalContent = '';
        if (file.encoding === 'base64') {
            finalContent = file.content; // Already base64
        } else {
            finalContent = safeBase64(file.content);
        }

        const body: any = {
          message,
          content: finalContent,
        };
        if (sha) body.sha = sha;

        const putResp = await fetch(url, {
          method: 'PUT',
          headers,
          body: JSON.stringify(body),
        });

        if (putResp.ok) {
          await putResp.json();
          results.push({ path: file.path, status: sha ? 'updated' : 'created' });
          success = true;
        } else {
          // Handle 409 Conflict (Concurrency)
          if (putResp.status === 409) {
            Logger.warn('409 Conflict - Retrying...');
            attempts++;
            await delay(1000); // Backoff
            continue; 
          }
          const errData = await putResp.json();
          throw new Error(`GitHub Error ${putResp.status}: ${errData.message}`);
        }
      } catch (e: any) {
        if (attempts >= 2) throw e;
        attempts++;
        await delay(1000);
      }
    }
  }

  return results;
};

export const updateProgress = async (settings: GitHubSettings, meta: ProblemMetadata, wasCreated: boolean) => {
    if (!wasCreated) {
        Logger.log('Solution updated from existing. Skipping progress increment.');
        return;
    }

    // 1. Fetch progress.json
    const progressPath = 'metadata/progress.json';
    const { token, owner, repo } = settings;
    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${progressPath}`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' };

    let progress: any = {
        leetcode: { easy: 0, medium: 0, hard: 0 },
        codeforces: { "0-1000": 0, "1000-1200": 0, "1200-1400": 0, "1400-1600": 0, "1600-1900": 0, "1900+": 0 },
        codechef: { "0-1000": 0, "1000-1200": 0, "1200-1400": 0, "1400-1600": 0, "1600-1900": 0, "1900+": 0 },
        totalSolved: 0
    };
    let sha: string | undefined;

    try {
        const resp = await fetch(url, { headers });
        if (resp.ok) {
            const data = await resp.json();
            sha = data.sha;
            const content = safeDecodeBase64(data.content); // decode
            progress = JSON.parse(content);
        }
    } catch (e) { Logger.warn('Progress file not found, creating new.'); }

    // 2. Increment
    progress.totalSolved = (progress.totalSolved || 0) + 1;
    
    if (meta.site === 'leetcode' && meta.difficulty) {
        const diff = meta.difficulty.toLowerCase();
        if (!progress.leetcode) progress.leetcode = {};
        progress.leetcode[diff] = (progress.leetcode[diff] || 0) + 1;
    } else if ((meta.site === 'codeforces' || meta.site === 'codechef') && meta.rating) {
        // Map rating to bucket
        let tier = '0-1000';
        const r = meta.rating;
        if (r < 1000) tier = '0-1000';
        else if (r < 1200) tier = '1000-1200';
        else if (r < 1400) tier = '1200-1400';
        else if (r < 1600) tier = '1400-1600';
        else if (r < 1900) tier = '1600-1900';
        else tier = '1900+';

        if (!progress[meta.site]) progress[meta.site] = {};
        progress[meta.site][tier] = (progress[meta.site][tier] || 0) + 1;
    }

    // 3. Push
    const putBody: any = {
        message: `Update progress: ${meta.problemName}`,
        content: safeBase64(JSON.stringify(progress, null, 2)),
    };
    if (sha) putBody.sha = sha;

    const putResp = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(putBody)
    });
    
    if (!putResp.ok) throw new Error('Failed to update progress.json');
};
