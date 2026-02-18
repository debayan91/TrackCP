import { ProblemMetadata } from '../utils/metadata';

// Logger Inlined
const IS_DEV = import.meta.env.DEV;
const Logger = {
  log: (...args: any[]) => { if (IS_DEV) console.log('[TrackCP]', ...args); },
  warn: (...args: any[]) => { if (IS_DEV) console.warn('[TrackCP]', ...args); },
  error: (...args: any[]) => { console.error('[TrackCP]', ...args); }
};

// Script injection helper to get code from Monaco/Ace/CodeMirror
const getCodeFromPage = (): Promise<string> => {
  return new Promise((resolve) => {
    // Check if script already injected to avoid multiple
    if (document.getElementById('trackcp-inpage-script')) {
      // Just post message to trigger it again if we had a listener
      // But simpler to just re-inject or have the script allow polling.
      // For robustness, let's just re-run extraction logic via a new script execution 
      // or ensure the old one responds. 
      // Given the previous impl was one-shot inpage, let's keep it simple: inject fresh.
    }

    const script = document.createElement('script');
    script.id = 'trackcp-inpage-script-' + Date.now();
    
    // We inline the function to avoid external file deps during easy build
    const inlineScript = `
      (function() {
        let code = "";
        try {
          // Monaco (LeetCode)
          if (window.monaco) {
             const models = window.monaco.editor.getModels();
             if (models.length > 0) code = models[models.length - 1].getValue(); // Get last model usually active
          } 
          // Ace (CodeChef/HackerEarth)
          if (!code && window.ace) {
             const editor = window.ace.edit(document.querySelector('.ace_editor'));
             if (editor) code = editor.getValue();
          } 
          // CodeMirror (Old Codeforces / Others)
          if (!code && document.querySelector('.CodeMirror')) {
             const cm = (document.querySelector('.CodeMirror') as any).CodeMirror;
             if (cm) code = cm.getValue();
          }
          // Textarea fallback (Codeforces)
          if (!code) {
             const ta = document.getElementById('sourceCodeTextarea') 
                     || document.querySelector('textarea.ace_text-input')
                     || document.querySelector('textarea#program'); // CodeChef fallback
             if (ta) code = ta.value;
          }
        } catch(e) { console.error('[TrackCP Inpage] Error:', e); }
        window.postMessage({ type: 'TRACKCP_CODE_RESULT', code, id: '${script.id}' }, '*');
      })();
    `;
    
    script.textContent = inlineScript;
    
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.data.type !== 'TRACKCP_CODE_RESULT' || event.data.id !== script.id) return;
      window.removeEventListener('message', listener);
      script.remove();
      resolve(event.data.code || "");
    };
    
    window.addEventListener('message', listener);
    (document.head || document.documentElement).appendChild(script);
  });
};

