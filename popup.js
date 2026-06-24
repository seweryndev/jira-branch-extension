// Referencje do elementów UI w popupie
const featureBtn = document.getElementById('typeFeature');
const bugfixBtn = document.getElementById('typeBugfix');
const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');

// Domyślnie generujemy branch typu "feature"
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

// Czyści tytuł zgłoszenia tak, by był bezpieczny jako fragment nazwy brancha Git
function sanitizeTitle(raw) {
  if (!raw) {
    return '';
  }

  let title = raw.trim().replace(/\s+/g, '-');
  title = title.replace(/[^A-Za-z0-9._-]/g, '');
  title = title.replace(/-{2,}/g, '-');
  return title.replace(/^[-.]+|[-.]+$/g, '');
}

// Ta funkcja jest wstrzykiwana do karty Jiry (działa w kontekście strony, nie popupu),
// więc nie może korzystać z żadnych zmiennych z popup.js - musi być samodzielna.
function extractJiraIssueData() {
  // Klasyczny interfejs Jira Server / Data Center
  let issueKey = document.querySelector('#key-val')?.textContent?.trim();
  let summary = document.querySelector('#summary-val')?.textContent?.trim();

  // Fallback dla nowszych motywów Jiry, gdzie dane bywają w atrybutach data-*
  if (!issueKey) {
    issueKey = document.querySelector('[data-issue-key]')?.getAttribute('data-issue-key')?.trim();
  }

  if (!summary) {
    summary = document
      .querySelector('[data-field-id="summary"], h1[id^="summary"]')
      ?.textContent?.trim();
  }

  if (!issueKey || !summary) {
    return null;
  }

  return { issueKey, summary };
}

generateBtn.addEventListener('click', async () => {
  setStatus('Wczytywanie danych ze zgłoszenia...', false);

  try {
    // 1. Znajdź aktywną kartę przeglądarki (wymaga uprawnienia "activeTab")
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('Nie udało się odnaleźć aktywnej karty.', true);
      return;
    }

    // 2. Wstrzyknij skrypt do strony i odczytaj klucz + tytuł zgłoszenia (wymaga "scripting")
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

    // 3. Sformatuj nazwę brancha zgodnie z konwencją: {typ}/{KLUCZ}-{tytul-z-myślnikami}
    const type = isBugfix ? 'bugfix' : 'feature';
    const slug = sanitizeTitle(issueData.summary);
    const branchName = `${type}/${issueData.issueKey}-${slug}`;

    // 4. Skopiuj do schowka i poinformuj użytkownika o sukcesie
    await navigator.clipboard.writeText(branchName);
    setStatus(`Skopiowano: ${branchName}`, false);
  } catch (error) {
    setStatus(`Błąd: ${error.message}`, true);
  }
});
