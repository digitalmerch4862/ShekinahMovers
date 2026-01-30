import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptData } from "../types";

// Initialize the API client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractReceiptData(base64Data: string, mimeType: string): Promise<ReceiptData> {
  // Enhanced System Instruction based on the detailed prompt engineering template
  const systemInstruction = `
### ROLE
You are an expert Logistics Auditor and Data Extraction Specialist for Shekinah Movers. Your communication style is professional, concise, and focused on data accuracy.

### CONTEXT
I am building a Trucking Expense Control SaaS. The specific feature is Receipt Ingestion & AI Extraction.
Current Tech Stack: Next.js, Supabase, Google GenAI SDK (Gemini 3 Flash Preview).

### OBJECTIVE
Your primary task is to extract receipt data from images and return strictly structured JSON for the database.

### TASK BREAKDOWN (CHAIN OF THOUGHT)
1. Step 1: Analyze the input image for vendor details, dates, and amounts.
2. Step 2: Validate if the document is a valid receipt (Official Receipt, Invoice, etc.).
3. Step 3: Transform the extracted text into the target JSON schema.
4. Step 4: Categorize the expense based on line items (e.g., Diesel = fuel).

### CONSTRAINTS & RULES
- DO NOT: Include conversational filler (e.g., "Sure, I can help with that").
- DO NOT: Guess values. Use 'null' if data is missing or unreadable.
- DO: Format all currency as numbers (no symbols).
- DO: Use ISO-8601 for all date formats (YYYY-MM-DD).
- DO: Calculate a 'category_confidence' score (0-1).

### OUTPUT FORMAT
Return only a JSON object matching the defined schema.

### EXAMPLES (FEW-SHOT)
Input: [Image of Petron receipt, 2000 PHP, Diesel, 2024-05-20]
Output: { "vendor_name": "Petron", "total": 2000, "suggested_category": "fuel", "receipt_date": "2024-05-20", "category_confidence": 0.99 }
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        },
        {
          text: "Analyze this receipt image and extract the data."
        }
      ]
    },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendor_name: { type: Type.STRING, nullable: true },
          vendor_tin: { type: Type.STRING, nullable: true },
          vendor_branch: { type: Type.STRING, nullable: true },
          document_type: { 
            type: Type.STRING, 
            nullable: true,
            enum: ['Official Receipt', 'Sales Invoice', 'Billing Statement', 'Other']
          },
          receipt_date: { type: Type.STRING, nullable: true },
          currency: { type: Type.STRING, nullable: true },
          subtotal: { type: Type.NUMBER, nullable: true },
          tax: { type: Type.NUMBER, nullable: true },
          total: { type: Type.NUMBER, nullable: true },
          payment_method: { type: Type.STRING, nullable: true },
          invoice_or_receipt_no: { type: Type.STRING, nullable: true },
          line_items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit_price: { type: Type.NUMBER },
                amount: { type: Type.NUMBER }
              }
            },
            nullable: true
          },
          suggested_category: { 
            type: Type.STRING, 
            nullable: true,
            enum: [
              'fuel', 'tolls', 'maintenance', 'tires', 'parts', 'parking', 'meals', 'lodging',
              'supplies', 'insurance', 'permits', 'fees', 'phone_internet', 'office', 'other'
            ]
          },
          category_confidence: { type: Type.NUMBER, nullable: true },
          notes: { type: Type.STRING, nullable: true }
        }
      }
    }
  });

  const text = response.text;

  if (!text) {
    throw new Error("No data returned from Gemini.");
  }

  return JSON.parse(text) as ReceiptData;
}