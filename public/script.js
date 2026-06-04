(() => {
  const modeButtons = document.querySelectorAll('.mode-btn');
  const questionInput = document.getElementById('question');
  const submitBtn = document.getElementById('submitBtn');
  const answerCard = document.getElementById('answerCard');
  const answerContent = document.getElementById('answerContent');
  const modeBadge = document.getElementById('modeBadge');
  const charHint = document.getElementById('charHint');
  const copyMdBtn = document.getElementById('copyMdBtn');
  const copyTxtBtn = document.getElementById('copyTxtBtn');
  const historyCard = document.getElementById('historyCard');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastEl = document.getElementById('toast');

  const MODE_LABELS = {
    explain: '問題解釋',
    practice: '練習題生成',
    advice: '學習建議',
  };

  const HISTORY_KEY = 'learning-history-v1';
  let currentMode = 'explain';
  let lastAnswerMarkdown = '';

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
    });
  });

  questionInput.addEventListener('input', () => {
    charHint.textContent = `${questionInput.value.length} 字`;
  });

  questionInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submitBtn.click();
    }
  });

  function renderAnswer(markdown) {
    const cleanedMarkdown = markdown
      .replace(/^---+$/gm, "")
      .replace(/^___+$/gm, "")
      .replace(/^\*\*\*+$/gm, "")
      .trim();

    lastAnswerMarkdown = cleanedMarkdown;

    const html = window.marked ? window.marked.parse(cleanedMarkdown) : cleanedMarkdown;
    answerContent.innerHTML = html;

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([answerContent]).catch(() => {});
    }
  }

  function showError(msg) {
    answerContent.innerHTML = `<div class="error">⚠️ ${msg}</div>`;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`已複製${label}`);
    } catch {
      showToast('複製失敗');
    }
  }

  copyMdBtn.addEventListener('click', () => {
    if (!lastAnswerMarkdown) return;
    copyText(lastAnswerMarkdown, ' Markdown');
  });

  copyTxtBtn.addEventListener('click', () => {
    const text = answerContent.innerText.trim();
    if (!text) return;
    copyText(text, '純文字');
  });

  // ---- History ----
  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  }

  function addHistory(item) {
    const list = loadHistory();
    list.unshift(item);
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      historyCard.hidden = true;
      return;
    }
    historyCard.hidden = false;
    historyList.innerHTML = list
      .map((it, i) => {
        const time = new Date(it.time).toLocaleString('zh-TW', { hour12: false });
        const preview = (it.question || '').slice(0, 80).replace(/</g, '&lt;');
        return `
          <li class="history-item" data-idx="${i}">
            <div class="history-meta">
              <span class="history-mode">${MODE_LABELS[it.mode] || it.mode}</span>
              <span class="history-time">${time}</span>
            </div>
            <div class="history-question">${preview}${it.question.length > 80 ? '…' : ''}</div>
            <div class="history-actions">
              <button type="button" class="link-btn" data-action="load" data-idx="${i}">重新載入</button>
              <button type="button" class="link-btn" data-action="view" data-idx="${i}">查看回答</button>
              <button type="button" class="link-btn danger" data-action="del" data-idx="${i}">刪除</button>
            </div>
          </li>`;
      })
      .join('');
  }

  historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    const list = loadHistory();
    const item = list[idx];
    if (!item) return;

    if (btn.dataset.action === 'load') {
      questionInput.value = item.question;
      charHint.textContent = `${item.question.length} 字`;
      currentMode = item.mode;
      modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === item.mode));
      questionInput.focus();
      questionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('已載入到輸入框');
    } else if (btn.dataset.action === 'view') {
      modeBadge.textContent = MODE_LABELS[item.mode] || item.mode;
      answerCard.hidden = false;
      renderAnswer(item.answer);
      answerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (btn.dataset.action === 'del') {
      list.splice(idx, 1);
      saveHistory(list);
      renderHistory();
    }
  });

  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('確定要清除所有學習歷史？')) return;
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  });

  renderHistory();

  // ---- Submit ----
  submitBtn.addEventListener('click', async () => {
    const question = questionInput.value.trim();
    if (!question) {
      questionInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.querySelector('.btn-text').textContent = '思考中';

    answerCard.hidden = false;
    modeBadge.textContent = MODE_LABELS[currentMode];
    answerContent.innerHTML = '<p style="color:var(--text-muted)">AI 正在為你準備回答...</p>';
    answerCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: currentMode, question }),
      });

      if (!res.ok) throw new Error(`伺服器回應錯誤 (${res.status})`);
      const data = await res.json();
      const answer = data.answer || '（無回應內容）';
      renderAnswer(answer);
      addHistory({ mode: currentMode, question, answer, time: Date.now() });
    } catch (err) {
      console.error("前端錯誤：", err);
      showError("目前無法取得 AI 回答，請確認後端伺服器是否正在執行，或 API Key 是否設定正確。");
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.querySelector('.btn-text').textContent = '送出';
    }
  });

  // ---- Camera Photo Feature ----
  const startCameraBtn = document.getElementById("startCameraBtn");
  const takePhotoBtn = document.getElementById("takePhotoBtn");
  const stopCameraBtn = document.getElementById("stopCameraBtn");
  const cameraVideo = document.getElementById("cameraVideo");
  const cameraStatus = document.getElementById("cameraStatus");
  const photoCanvas = document.getElementById("photoCanvas");
  const photoImage = document.getElementById("photoImage");
  const photoPreview = document.getElementById("photoPreview");

  let cameraStream = null;

  async function startCamera() {
    try {
      cameraStatus.textContent = "正在開啟鏡頭...";

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });

      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();

      startCameraBtn.disabled = true;
      takePhotoBtn.disabled = false;
      stopCameraBtn.disabled = false;
      cameraStatus.textContent = "鏡頭已開啟，可以拍照。";
    } catch (error) {
      console.error("開啟鏡頭失敗：", error);
      cameraStatus.textContent = "無法開啟鏡頭，請確認瀏覽器已允許相機權限。";
    }
  }

  function takePhoto() {
    if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
      cameraStatus.textContent = "鏡頭尚未準備完成，請稍後再拍。";
      return;
    }

    photoCanvas.width = cameraVideo.videoWidth;
    photoCanvas.height = cameraVideo.videoHeight;

    const ctx = photoCanvas.getContext("2d");
    ctx.drawImage(cameraVideo, 0, 0, photoCanvas.width, photoCanvas.height);

    const imageDataUrl = photoCanvas.toDataURL("image/png");
    photoImage.src = imageDataUrl;
    photoPreview.hidden = false;

    cameraStatus.textContent = "拍照完成，照片已顯示在下方。";
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }

    cameraVideo.srcObject = null;

    startCameraBtn.disabled = false;
    takePhotoBtn.disabled = true;
    stopCameraBtn.disabled = true;
    cameraStatus.textContent = "鏡頭已關閉。";
  }

  if (startCameraBtn && takePhotoBtn && stopCameraBtn) {
    startCameraBtn.addEventListener("click", startCamera);
    takePhotoBtn.addEventListener("click", takePhoto);
    stopCameraBtn.addEventListener("click", stopCamera);
  }
})();
