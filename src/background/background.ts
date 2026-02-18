
// Background script
import { pushToGitHub, updateProgress } from '../utils/github';
import { generatePaths } from '../utils/folderMapper';
import { Logger } from '../utils/helpers';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'PUSH_TO_GITHUB') {
    (async () => {
      try {
        const { metadata, settings } = request.payload;
        Logger.log('Received Push Request', metadata);

        // 1. Generate Paths
        const { filePath, metaPath } = generatePaths(metadata);
        Logger.log('Generated Paths', { filePath, metaPath });
        
        // 2. Prepare files for GitHub
        const files: { path: string; content: string; encoding?: 'base64' | 'utf-8' }[] = [
          { path: filePath, content: metadata.code },
          { path: metaPath, content: JSON.stringify(metadata, null, 2) }
        ];

        // 3. Screenshot Capture (Background)
        // Only if acceptedDetected is true AND screenshotEnabled (passed in payload)
        if (request.payload.includeScreenshot && metadata.isAccepted) {
            try {
                // We need windowId of the tab. Payload should provide it? 
                // Or we assume active tab of current window? 
                // Popup sends message. chrome.tabs.query({active:true}) from popup gives the tab.
                // We should pass windowId in payload from popup.
                const windowId = request.payload.windowId;
                if (windowId) {
                    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
                    const base64Content = screenshotDataUrl.split(',')[1];
                    const screenshotPath = filePath.substring(0, filePath.lastIndexOf('/')) + '/accepted.png';
                    files.push({ path: screenshotPath, content: base64Content, encoding: 'base64' });
                }
            } catch (screenErr) {
                Logger.warn('Screenshot Capture Failed', screenErr);
            }
        }
        
        // 4. Commit Message
        const prefix = metadata.type === 'contest' 
          ? `[${metadata.site} Contest]` 
          : `[${metadata.site} ${metadata.rating || metadata.difficulty || ''}]`;
        const timeStr = metadata.solveTimeMinutes ? `(${metadata.solveTimeMinutes}m)` : '';
        const message = `${prefix} ${metadata.problemName} ${timeStr} - ${metadata.type === 'practice' ? 'Practice' : 'Contest'}`;
        
        // 5. Push Files
        // pushToGitHub now returns status of each file
        const pushResults = await pushToGitHub(settings, files, message);
        Logger.log('Push Success', pushResults);

        // 6. Update Progress
        // Determine if solution was CREATED (not updated)
        const solutionFile = pushResults.find(r => r.path === filePath);
        const wasCreated = solutionFile ? solutionFile.status === 'created' : false;

        try {
           await updateProgress(settings, metadata, wasCreated);
           Logger.log('Progress Processed', { wasCreated });
        } catch (progErr) {
           Logger.warn('Progress Update Failed', progErr);
        }

        // 7. Cleanup Timer
        // We notify popup? Or popup handles it? 
        // Popup handles local storage cleanup on success? 
        // Better if popup handles it to keep background stateless regarding UI.
        
        sendResponse({ success: true, result: pushResults });
      } catch (error: any) {
        Logger.error('Push Failed', error);
        sendResponse({ success: false, error: error.message || 'Unknown Background Error' });
      }
    })();
    return true; // Keep channel open
  }
});

chrome.runtime.onInstalled.addListener(() => {
  Logger.log('TrackCP Installed/Updated');
});
