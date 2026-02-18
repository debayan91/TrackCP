import { ProblemMetadata } from './metadata';
import { sanitizeProblemName } from './helpers';

const getRatingTier = (rating: number | null | undefined): string => {
  if (rating === null || rating === undefined) return '0-1000';
  if (rating < 1000) return '0-1000';
  if (rating < 1200) return '1000-1200';
  if (rating < 1400) return '1200-1400';
  if (rating < 1600) return '1400-1600';
  if (rating < 1900) return '1600-1900';
  return '1900+';
};

export const getFileExtension = (lang: string) => {
  const map: Record<string, string> = {
    'cpp': 'cpp', 'c++': 'cpp', 'gnu c++17': 'cpp', 'gnu c++14': 'cpp', 'gnu c++20': 'cpp',
    'java': 'java', 'openjdk 17': 'java', 'java 8': 'java',
    'python': 'py', 'python3': 'py', 'pypy 3': 'py', 'pypy3': 'py',
    'javascript': 'js', 'typescript': 'ts',
    'c': 'c', 'gnu c11': 'c',
    'c#': 'cs', 'mono c#': 'cs',
    'ruby': 'rb',
    'swift': 'swift',
    'go': 'go',
    'kotlin': 'kt',
    'rust': 'rs',
    'php': 'php',
    'scala': 'scala'
  };
  const l = (lang || '').toLowerCase();
  for (const key of Object.keys(map)) {
    if (l.includes(key)) return map[key];
  }
  return 'txt';
};

export const generatePaths = (meta: ProblemMetadata): { filePath: string; metaPath: string } => {
  const { site, type, problemName, difficulty, rating, contestName, language } = meta;
  const safeProblemName = sanitizeProblemName(problemName);
  const ext = getFileExtension(language);
  let basePath = '';

  if (type === 'contest') {
    const safeContestName = contestName ? sanitizeProblemName(contestName) : 'Unknown_Contest';
    const date = new Date(meta.timestamp).toISOString().split('T')[0];
    basePath = `contests/${site}/${date}_${safeContestName}/${safeProblemName}`;
    
    return {
      filePath: `${basePath}.${ext}`,
      metaPath: `contests/${site}/${date}_${safeContestName}/meta.json` 
    };
  } else {
    let subDir = '';
    if (site === 'leetcode') {
      subDir = (difficulty || 'unknown').toLowerCase();
    } else {
      subDir = getRatingTier(rating);
    }
    
    basePath = `practice/${site}/${subDir}/${safeProblemName}`;
    return {
      filePath: `${basePath}/solution.${ext}`,
      metaPath: `${basePath}/meta.json`
    };
  }
};
