import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 120;

const tableSchema = z.object({
  columns: z
    .array(z.string())
    .describe("Column headers. If none are visible, invent short descriptive headers."),
  rows: z
    .array(z.array(z.string()))
    .describe(
      "Table body: each inner array is one row; length must match number of columns for every row."
    ),
});

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);

export async function POST(request: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      {
        error:
          "Missing GOOGLE_GENERATIVE_AI_API_KEY. Add it to .env.local (see .env.example).",
      },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const uploaded = formData.get("file") ?? formData.get("image");
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    return Response.json({ error: "No image file provided" }, { status: 400 });
  }
  const file = uploaded;

  let mime = (file.type || "").toLowerCase();
  if (!mime && file.name) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".png")) mime = "image/png";
    else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) mime = "image/jpeg";
  }
  if (!mime) mime = "image/png";
  if (!mime.startsWith("image/")) {
    return Response.json({ error: "File must be an image" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(mime)) {
    return Response.json(
      { error: "Only PNG and JPG images are supported." },
      { status: 400 }
    );
  }

  // Pass binary data directly to the provider.
  // Using a `data:` URL string can cause the SDK to treat it as a downloadable URL.
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { object } = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: tableSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a high-precision OCR assistant. Your goal is to extract data into a structured table.

Rules:
- If the image is a simple receipt (like a restaurant or shop bill), create columns for "Item", "Quantity", and "Price/Amount". 
- If it is a formal table or bank statement, preserve the original headers and row structure.
- Do not invent data. If you see "Frozen Yogurt Large" and "60.00", put them in a row together.
- Every row must have the same number of cells as the columns.
- Ignore background noise; only extract the actual transaction data.`,
            },
            {
              type: "image",
              image: buffer,
              mediaType: mime,
            },
          ],
        },
      ],
    });

    const colCount = object.columns.length;
    const normalizedRows = object.rows.map((row) => {
      const padded = [...row];
      while (padded.length < colCount) padded.push("");
      return padded.slice(0, colCount);
    });

    return Response.json({
      columns: object.columns,
      rows: normalizedRows,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to extract text from image";
    return Response.json({ error: message }, { status: 400 });
  }
}
