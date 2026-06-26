2.	

// omnimind front-end scaffold
const startBtn = document.getElementById(‘start-btn’);
const stopBtn = document.getElementById(‘stop-btn’);
const statusEl = document.getElementById(‘status’);
const originalText = document.getElementById(‘original-text’);
const translatedText = document.getElementById(‘translated-text’);
const historyList = document.getElementById(‘history-list’);
const sourceLang = document.getElementById(‘source-lang’);
const targetLang = document.getElementById(‘target-lang’);
const ttsToggle = document.getElementById(‘tts-toggle’);
const autoScroll = document.getElementById(‘auto-scroll’);
let recognition = null;
let listening = false;
// Basic live speech recognition using Web Speech API as fallback/demo
function setupBrowserRecognition() {
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
statusEl.textContent = ‘Speech recognition not supported in this browser.’;
return null;
}
const r = new SpeechRecognition();
r.interimResults = true;
r.continuous = true;
r.lang = ‘en-US’;
r.onstart = () => { statusEl.textContent = ‘Listening…’; statusEl.classList.add(‘status-ok’); };
r.onerror = (e) => { statusEl.textContent = ’Error: ’ + e.error; };
r.onend = () => { statusEl.textContent = ‘Stopped’; statusEl.classList.remove(‘status-ok’); listening = false; startBtn.disabled = false; stopBtn.disabled = true; startBtn.setAttribute(‘aria-pressed’,‘false’); };
r.onresult = (evt) => {
let interim = ‘’;
let finalTranscript = ‘’;
for (let i = evt.resultIndex; i < evt.results.length; ++i) {
const transcript = evt.results[i].transcript;
if (evt.results[i].isFinal) finalTranscript += transcript;
else interim += transcript;
}
// show interim + final
originalText.textContent = (finalTranscript + (interim ? ’ — ’ + interim : ‘’)) || originalText.textContent;
if (finalTranscript) handleNewText(finalTranscript);
};
return r;
}
// called each time there’s a finalized piece of speech/text to translate
async function handleNewText(text) {
addHistory(‘original’, text);
// show original
originalText.textContent = text;
// 1) Option A: call your real-time AI transcription/translation API here.
// Replace the placeholder function  callTranslationAPI  with your integration.
// Example: send text to your server which streams requests to AssemblyAI / DeepL / OpenAI.
try {
const translated = await callTranslationAPI(text, sourceLang.value, targetLang.value);
translatedText.textContent = translated;
addHistory(‘translated’, translated);
if (ttsToggle.checked) speakText(translated, targetLang.value);
if (autoScroll.checked) translatedText.scrollTop = translatedText.scrollHeight;
} catch (err) {
console.error(‘Translation error’, err);
statusEl.textContent = ‘Translation error’;
}
}
// Placeholder: implement integration here
async function callTranslationAPI(text, source, target) {
// For now the demo will simply return a pseudo-translation by echoing text with language marks.
// Replace this with a fetch() to your server endpoint or direct call to your chosen AI provider.
// Example:
// const resp = await fetch(’/api/translate’, {method:‘POST’, headers:{‘Content-Type’:‘application/json’}, body: JSON.stringify({text,source,target,apiKey: ‘YOUR_KEY’})});
// const json = await resp.json();
// return json.translation;
return  [${target.toUpperCase()}] ${text} ;
}
function addHistory(type, text) {
const li = document.createElement(‘li’);
li.textContent =  ${type === 'original' ? 'Orig' : 'Trans'}: ${text} ;
historyList.prepend(li);
// keep only latest 50
while (historyList.children.length > 50) historyList.removeChild(historyList.lastChild);
}
function speakText(text, lang) {
if (!(‘speechSynthesis’ in window)) return;
const utter = new SpeechSynthesisUtterance(text);
// map iso codes to voices; in production pick best-match voice
utter.lang = lang === ‘yo’ ? ‘yo-NG’ : (lang === ‘fr’ ? ‘fr-FR’ : ‘en-US’);
window.speechSynthesis.cancel();
window.speechSynthesis.speak(utter);
}
// Start / stop actions
startBtn.addEventListener(‘click’, async () => {
startBtn.disabled = true;
stopBtn.disabled = false;
startBtn.setAttribute(‘aria-pressed’,‘true’);
// Prefer a server-backed approach for real-time and multi-language; this is local fallback
if (!recognition) recognition = setupBrowserRecognition();
if (recognition) {
recognition.lang = sourceLang.value === ‘auto’ ? ‘en-US’ : (sourceLang.value === ‘yo’ ? ‘yo-NG’ : (sourceLang.value === ‘fr’ ? ‘fr-FR’ : ‘en-US’));
recognition.start();
listening = true;
} else {
// If no Web Speech API, you would open mic stream and send audio chunks to server here.
statusEl.textContent = ‘No browser speech support — integrate server API for production.’;
}
});
stopBtn.addEventListener(‘click’, () => {
if (recognition) recognition.stop();
listening = false;
startBtn.disabled = false;
stopBtn.disabled = true;
startBtn.setAttribute(‘aria-pressed’,‘false’);
statusEl.textContent = ‘Stopped’;
});
// Accessibility: keyboard shortcuts (Space to start/stop)
window.addEventListener(‘keydown’, (e) => {
if (e.code === ‘Space’ && document.activeElement.tagName !== ‘INPUT’ && document.activeElement.tagName !== ‘SELECT’ && document.activeElement.tagName !== ‘TEXTAREA’) {
e.preventDefault();
if (!listening) startBtn.click(); else stopBtn.click();
}
});
// Expose a method to wire your real API for webhooks/streaming
// Example usage (from server code): window.omnimindInject = (fn) => { callTranslationAPI = fn; }
window.omnimindInject = (fn) => {
if (typeof fn === ‘function’) callTranslationAPI = fn;
};
