import { GoogleGenerativeAI } from "@google/generative-ai";
import { ReceiptData } from "../types";

// Initialize the API client
const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Use Gemini 1.5 Flash for speed and efficiency
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const prompt = `
    Analyze this receipt image and extract the data into a JSON object.
    Map the extracted information to the following structure:
    - vendor_name: string
    - receipt_date: string (YYYY-MM-DD)
    - total: number
    - suggested_category: string (Must be one of: fuel, tolls, maintenance, tires, parts, parking, meals, lodging, supplies, insurance, permits, fees, phone_internet, office, other)
    - category_confidence: number (0-1)
    - vendor_tin: string (optional)
    - document_type: string (Official Receipt, Sales Invoice, etc.)
    - line_items: array of objects { description, quantity, unit_price, amount }
    - notes: string (optional)

    If a field cannot be found, set it to null.
  `;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ]);

  const response = result.response;
  const text = response.text();

  if (!text) {
    throw new Error("No data returned from Gemini.");
  }

  return JSON.parse(text) as ReceiptData;
}