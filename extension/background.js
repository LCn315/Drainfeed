chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

// Proxy de rede para o Chrome/Edge contornarem restrições de loopback HTTPS -> HTTP
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'proxyFetch') {
        fetch(request.url, {
            method: request.method || 'GET',
            headers: request.headers || { 'Content-Type': 'application/json' },
            body: request.body ? JSON.stringify(request.body) : undefined
        })
        .then(async response => {
            const data = await response.json();
            sendResponse({ success: true, data });
        })
        .catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});