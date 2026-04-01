# 📸 Vision OCR SnapTable

**Vision OCR SnapTable** is a high-precision multimodal AI application that transforms physical documents, receipts, and bank statements into structured, editable digital data. 

Built with **Next.js 15** and powered by **Gemini 3 Flash**, this tool moves beyond traditional pattern-matching OCR into true semantic understanding.

---

## 🚀 Key Features

- **Context-Aware Extraction:** Automatically identifies items, quantities, and prices from messy, angled, or low-light photos.
- **Interactive Data Grid:** A custom "Glassmorphism" UI that allows for real-time editing and manual verification of AI-extracted data.
- **Dynamic Schema Mapping:** Intelligent logic that switches between "Receipt Mode" and "Table/Statement Mode" based on the image content.
- **One-Click Excel Export:** Seamlessly convert your interactive table into a professional `.xlsx` workbook using SheetJS.
- **Modern Tech Stack:** Leveraging the latest React 19 features and the Vercel AI SDK for low-latency processing.

---

## 🧠 What is OCR? (The AI Evolution)

**Optical Character Recognition (OCR)** is the technology that converts images of text into machine-encoded text. 

Traditional OCR (like Tesseract) uses pattern matching to guess characters based on pixel shapes. **Vision OCR SnapTable** uses a **Multimodal LLM (Gemini 3)**, which doesn't just "see" shapes—it "understands" the document.

By using a GenAI-first approach, the app can infer missing information and handle complex layouts that would typically break standard OCR libraries.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
- **AI Infrastructure:** [Google Gemini 3 Flash](https://aistudio.google.com/) via Vercel AI SDK
- **Styling:** Tailwind CSS (Dark Mode & Glassmorphism)
- **Validation:** [Zod](https://zod.dev/) for structured data integrity
- **Export Logic:** [SheetJS (XLSX)](https://sheetjs.com/) for browser-side Excel generation

---

## ⚙️ Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/akhiljjj/Vision-OCR-SnapTable.git
   cd Vision-OCR-SnapTable
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see the app in action.

---

## 🛡️ Security Note
This project uses `.gitignore` to ensure that sensitive API keys stored in `.env.local` are never pushed to the public repository.

---

**Developed by:** [Akhil Juvvanapudi](https://github.com/akhiljjj)  