const waitForElement = (selector: string, timeout = 2000): Promise<Element | null> => {
  return new Promise(resolve => {
    if (document.querySelector(selector)) return resolve(document.querySelector(selector));
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
};

const getLeetCodeData = async (): Promise<Partial<ProblemMetadata>> => {
  const url = window.location.href;
  // Wait for title
  await waitForElement('div[data-cy="question-title"], .text-title-large');
  
  const titleParts = document.title.split('-');
  const problemName = titleParts[0].trim();
  
  let difficulty: 'Easy' | 'Medium' | 'Hard' | null = null;
  
  // Try finding difficulty
  const diffSelectors = ['.text-green-500', '.text-yellow-500', '.text-red-500', '.text-olive', '.text-pink'];
  for (const sel of diffSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim();
      if (text === 'Easy') difficulty = 'Easy';
      else if (text === 'Medium') difficulty = 'Medium';
      else if (text === 'Hard') difficulty = 'Hard';
    }
  }

  // Fallback: Check text content of specific containers
  if (!difficulty) {
    const bodyText = document.body.innerText;
    if (bodyText.includes('Easy')) difficulty = 'Easy'; // Too loose but fallback
    // A better fallback is looking for specific difficulty div classes that might change but usually contain the word
  }

  // Extract Code
  const code = await getCodeFromPage();

  return { site: 'leetcode', problemName, url, difficulty, code, language: 'cpp' }; 
};

const getCodeforcesData = async (): Promise<Partial<ProblemMetadata>> => {
  const url = window.location.href;
  // Problem Name
  const titleEl = document.querySelector('.problem-statement .title');
  let problemName = titleEl ? titleEl.textContent?.trim() || "Unknown" : document.title;
  // Clean up index like "A. Watermelon" -> "Watermelon" or keep "A. Watermelon"? 
  // User prompt example: "Problem_Name". Usually people prefer "Watermelon" or "A_Watermelon".
  // Let's keep strict to scraped text but we sanitize later.

  // Rating
  let rating = null;
  const tags = document.querySelectorAll('.tag-box');
  tags.forEach(tag => {
    const title = tag.getAttribute('title');
    if (title && title.includes('Difficulty')) {
      const r = parseInt(tag.textContent?.trim() || '0');
      if (!isNaN(r)) rating = r;
    }
  });

  const contestMatch = url.match(/contest\/(\d+)/) || url.match(/gym\/(\d+)/);
  const contestName = contestMatch ? `Round_${contestMatch[1]}` : undefined;

  const code = await getCodeFromPage();

  return { site: 'codeforces', problemName, url, rating, contestName, code, language: 'cpp' };
};

const getCodeChefData = async (): Promise<Partial<ProblemMetadata>> => {
  const url = window.location.href;
  // Wait for problem title
  await waitForElement('h1');
  
  let problemName = document.title.split('|')[0].trim();
  // CodeChef new UI uses h1
  const h1 = document.querySelector('h1');
  if (h1) problemName = h1.textContent?.trim() || problemName;

  let rating = null;
  // Rating is usually in a sidebar div
  // Need to look for "Difficulty Rating: 1245"
  // const sidebar = document.body.innerText; // Expensive?
  // Use specific selector if possible
  const ratingLabel = Array.from(document.querySelectorAll('label, span, div')).find(el => el.textContent?.includes('Difficulty Rating'));
  if (ratingLabel) {
    const parent = ratingLabel.parentElement || ratingLabel;
    const clean = parent.textContent?.replace(/\D/g, '');
    if (clean) rating = parseInt(clean);
  }

  const code = await getCodeFromPage();
  
  return { site: 'codechef', problemName, url, rating, code, language: 'cpp' };
};

const scrape = async () => {
  try {
    const hostname = window.location.hostname;
    let data: Partial<ProblemMetadata> = {};
    
    if (hostname.includes('leetcode')) data = await getLeetCodeData();
    else if (hostname.includes('codeforces')) data = await getCodeforcesData();
    else if (hostname.includes('codechef')) data = await getCodeChefData();
    else throw new Error('Unsupported site');
    
    if (!data.code) {
      Logger.warn('No code found in page.');
    }

    // Check for "Accepted" state (Strict Site-Specific)
    let isAccepted = false;
    const bodyText = document.body.innerText;

    if (hostname.includes('leetcode')) {
        // LeetCode: Look for "Accepted" in specific submission containers
        const successEl = document.querySelector('[data-cy="submission-result-success"]');
        const greenText = document.querySelector('.text-green-500');
        if (successEl || (greenText && greenText.textContent?.includes('Accepted'))) {
            isAccepted = true;
        }
    } else if (hostname.includes('codeforces')) {
        // Codeforces: Look for "Accepted" in the verdict cell of the last submission or the status
        // Usually, the user is on a problem page. They might have just submitted.
        // Codeforces doesn't dynamically update the problem page with "Accepted" unless we check the submission table if present.
        // But often users are on the "Status" page or the problem page has a "Last submission" box?
        // Let's check for the standard ".verdict-accepted" class which CF uses in tables.
        if (document.querySelector('.verdict-accepted')) {
            isAccepted = true;
        }
    } else if (hostname.includes('codechef')) {
        // CodeChef: Look for success message
        if (bodyText.includes('Correct Answer') || document.querySelector('.accepted')) {
            isAccepted = true;
        }
    }

    return {
      ...data,
      timestamp: new Date().toISOString(),
      isAccepted
    };
  } catch (e: any) {
    Logger.error('Scraping failed', e);
    throw e;
  }
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'SCRAPE') {
    scrape()
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message || 'Scrape Error' }));
    return true; 
  }
});
