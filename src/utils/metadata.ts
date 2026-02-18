export interface ProblemMetadata {
  site: 'leetcode' | 'codeforces' | 'codechef';
  type: 'practice' | 'contest';
  problemName: string; // e.g. "Two Sum" or "A. Watermelon"
  problemId?: string; // e.g. "1" or "4A"
  url: string;
  rating?: number | null; // Codeforces/CodeChef rating
  difficulty?: 'Easy' | 'Medium' | 'Hard' | null; // LeetCode difficulty
  language: string; // "cpp", "python3", "java", etc.
  timestamp: string; // ISO string
  contestName?: string; // e.g. "Codeforces Round #123"
  code: string;
  solveTimeMinutes?: number;
  isAccepted?: boolean;
}

export interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
}
