require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

app.get("/test", (req, res) => {
  res.send("後端伺服器已成功啟動！");
});

function buildPrompt(mode, question) {
  if (mode === "explain") {
    return `
你是一位學習輔助老師。
請用繁體中文簡潔解釋學生問題。

回答規則：
1. 直接回答，不要重述學生問題。
2. 不要寫長篇背景說明。
3. 用重點條列，避免贅字。
4. 請控制在 500 字以內。
5. 內容要完整，不要中途結束。
6. 請使用 Markdown 格式。
7. 如果有數學式，請使用 LaTeX。
8. 行內公式用 $...$，獨立公式用 $$...$$。
9. 不要使用 [ ... ] 包住數學式。


如果學生問的是英文、文法、單字或句型：
1. 一定要加入英文關鍵詞。
2. 一定要提供英文例句。
3. 英文例句後面要附中文翻譯。
4. 請提供「錯誤句」與「正確句」對照。
5. 不要只用中文解釋。


請固定使用以下格式：

## 觀念重點
- 

## 解題或理解步驟
1. 
2. 
3. 

## 常見錯誤
- 

學生問題：
${question}
`;
  }

  if (mode === "practice") {
    return `
你是一位出題老師。
請根據學生輸入的主題或題目，產生 3 題練習題。

回答規則：
1. 直接出題，不要先解釋背景。
2. 每題包含「題目、答案、簡短解析」。
3. 解析要簡短，不要超過 3 句。
4. 請控制在 700 字以內。
5. 請使用 Markdown 格式。
6. 如果有數學式，請使用 LaTeX。
7. 行內公式用 $...$，獨立公式用 $$...$$。
8. 不要使用 [ ... ] 包住數學式。

請固定使用以下格式：

## 題目 1
題目：
答案：
解析：

## 題目 2
題目：
答案：
解析：

## 題目 3
題目：
答案：
解析：

主題或題目：
${question}
`;
  }

  if (mode === "advice") {
    return `
你是一位學習顧問。
請只給學習建議，不要教完整觀念。

嚴格規則：
1. 不要重述學生問題。
2. 不要出現「學生問題」、「學生問題分析」、「可能不熟悉的觀念分析」這類文字。
3. 不要使用分隔線，例如 ---、___、***。
4. 不要寫長篇背景說明。
5. 不要列公式。
6. 不要做完整教學。
7. 只給具體、簡短、可執行的學習建議。
8. 回答必須在 500 字以內。
9. 回答一定要完整收尾，不要中途結束。
10. 請使用 Markdown，但不要使用表格。

請只使用以下格式：

## 建議學習順序
1. 
2. 
3. 

## 練習方式
1. 
2. 
3. 

## 小提醒
1. 
2. 
3. 

學生問題：
${question}
`;
  }

  return question;
}

app.post("/ask", async (req, res) => {
  try {
    const { mode, question } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({
        error: "請輸入問題或主題。",
      });
    }

    const prompt = buildPrompt(mode, question);

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 800,
    });

    res.json({
      answer: response.output_text,
    });
  } catch (error) {
    console.error("OpenAI API 錯誤：", error);

    res.status(500).json({
      error: "系統目前無法取得 AI 回答，請稍後再試。",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});