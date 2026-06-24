// References to the UI elements in the popup
const featureBtn = document.getElementById('typeFeature');
const bugfixBtn = document.getElementById('typeBugfix');
const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');

// Default to "feature" branches
let isBugfix = false;

function applyToggleStyle() {
  featureBtn.classList.toggle('active-feature', !isBugfix);
  bugfixBtn.classList.toggle('active-bugfix', isBugfix);
}

featureBtn.addEventListener('click', () => {
  isBugfix = false;
  applyToggleStyle();
});

bugfixBtn.addEventListener('click', () => {
  isBugfix = true;
  applyToggleStyle();
});

applyToggleStyle();

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.className = `status ${isError ? 'error' : 'success'}`;
}

// Cleans up the issue title so it's safe to use as a branch name segment
function sanitizeTitle(raw) {
  if (!raw) {
    return '';
  }

  let title = raw.trim().replace(/\s+/g, '-');
  title = title.replace(/[^A-Za-z0-9._-]/g, '');
  title = title.replace(/-{2,}/g, '-');
  return title.replace(/^[-.]+|[-.]+$/g, '');
}

// This function is injected into the Jira tab (runs in the page's context, not the
// popup's), so it cannot reference any variables from popup.js - it must be self-contained.
function extractJiraIssueData() {
  // Returns the text content of the first element matching one of the given selectors
  function firstText(selectors) {
    for (const selector of selectors) {
      const text = document.querySelector(selector)?.textContent?.trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  // 1. Issue key - classic issue view (#key-val) and the detail side-panel on a board
  // ("Active sprints"), where the key sits in a data-issuekey attribute or a link
  let issueKey =
    document.querySelector('#key-val')?.textContent?.trim() ||
    document.querySelector('[data-issuekey]')?.getAttribute('data-issuekey')?.trim() ||
    document.querySelector('[data-issue-key]')?.getAttribute('data-issue-key')?.trim() ||
    firstText(['[data-field-id="issuekey"] a', '[data-field-id="issuekey"]']);

  // 2. Universal fallback: any link pointing to /browse/KEY-123
  // (works in both the classic view and the board side-panel)
  if (!issueKey) {
    const browseLink = document.querySelector('a[href*="/browse/"]');
    const match = browseLink?.getAttribute('href')?.match(/\/browse\/([A-Z][A-Z0-9]*-\d+)/);
    issueKey = match?.[1];
  }

  // 3. Title/summary - classic view (#summary-val) and the board side-panel (.ghx-summary)
  const summary = firstText(['#summary-val', '[data-field-id="summary"]', '.ghx-summary', 'h1[id^="summary"]']);

  if (!issueKey || !summary) {
    return null;
  }

  return { issueKey: issueKey.trim(), summary: summary.trim() };
}

generateBtn.addEventListener('click', async () => {
  setStatus('Wczytywanie danych ze zgłoszenia...', false);

  try {
    // 1. Find the active browser tab (requires the "activeTab" permission)
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('Nie udało się odnaleźć aktywnej karty.', true);
      return;
    }

    // 2. Inject the script into the page and read the issue key + title (requires "scripting")
    const [injectionResult] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJiraIssueData,
    });

    const issueData = injectionResult?.result;
    if (!issueData) {
      setStatus(
        'Nie znaleziono zgłoszenia Jira na tej karcie. Otwórz konkretne zgłoszenie i spróbuj ponownie.',
        true
      );
      return;
    }

    // 3. Format the branch name following the convention: {type}/{KEY}-{title-with-hyphens}
    const type = isBugfix ? 'bugfix' : 'feature';
    const slug = sanitizeTitle(issueData.summary);
    const branchName = `${type}/${issueData.issueKey}-${slug}`;

    // 4. Copy to the clipboard and let the user know it succeeded
    await navigator.clipboard.writeText(branchName);
    setStatus(`Skopiowano: ${branchName}`, false);
  } catch (error) {
    setStatus(`Błąd: ${error.message}`, true);
  }
});
